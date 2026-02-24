import { describe, it, expect, vi } from 'vitest';
import { StreamingSession } from '../../src/streaming/session.js';
import type { Config } from '../../src/config/index.js';
import type { InterimStructuredContent } from '../../src/types/structured-content.js';

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
    renderHtmlToPng: vi.fn().mockResolvedValue('base64png'),
    destroy: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('StreamingSession', () => {
  it('start() で TranscribeStream を開始する', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    const statuses: string[] = [];
    session.on('status', (msg) => statuses.push(msg));

    await session.start();

    expect(ts.start).toHaveBeenCalledOnce();
    expect(statuses).toContain('セッション開始');
  });

  it('feedAudio() でチャンクを TranscribeStream に転送する', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    await session.start();

    const chunk = Buffer.alloc(3200);
    session.feedAudio(chunk);

    expect(ts.feedAudio).toHaveBeenCalledWith(chunk);
  });

  it('final result で transcript_final を emit する', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    const finals: string[] = [];
    session.on('transcript_final', (text) => finals.push(text));

    await session.start();
    ts.emit('final', 'テスト文字起こし');

    expect(finals).toEqual(['テスト文字起こし']);
  });

  it('end() で最終版 PNG を生成する', async () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const mockBedrockClient = {
      send: vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [
              {
                toolUse: {
                  input: {
                    title: 'テスト講演',
                    mainMessage: 'テストメッセージです',
                    blocks: [
                      { heading: 'ブロック1', bullets: [{ text: '項目1' }] },
                      { heading: 'ブロック2', bullets: [{ text: '項目2' }] },
                      { heading: 'ブロック3', bullets: [{ text: '項目3' }] },
                    ],
                    speechBubbles: [{ quote: '名言', emphasis: 'important' }],
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

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
      structuringDeps: { client: mockBedrockClient as any },
    });

    const pngs: string[] = [];
    session.on('graphic_final', (png) => pngs.push(png));

    const closePromise = new Promise<void>((resolve) =>
      session.on('close', resolve),
    );

    await session.start();
    // テキストを蓄積
    ts.emit('final', 'テスト文字起こし内容');
    await session.end();
    await closePromise;

    expect(pngs).toHaveLength(1);
    expect(pool.renderHtmlToPng).toHaveBeenCalled();
  });

  it('interimToStructured でプレースホルダ補完する', () => {
    const ts = createMockTranscribeStream();
    const pool = createMockPool();

    const session = new StreamingSession(mockConfig, {
      transcribeStream: ts,
      playwrightPool: pool,
    });

    const interim: InterimStructuredContent = {
      title: 'テスト',
      mainMessage: 'テストメッセージ',
      blocks: [{ heading: '見出し1', bullets: [{ text: '項目1' }] }],
      speechBubbles: [],
      actions: [],
    };

    const result = session.interimToStructured(interim);

    // blocks は 3 個に補完される
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[1].heading).toBe('...');
    // speechBubbles は 1 個に補完される
    expect(result.speechBubbles).toHaveLength(1);
    // actions は 3 個に補完される
    expect(result.actions).toHaveLength(3);
  });
});
