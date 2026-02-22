import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscribeStream } from '../../src/streaming/transcribe-stream.js';

function createMockClient(resultStream: AsyncIterable<any>) {
  return {
    send: vi.fn().mockResolvedValue({
      TranscriptResultStream: resultStream,
    }),
    destroy: vi.fn(),
    config: {},
    middlewareStack: { add: vi.fn(), clone: vi.fn() },
  } as any;
}

async function* makeResultStream(events: any[]): AsyncIterable<any> {
  for (const event of events) {
    yield event;
  }
}

describe('TranscribeStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('partial result を emit する', async () => {
    const events = [
      {
        TranscriptEvent: {
          Transcript: {
            Results: [
              {
                IsPartial: true,
                Alternatives: [{ Transcript: '心理的' }],
              },
            ],
          },
        },
      },
    ];

    const client = createMockClient(makeResultStream(events));
    const stream = new TranscribeStream('ap-northeast-1', { client });

    const partials: string[] = [];
    stream.on('partial', (text) => partials.push(text));

    const closePromise = new Promise<void>((resolve) =>
      stream.on('close', resolve),
    );

    await stream.start();
    stream.close();
    await closePromise;

    expect(partials).toEqual(['心理的']);
  });

  it('final result を emit する', async () => {
    const events = [
      {
        TranscriptEvent: {
          Transcript: {
            Results: [
              {
                IsPartial: false,
                Alternatives: [{ Transcript: '心理的安全性とは' }],
              },
            ],
          },
        },
      },
    ];

    const client = createMockClient(makeResultStream(events));
    const stream = new TranscribeStream('ap-northeast-1', { client });

    const finals: string[] = [];
    stream.on('final', (text) => finals.push(text));

    const closePromise = new Promise<void>((resolve) =>
      stream.on('close', resolve),
    );

    await stream.start();
    stream.close();
    await closePromise;

    expect(finals).toEqual(['心理的安全性とは']);
  });

  it('feedAudio でPCMチャンクを送信できる', async () => {
    const events: any[] = [];
    const client = createMockClient(makeResultStream(events));
    const stream = new TranscribeStream('ap-northeast-1', { client });

    const closePromise = new Promise<void>((resolve) =>
      stream.on('close', resolve),
    );

    await stream.start();

    // feedAudio はエラーなく呼べる
    const chunk = Buffer.alloc(3200); // 100ms of 16kHz 16-bit mono
    stream.feedAudio(chunk);
    stream.close();
    await closePromise;

    expect(client.send).toHaveBeenCalledOnce();
  });

  it('ストリームエラー時に error を emit する', async () => {
    const events = [
      {
        BadRequestException: {
          Message: 'Invalid audio format',
        },
      },
    ];

    const client = createMockClient(makeResultStream(events));
    const stream = new TranscribeStream('ap-northeast-1', { client });

    const errors: Error[] = [];
    stream.on('error', (err) => errors.push(err));

    const closePromise = new Promise<void>((resolve) =>
      stream.on('close', resolve),
    );

    await stream.start();
    stream.close();
    await closePromise;

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('BadRequest');
  });

  it('close 後に feedAudio しても書き込まれない', async () => {
    const events: any[] = [];
    const client = createMockClient(makeResultStream(events));
    const stream = new TranscribeStream('ap-northeast-1', { client });

    const closePromise = new Promise<void>((resolve) =>
      stream.on('close', resolve),
    );

    await stream.start();
    stream.close();
    await closePromise;

    // close 後の feedAudio はエラーにならない（無視される）
    expect(() => stream.feedAudio(Buffer.alloc(100))).not.toThrow();
  });
});
