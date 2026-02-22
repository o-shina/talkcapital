import { beforeEach, describe, expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { transcribeAudio } from '../../src/services/transcription.js';
import type { Config } from '../../src/config/index.js';

const config: Config = {
  aws: { region: 'ap-northeast-1', s3Bucket: 'bucket', s3KeyPrefix: 'prefix' },
  bedrock: { region: 'us-east-1', modelId: 'model' },
  output: { scale: 2 },
};

describe('transcription service', () => {
  let audioPath: string;

  beforeEach(async () => {
    audioPath = join(tmpdir(), `test-${Date.now()}.mp3`);
    await writeFile(audioPath, Buffer.from([0x00, 0x01, 0x02]));
  });

  test('正常系: transcriptを返す', async () => {
    const s3Send = vi.fn().mockResolvedValue({});
    const transcribeSend = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: 'COMPLETED',
          Transcript: { TranscriptFileUri: 'https://example.com/result.json' },
        },
      });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: { transcripts: [{ transcript: '文字起こし結果' }] } }),
    });

    const text = await transcribeAudio(audioPath, config, {
      s3Client: { send: s3Send } as any,
      transcribeClient: { send: transcribeSend } as any,
      wait: async () => undefined,
      fetchImpl: fetchImpl as any,
    });

    expect(text).toBe('文字起こし結果');
    expect(s3Send).toHaveBeenCalled();
    expect(transcribeSend).toHaveBeenCalledTimes(2);
  });

  test('異常系: FAILEDでエラー', async () => {
    const transcribeSend = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: 'FAILED',
          FailureReason: 'bad audio',
        },
      });

    await expect(
      transcribeAudio(audioPath, config, {
        s3Client: { send: vi.fn().mockResolvedValue({}) } as any,
        transcribeClient: { send: transcribeSend } as any,
        wait: async () => undefined,
      }),
    ).rejects.toThrow('Transcribeジョブ失敗');
  });
});
