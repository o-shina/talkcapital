import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Config } from '../config/index.js';
import {
  getStructuredContentJsonSchema,
  structuredContentSchema,
  type StructuredContent,
} from '../types/structured-content.js';

export interface StructuringDependencies {
  client?: Pick<BedrockRuntimeClient, 'send'>;
  fetchImpl?: typeof fetch;
}

export async function structureTranscript(
  transcript: string,
  config: Config,
  deps: StructuringDependencies = {},
): Promise<StructuredContent> {
  if (config.llm.provider === 'openrouter') {
    return structureWithOpenRouter(transcript, config, deps.fetchImpl ?? fetch);
  }
  return structureWithBedrock(transcript, config, deps.client);
}

async function structureWithBedrock(
  transcript: string,
  config: Config,
  clientOverride?: Pick<BedrockRuntimeClient, 'send'>,
): Promise<StructuredContent> {
  const client = clientOverride ?? new BedrockRuntimeClient({ region: config.bedrock.region });

  let retryContext = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const command = new ConverseCommand({
      modelId: config.bedrock.modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `以下は講演の文字起こしです。要件に従って構造化してください。\n\n${transcript}${retryContext}`,
            },
          ],
        },
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: 'structured_output',
              description: '講演の構造化データを出力する',
              inputSchema: {
                json: getStructuredContentJsonSchema() as import('@smithy/types').DocumentType,
              },
            },
          },
        ],
        toolChoice: { tool: { name: 'structured_output' } },
      },
    });

    try {
      const response = await client.send(command);
      const toolInput = extractToolUseInput((response.output?.message?.content ?? []) as unknown[]);
      const parsed = structuredContentSchema.parse(toolInput);
      return parsed;
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      retryContext = `\n\n前回の出力はスキーマ検証に失敗しました。エラーを修正して再出力してください: ${String(error)}`;
    }
  }

  throw new Error('構造化処理に失敗しました');
}

async function structureWithOpenRouter(
  transcript: string,
  config: Config,
  fetchImpl: typeof fetch,
): Promise<StructuredContent> {
  const openrouter = config.openrouter;
  if (!openrouter) {
    throw new Error('OpenRouter設定が見つかりません');
  }

  let retryContext = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(`${openrouter.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouter.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openrouter.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `以下は講演の文字起こしです。要件に従って構造化してください。\n\n${transcript}${retryContext}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'structured_output',
              strict: true,
              schema: getStructuredContentJsonSchema(),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const rawContent = extractOpenRouterContent(data);
      const parsedContent = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
      return structuredContentSchema.parse(parsedContent);
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      retryContext = `\n\n前回の出力はスキーマ検証に失敗しました。エラーを修正して再出力してください: ${String(error)}`;
    }
  }

  throw new Error('OpenRouter構造化処理に失敗しました');
}

function extractOpenRouterContent(data: Record<string, unknown>): unknown {
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('OpenRouterレスポンスにchoicesがありません');
  }

  const firstChoice = choices[0] as Record<string, unknown>;
  const message = firstChoice.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content === 'undefined') {
    throw new Error('OpenRouterレスポンスにmessage.contentがありません');
  }
  return content;
}

function extractToolUseInput(content: unknown[]): unknown {
  for (const item of content) {
    const block = item as Record<string, unknown>;
    const toolUse = block.toolUse as Record<string, unknown> | undefined;
    if (toolUse && toolUse.input) {
      return toolUse.input;
    }
  }
  throw new Error('BedrockレスポンスにtoolUse inputが含まれていません');
}

const SYSTEM_PROMPT = `あなたは講演の内容をグラフィックレコーディング用に構造化するアシスタントです。

# 厳守ルール
1. 捏造禁止：講演で話されていない事実・固有の断定を絶対に追加しない。不明な点は一般化するか空欄にする
2. 短文化：各テキストは目安40文字以内（日本語）
3. titleは30文字以内
4. mainMessageは80文字以内（最も重要な1行）
5. blocksは3〜4個、各blockのbulletsは1〜3個
6. speechBubblesは1〜4個（講演者の印象的な発言をそのまま抽出）
7. actionsは必ず3個（「今日からできる」具体的アクション）
8. 専門用語は講演で使われていた表現をそのまま使用
9. 情報を詰め込みすぎない。余白を意識し、重要度の高い内容のみ抽出
10. 各blockにimportanceを付与する。講演で最も強調・時間を割いていたテーマを"high"、補足的なテーマを"low"、その他を"medium"とする。highは最大1個
11. 各blockにrelationToNextを付与する（最後のblockは除く）。次のブロックとの関係性:
    - "causes": このトピックが次の原因・前提
    - "contrasts": 次と対比的
    - "supports": 次を補強
    - "builds-on": 次がこのトピックの発展
    - "independent": 特に関係なし`;
