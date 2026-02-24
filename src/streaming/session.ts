import { EventEmitter } from 'node:events';
import type { Config } from '../config/index.js';
import { TranscribeStream } from './transcribe-stream.js';
import { PlaywrightPool } from './playwright-pool.js';
import { structureTranscript, type StructuringDependencies } from '../services/structuring.js';
import { renderToHtml } from '../services/html-renderer.js';
import { generateBlockIcons, type IllustrationDependencies } from '../services/illustration.js';
import {
  interimStructuredContentSchema,
  structuredContentSchema,
  type StructuredContent,
  type InterimStructuredContent,
} from '../types/structured-content.js';

export interface SessionEvents {
  transcript_partial: [text: string];
  transcript_final: [text: string];
  graphic_update: [png: string];
  graphic_final: [png: string];
  status: [message: string];
  error: [error: Error];
  close: [];
}

export interface SessionDeps {
  transcribeStream?: TranscribeStream;
  playwrightPool?: PlaywrightPool;
  structuringDeps?: StructuringDependencies;
  illustrationDeps?: IllustrationDependencies;
}

const UPDATE_CHAR_THRESHOLD = 500;

const INTERIM_SYSTEM_PROMPT = `あなたは講演の内容をグラフィックレコーディング用に構造化するアシスタントです。
これはリアルタイムストリーミング中の途中テキストです。講演はまだ続いています。

# 厳守ルール
1. 捏造禁止：テキストに含まれていない内容を絶対に追加しない
2. 短文化：各テキストは目安40文字以内（日本語）
3. titleは30文字以内（講演テーマを推定）
4. mainMessageは80文字以内
5. blocksは現時点で抽出できる分だけ（1〜4個）
6. speechBubblesは印象的な発言があれば抽出（0〜4個、なければ空配列）
7. actionsは具体的なものが見えていれば抽出（0〜3個、なければ空配列）
8. 専門用語は元の表現をそのまま使用
9. まだ途中のため、完璧を目指さず現時点の要約に集中する`;

export class StreamingSession extends EventEmitter<SessionEvents> {
  private config: Config;
  private transcribeStream: TranscribeStream;
  private playwrightPool: PlaywrightPool;
  private structuringDeps: StructuringDependencies;
  private illustrationDeps: IllustrationDependencies;

  private accumulatedText = '';
  private lastStructuredLength = 0;
  private structuring = false;
  private pendingRetrigger = false;
  private interimPromise: Promise<void> | null = null;

  constructor(config: Config, deps?: SessionDeps) {
    super();
    this.config = config;
    this.transcribeStream =
      deps?.transcribeStream ?? new TranscribeStream(config.aws.region);
    this.playwrightPool = deps?.playwrightPool ?? new PlaywrightPool();
    this.structuringDeps = deps?.structuringDeps ?? {};
    this.illustrationDeps = deps?.illustrationDeps ?? {};
  }

  async start(): Promise<void> {
    this.emit('status', 'セッション開始');

    this.transcribeStream.on('partial', (text) => {
      this.emit('transcript_partial', text);
    });

    this.transcribeStream.on('final', (text) => {
      this.accumulatedText += text;
      this.emit('transcript_final', text);
      this.checkUpdateTrigger();
    });

    this.transcribeStream.on('error', (err) => {
      this.emit('error', err);
    });

    await this.transcribeStream.start();
  }

  feedAudio(chunk: Buffer | Uint8Array): void {
    this.transcribeStream.feedAudio(chunk);
  }

  async end(): Promise<void> {
    this.emit('status', '最終版を生成中...');
    this.transcribeStream.close();

    // 進行中の interim 構造化が完了するのを待つ
    if (this.interimPromise) {
      await this.interimPromise;
    }

    if (!this.accumulatedText) {
      this.emit('close');
      return;
    }

    try {
      // 最終版は厳格スキーマ（既存の structureTranscript）を使用
      const structured = await structureTranscript(
        this.accumulatedText,
        this.config,
        this.structuringDeps,
      );

      // 最終版でのみイラスト生成
      let illustrations: Map<number, string> | undefined;
      if (this.config.illustration.enabled) {
        illustrations = await generateBlockIcons(
          structured,
          this.config,
          this.illustrationDeps,
        );
      }

      const html = renderToHtml(structured, { illustrations });
      const png = await this.playwrightPool.renderHtmlToPng(html);
      this.emit('graphic_final', png);
    } catch (err) {
      this.emit(
        'error',
        err instanceof Error ? err : new Error(String(err)),
      );
    } finally {
      this.emit('close');
    }
  }

