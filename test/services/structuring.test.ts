import { describe, expect, test, vi } from 'vitest';
import { structureTranscript } from '../../src/services/structuring.js';
import type { Config } from '../../src/config/index.js';

const config: Config = {
  aws: { region: 'ap-northeast-1', s3Bucket: 'dummy', s3KeyPrefix: 'talkcapital' },
  llm: { provider: 'bedrock' },
  bedrock: { region: 'us-east-1', modelId: 'model' },
  output: { scale: 2 },
};

const openRouterConfig: Config = {
  aws: { region: 'ap-northeast-1', s3Bucket: 'dummy', s3KeyPrefix: 'talkcapital' },
  llm: { provider: 'openrouter' },
  bedrock: { region: 'us-east-1', modelId: 'model' },
  openrouter: {
    apiKey: 'test-key',
    model: 'openrouter/model',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  output: { scale: 2 },
};

describe('structuring service', () => {
  test('toolUseからStructuredContentを返す', async () => {
    const send = vi.fn().mockResolvedValue({
      output: {
        message: {
          content: [
            {
              toolUse: {
                input: {
                  title: 'タイトル',
                  mainMessage: '最重要メッセージ',
                  blocks: [
                    { heading: 'h1', bullets: [{ text: 'b1' }] },
                    { heading: 'h2', bullets: [{ text: 'b2' }] },
                    { heading: 'h3', bullets: [{ text: 'b3' }] },
                  ],
                  speechBubbles: [{ quote: 'q1' }],
                  actions: [{ text: 'a1' }, { text: 'a2' }, { text: 'a3' }],
                },
              },
            },
          ],
        },
      },
    });

    const result = await structureTranscript('transcript', config, { client: { send } as any });
    expect(result.title).toBe('タイトル');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('1回目失敗時にリトライして成功する', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ output: { message: { content: [{ toolUse: { input: { invalid: true } } }] } } })
      .mockResolvedValueOnce({
        output: {
          message: {
            content: [
              {
                toolUse: {
                  input: {
                    title: 'タイトル',
                    mainMessage: '最重要メッセージ',
                    blocks: [
                      { heading: 'h1', bullets: [{ text: 'b1' }] },
                      { heading: 'h2', bullets: [{ text: 'b2' }] },
                      { heading: 'h3', bullets: [{ text: 'b3' }] },
                    ],
                    speechBubbles: [{ quote: 'q1' }],
                    actions: [{ text: 'a1' }, { text: 'a2' }, { text: 'a3' }],
                  },
                },
              },
            ],
          },
        },
      });

    const result = await structureTranscript('transcript', config, { client: { send } as any });
    expect(result.actions).toHaveLength(3);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('openrouter経由でStructuredContentを返す', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'タイトル',
                mainMessage: '最重要メッセージ',
                blocks: [
                  { heading: 'h1', bullets: [{ text: 'b1' }] },
                  { heading: 'h2', bullets: [{ text: 'b2' }] },
                  { heading: 'h3', bullets: [{ text: 'b3' }] },
                ],
                speechBubbles: [{ quote: 'q1' }],
                actions: [{ text: 'a1' }, { text: 'a2' }, { text: 'a3' }],
              }),
            },
          },
        ],
      }),
    });

    const result = await structureTranscript('transcript', openRouterConfig, { fetchImpl: fetchImpl as any });
    expect(result.title).toBe('タイトル');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('openrouterで1回目失敗時にリトライして成功する', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"invalid":true}' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'タイトル',
                  mainMessage: '最重要メッセージ',
                  blocks: [
                    { heading: 'h1', bullets: [{ text: 'b1' }] },
                    { heading: 'h2', bullets: [{ text: 'b2' }] },
                    { heading: 'h3', bullets: [{ text: 'b3' }] },
                  ],
                  speechBubbles: [{ quote: 'q1' }],
                  actions: [{ text: 'a1' }, { text: 'a2' }, { text: 'a3' }],
                }),
              },
            },
          ],
        }),
      });

    const result = await structureTranscript('transcript', openRouterConfig, { fetchImpl: fetchImpl as any });
    expect(result.actions).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
