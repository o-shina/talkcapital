import { describe, it, expect, vi } from 'vitest';
import type { Config } from '../../src/config/index.js';
import type { InterimStructuredContent } from '../../src/types/structured-content.js';
import { StreamingSession } from '../../src/streaming/session.js';

const mockConfig: Config = {
  aws: { region: 'ap-northeast-1', s3Bucket: 'test', s3KeyPrefix: 'test' },
  llm: { provider: 'bedrock' as const },
  bedrock: { modelId: 'anthropic.claude-sonnet-4-20250514-v1:0', region: 'us-east-1' },
  output: { scale: 2 },
  illustration: { enabled: false, modelId: 'amazon.nova-canvas-v1:0', region: 'us-east-1', iconSize: 512 },
};

function createMockTranscribeStream() {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
    emit: (event: string, ...args: any[]) => {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    },
    start: vi.fn().mockResolvedValue(undefined),
    feedAudio: vi.fn(),
    close: vi.fn(),
    removeListener: vi.fn(),
    addListener: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    listenerCount: vi.fn(),
    listeners: vi.fn(),
    rawListeners: vi.fn(),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    eventNames: vi.fn(),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn(),
  } as any;
}

function createMockPool() {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    renderHtmlToPng: vi.fn().mockResolvedValue('base64pngdata'),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockBedrockClient() {
  return {
    send: vi.fn().mockResolvedValue({
      output: {
        message: {
          content: [
            {
              toolUse: {
                input: {
                  title: 'テスト講演タイトル',
                  mainMessage: 'テストのメインメッセージです',
                  blocks: [
                    { heading: 'ブロック1', bullets: [{ text: '項目1' }] },
                    { heading: 'ブロック2', bullets: [{ text: '項目2' }] },
                    { heading: 'ブロック3', bullets: [{ text: '項目3' }] },
                  ],
                  speechBubbles: [{ quote: '名言テスト', emphasis: 'important' }],
                  actions: [
                    { text: 'アクション1' },
                    { text: 'アクション2' },
                    { text: 'アクション3' },
                  ],
                },
              },
            },
          ],
        },
      },
    }),
  };
}

describe('統合テスト: StreamingSession フルフロー', () => {
  it('start → transcript蓄積 → end で最終PNG生成まで完了する', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();
    const bedrockClient = createMockBedrockClient();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
      structuringDeps: { client: bedrockClient as any },
    });

    const events: { type: string; value?: string }[] = [];
    session.on('status', (msg) => events.push({ type: 'status', value: msg }));
    session.on('transcript_partial', (text) =>
      events.push({ type: 'transcript_partial', value: text }),
    );
    session.on('transcript_final', (text) =>
      events.push({ type: 'transcript_final', value: text }),
    );
    session.on('graphic_final', (png) =>
      events.push({ type: 'graphic_final', value: png }),
    );
    session.on('error', (err) =>
      events.push({ type: 'error', value: err.message }),
    );

    const closePromise = new Promise<void>((resolve) =>
      session.on('close', resolve),
    );

    // start
    await session.start();
    expect(ts.start).toHaveBeenCalledOnce();
    expect(events.some((e) => e.type === 'status' && e.value === 'セッション開始')).toBe(true);

    // feedAudio
    const chunk = Buffer.alloc(3200);
    session.feedAudio(chunk);
    expect(ts.feedAudio).toHaveBeenCalledWith(chunk);

    // partial transcript
    ts.emit('partial', '心理的');
    expect(events.some((e) => e.type === 'transcript_partial' && e.value === '心理的')).toBe(true);

    // final transcript
    ts.emit('final', '心理的安全性とは組織の中で自分の考えを自由に発言できる状態のことです。');
    expect(
      events.some(
        (e) =>
          e.type === 'transcript_final' &&
          e.value === '心理的安全性とは組織の中で自分の考えを自由に発言できる状態のことです。',
      ),
    ).toBe(true);

    // end → 最終版PNG生成
    await session.end();
    await closePromise;

    // graphic_final が emit されていること
    const graphicFinals = events.filter((e) => e.type === 'graphic_final');
    expect(graphicFinals).toHaveLength(1);
    expect(graphicFinals[0].value).toBe('base64pngdata');

    // エラーがないこと
    const errors = events.filter((e) => e.type === 'error');
    expect(errors).toHaveLength(0);

    // Bedrock が呼ばれていること（最終版の structureTranscript 経由）
    expect(bedrockClient.send).toHaveBeenCalled();

    // PlaywrightPool.renderHtmlToPng が呼ばれていること
    expect(pool.renderHtmlToPng).toHaveBeenCalled();
  });

  it('テキスト蓄積なしで end() した場合、PNGは生成されない', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    const graphicFinals: string[] = [];
    session.on('graphic_final', (png) => graphicFinals.push(png));

    const closePromise = new Promise<void>((resolve) =>
      session.on('close', resolve),
    );

    await session.start();
    await session.end();
    await closePromise;

    // テキストなしなのでPNG生成されない
    expect(graphicFinals).toHaveLength(0);
    expect(pool.renderHtmlToPng).not.toHaveBeenCalled();
  });

  it('interimToStructured が blocks/speechBubbles/actions を補完する', () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    const interim: InterimStructuredContent = {
      title: 'テスト',
      mainMessage: 'メインメッセージ',
      blocks: [
        { heading: '見出し1', bullets: [{ text: '箇条書き1' }] },
        { heading: '見出し2', bullets: [{ text: '箇条書き2' }] },
      ],
      speechBubbles: [{ quote: '名言' }],
      actions: [{ text: 'アクション1' }],
    };

    const result = session.interimToStructured(interim);

    // blocks: 2 → 3 に補完
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[0].heading).toBe('見出し1');
    expect(result.blocks[2].heading).toBe('...');

    // speechBubbles: 1個はそのまま
    expect(result.speechBubbles).toHaveLength(1);
    expect(result.speechBubbles[0].quote).toBe('名言');

    // actions: 1 → 3 に補完
    expect(result.actions).toHaveLength(3);
    expect(result.actions[0].text).toBe('アクション1');
    expect(result.actions[1].text).toBe('...');
    expect(result.actions[2].text).toBe('...');
  });

  it('TranscribeStream のエラーが session の error として伝播する', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    const errors: Error[] = [];
    session.on('error', (err) => errors.push(err));

    await session.start();

    // TranscribeStream がエラーを emit
    ts.emit('error', new Error('Transcribe接続エラー'));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Transcribe接続エラー');
  });
});
