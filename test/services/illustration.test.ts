import { describe, expect, test, vi } from 'vitest';
import { generateBlockIcons, generateBackgroundImage } from '../../src/services/illustration.js';
import type { Config } from '../../src/config/index.js';
import type { StructuredContent } from '../../src/types/structured-content.js';

function makeMockClient(responseBody: unknown) {
  return {
    send: vi.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify(responseBody)),
    }),
  };
}

const sampleContent: StructuredContent = {
  title: 'テスト',
  mainMessage: 'テストメッセージ',
  blocks: [
    { heading: 'ブロック1', bullets: [{ text: '箇条書き1' }] },
    { heading: 'ブロック2', bullets: [{ text: '箇条書き2' }] },
    { heading: 'ブロック3', bullets: [{ text: '箇条書き3' }] },
  ],
  speechBubbles: [{ quote: '引用', emphasis: 'important' }],
  actions: [{ text: 'アクション1' }, { text: 'アクション2' }, { text: 'アクション3' }],
};

function makeConfig(modelId: string): Config {
  return {
    aws: { region: 'ap-northeast-1', s3Bucket: 'test', s3KeyPrefix: 'test' },
    llm: { provider: 'bedrock' },
    bedrock: { modelId: 'anthropic.claude-sonnet-4-20250514-v1:0', region: 'us-east-1' },
    output: { scale: 2 },
    illustration: { enabled: true, mode: 'icons' as const, modelId, region: 'us-east-1', iconSize: 512 },
  };
}

describe('illustration', () => {
  describe('Nova Canvas', () => {
    test('generateBlockIcons で画像が生成される', async () => {
      const client = makeMockClient({ images: ['base64data'] });
      const config = makeConfig('amazon.nova-canvas-v1:0');
      const result = await generateBlockIcons(sampleContent, config, { client });

      expect(result.size).toBe(3);
      expect(result.get(0)).toBe('data:image/png;base64,base64data');

      const sentBody = JSON.parse(client.send.mock.calls[0][0].input.body);
      expect(sentBody.taskType).toBe('TEXT_IMAGE');
      expect(sentBody.textToImageParams.text).toContain('ブロック1');
      expect(sentBody.textToImageParams.negativeText).toBeTruthy();
      expect(sentBody.imageGenerationConfig.width).toBe(512);
      expect(sentBody.imageGenerationConfig.height).toBe(512);
    });

    test('generateBackgroundImage で 3840x2160 画像が生成される', async () => {
      const client = makeMockClient({ images: ['bg-base64'] });
      const result = await generateBackgroundImage(
        'test prompt',
        'amazon.nova-canvas-v1:0',
        'us-east-1',
        { width: 3840, height: 2160 },
        { client },
      );

      expect(result).toBe('bg-base64');
      const sentBody = JSON.parse(client.send.mock.calls[0][0].input.body);
      expect(sentBody.imageGenerationConfig.width).toBe(3840);
      expect(sentBody.imageGenerationConfig.height).toBe(2160);
    });

    test('画像レスポンスが空の場合エラー', async () => {
      const client = makeMockClient({ images: [] });
      const config = makeConfig('amazon.nova-canvas-v1:0');

      await expect(
        generateBlockIcons(sampleContent, config, { client }),
      ).resolves.toEqual(new Map());
      // エラーは stderr に出力されるが、generateBlockIcons は null を返して Map に含めない
    });
  });

  describe('SD 3.5 Large', () => {
    test('generateBlockIcons で画像が生成される', async () => {
      const client = makeMockClient({ images: ['sd-base64'], seeds: [12345], finish_reasons: [null] });
      const config = makeConfig('stability.sd3-5-large-v1:0');
      const result = await generateBlockIcons(sampleContent, config, { client });

      expect(result.size).toBe(3);
      expect(result.get(0)).toBe('data:image/png;base64,sd-base64');

      const sentBody = JSON.parse(client.send.mock.calls[0][0].input.body);
      expect(sentBody.prompt).toContain('ブロック1');
      expect(sentBody.negative_prompt).toBeTruthy();
      expect(sentBody.aspect_ratio).toBe('1:1');
      expect(sentBody.output_format).toBe('png');
      // 旧SDXL形式のフィールドがないことを確認
      expect(sentBody.text_prompts).toBeUndefined();
      expect(sentBody.cfg_scale).toBeUndefined();
    });

    test('generateBackgroundImage で 16:9 画像が生成される', async () => {
      const client = makeMockClient({ images: ['bg-sd-base64'], seeds: [99], finish_reasons: [null] });
      const result = await generateBackgroundImage(
        'test prompt',
        'stability.sd3-5-large-v1:0',
        'us-east-1',
        { aspectRatio: '16:9' },
        { client },
      );

      expect(result).toBe('bg-sd-base64');
      const sentBody = JSON.parse(client.send.mock.calls[0][0].input.body);
      expect(sentBody.aspect_ratio).toBe('16:9');
    });

    test('フィルターでブロックされた場合エラー', async () => {
      const client = makeMockClient({ finish_reasons: ['Filter reason: prompt'] });

      await expect(
        generateBackgroundImage('bad prompt', 'stability.sd3-5-large-v1:0', 'us-east-1', {}, { client }),
      ).rejects.toThrow('画像レスポンスが空です');
    });
  });

  test('未対応モデルIDでエラー', async () => {
    const client = makeMockClient({});

    await expect(
      generateBackgroundImage('test', 'unknown.model-v1:0', 'us-east-1', {}, { client }),
    ).rejects.toThrow('未対応の画像生成モデル');
  });

  test('illustration.enabled が false の場合は空の Map を返す', async () => {
    const config = makeConfig('amazon.nova-canvas-v1:0');
    config.illustration.enabled = false;
    const result = await generateBlockIcons(sampleContent, config);
    expect(result.size).toBe(0);
  });
});