  private checkUpdateTrigger(): void {
    const newChars = this.accumulatedText.length - this.lastStructuredLength;
    if (newChars < UPDATE_CHAR_THRESHOLD) return;

    if (this.structuring) {
      this.pendingRetrigger = true;
      return;
    }

    this.interimPromise = this.triggerInterimUpdate();
  }

  private async triggerInterimUpdate(): Promise<void> {
    this.structuring = true;
    const prevLength = this.lastStructuredLength;
    this.lastStructuredLength = this.accumulatedText.length;

    try {
      const interim = await this.structureInterim(this.accumulatedText);
      const full = this.interimToStructured(interim);
      // 中間更新ではイラスト生成をスキップ（高速化のため）
      const html = renderToHtml(full);
      const png = await this.playwrightPool.renderHtmlToPng(html);
      this.emit('graphic_update', png);
    } catch (err) {
      // 失敗時はロールバックして再試行可能にする
      this.lastStructuredLength = prevLength;
      this.emit(
        'error',
        err instanceof Error ? err : new Error(String(err)),
      );
    } finally {
      this.structuring = false;
      if (this.pendingRetrigger) {
        this.pendingRetrigger = false;
        this.checkUpdateTrigger();
      }
    }
  }

  private async structureInterim(
    text: string,
  ): Promise<InterimStructuredContent> {
    // Bedrockを呼び出し、interimスキーマでバリデーション
    const config = { ...this.config };
    const client =
      this.structuringDeps.client ??
      (await import('@aws-sdk/client-bedrock-runtime')).BedrockRuntimeClient;
    const bedrockClient =
      this.structuringDeps.client ??
      new (client as any)({ region: config.bedrock.region });
    const { ConverseCommand } = await import(
      '@aws-sdk/client-bedrock-runtime'
    );
    const { getInterimStructuredContentJsonSchema } = await import(
      '../types/structured-content.js'
    );

    const command = new ConverseCommand({
      modelId: config.bedrock.modelId,
      system: [{ text: INTERIM_SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `以下は講演の途中テキストです（リアルタイム文字起こし中）。現時点の内容を構造化してください。\n\n${text}`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: 'structured_output',
              description: '講演の構造化データを出力する（途中版）',
              inputSchema: {
                json: getInterimStructuredContentJsonSchema() as any,
              },
            },
          },
        ],
        toolChoice: { tool: { name: 'structured_output' } },
      },
    });

    const response = await bedrockClient.send(command);
    const content = (response.output?.message?.content ?? []) as any[];
    let toolInput: unknown;
    for (const item of content) {
      if (item.toolUse?.input) {
        toolInput = item.toolUse.input;
        break;
      }
    }
    if (!toolInput) {
      throw new Error('Interim構造化: toolUse inputが見つかりません');
    }

    return interimStructuredContentSchema.parse(toolInput);
  }

  /** interimスキーマの結果を、renderToHtml に渡せる完全な StructuredContent に変換する */
  interimToStructured(interim: InterimStructuredContent): StructuredContent {
    // blocks: 3個未満なら空ブロックで補完
    const blocks = [...interim.blocks];
    while (blocks.length < 3) {
      blocks.push({ heading: '...', bullets: [{ text: '...' }] });
    }

    // speechBubbles: 1個未満なら空で補完
    const speechBubbles = [...interim.speechBubbles];
    if (speechBubbles.length === 0) {
      speechBubbles.push({ quote: '...' });
    }

    // actions: 3個未満なら空で補完
    const actions = [...interim.actions];
    while (actions.length < 3) {
      actions.push({ text: '...' });
    }
    // 3個に切り詰め
    actions.length = 3;

    return structuredContentSchema.parse({
      title: interim.title,
      mainMessage: interim.mainMessage,
      blocks,
      speechBubbles,
      actions,
    });
  }
}
