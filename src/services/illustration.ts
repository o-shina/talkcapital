import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Config } from '../config/index.js';
import type { StructuredContent } from '../types/structured-content.js';
import type { BlockImagePromptResult } from './prompt-builder.js';

export interface IllustrationDependencies {
  client?: Pick<BedrockRuntimeClient, 'send'>;
}

/**
 * 各ブロックの見出しに基づいて手描き風イラスト画像を生成する。
 * 返り値はブロックインデックス → base64 DataURL のマップ。
 */
export async function generateBlockIcons(
  content: StructuredContent,
  config: Config,
  deps: IllustrationDependencies = {},
): Promise<Map<number, string>> {
  if (!config.illustration.enabled) {
    return new Map();
  }

  const client = deps.client ?? new BedrockRuntimeClient({ region: config.illustration.region });
  const size = Math.max(512, config.illustration.iconSize);

  const tasks = content.blocks.map(async (block, index) => {
    const prompt = buildIconPrompt(block.heading);

    try {
      const imageBase64 = await invokeImageModel(client, config.illustration.modelId, prompt, { width: size, height: size });
      return { index, dataURL: `data:image/png;base64,${imageBase64}` };
    } catch (error) {
      process.stderr.write(`[illustration] block ${index} のアイコン生成に失敗: ${String(error)}\n`);
      return null;
    }
  });

  const results = await Promise.all(tasks);
  const map = new Map<number, string>();
  for (const result of results) {
    if (result) {
      map.set(result.index, result.dataURL);
    }
  }
  return map;
}

/**
 * ブロック単位のゾーン画像を生成する。
 * 各画像は合成時にブロック背景として使用される。
 * 返り値はブロックインデックス → base64 DataURL のマップ。
 */
export async function generateZoneImages(
  prompts: BlockImagePromptResult[],
  config: Config,
  deps: IllustrationDependencies = {},
): Promise<Map<number, string>> {
  if (!config.illustration.enabled) {
    return new Map();
  }

  const client = deps.client ?? new BedrockRuntimeClient({ region: config.illustration.region });
  const modelId = config.illustration.modelId;

  // モデルに応じたサイズ設定
  const isNovaCanvas = modelId.startsWith('amazon.nova-canvas');
  const opts: ImageGenOptions = isNovaCanvas
    ? { width: 1280, height: 640, quality: 'standard' }
    : { aspectRatio: '16:9' };

  const tasks = prompts.map(async (blockPrompt) => {
    try {
      const imageBase64 = await invokeImageModel(client, modelId, blockPrompt.prompt, {
        ...opts,
        negativeText: blockPrompt.negativePrompt,
      });
      return { index: blockPrompt.blockIndex, dataURL: `data:image/png;base64,${imageBase64}` };
    } catch (error) {
      process.stderr.write(`[illustration] block ${blockPrompt.blockIndex} のゾーン画像生成に失敗: ${String(error)}\n`);
      return null;
    }
  });

  const results = await Promise.all(tasks);
  const map = new Map<number, string>();
  for (const result of results) {
    if (result) {
      map.set(result.index, result.dataURL);
    }
  }
  return map;
}

function buildIconPrompt(heading: string): string {
  return `Cute hand-drawn watercolor doodle illustration of "${heading}". Soft pastel colors, simple shapes, white background. Children's book illustration style. No text, no words, no letters, no characters.`;
}

const NEGATIVE_TEXT = 'text, words, letters, alphabet, numbers, kanji, hiragana, katakana, writing, caption, label, watermark, signature';

export interface ImageGenOptions {
  /** Nova Canvas 用: 画像の幅 (px, 16の倍数, 320-4096) */
  width?: number;
  /** Nova Canvas 用: 画像の高さ (px, 16の倍数, 320-4096) */
  height?: number;
  /** SD 3.5 Large 用: アスペクト比 (デフォルト '1:1') */
  aspectRatio?: '16:9' | '1:1' | '21:9' | '2:3' | '3:2' | '4:5' | '5:4' | '9:16' | '9:21';
  /** カスタムネガティブプロンプト（省略時はデフォルトを使用） */
  negativeText?: string;
  /** Nova Canvas 用: 品質 (デフォルト 'standard') */
  quality?: 'standard' | 'premium';
  /** 再現性のためのシード値 (0 = ランダム) */
  seed?: number;
}

/**
 * 背景画像を生成する。
 * 返り値は base64 エンコードされた PNG データ。
 */
export async function generateBackgroundImage(
  prompt: string,
  modelId: string,
  region: string,
  opts: ImageGenOptions = {},
  deps: IllustrationDependencies = {},
): Promise<string> {
  const client = deps.client ?? new BedrockRuntimeClient({ region });
  return invokeImageModel(client, modelId, prompt, opts);
}

async function invokeImageModel(
  client: Pick<BedrockRuntimeClient, 'send'>,
  modelId: string,
  prompt: string,
  opts: ImageGenOptions,
): Promise<string> {
  const negText = opts.negativeText ?? NEGATIVE_TEXT;

  if (modelId.startsWith('amazon.nova-canvas')) {
    return invokeNovaCanvas(client, modelId, prompt, negText, opts.width ?? 1024, opts.height ?? 1024, opts.quality ?? 'standard', opts.seed ?? 0);
  }

  if (modelId.startsWith('stability.')) {
    return invokeStabilityModel(client, modelId, prompt, negText, opts.aspectRatio ?? '1:1');
  }

  throw new Error(`未対応の画像生成モデル: ${modelId}`);
}

async function invokeNovaCanvas(
  client: Pick<BedrockRuntimeClient, 'send'>,
  modelId: string,
  prompt: string,
  negativeText: string,
  width: number,
  height: number,
  quality: 'standard' | 'premium',
  seed: number,
): Promise<string> {
  const imageGenConfig: Record<string, unknown> = {
    width,
    height,
    numberOfImages: 1,
    quality,
  };
  if (seed > 0) {
    imageGenConfig.seed = seed;
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt,
        negativeText: negativeText,
      },
      imageGenerationConfig: imageGenConfig,
    }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    images?: string[];
  };

  if (!body.images || body.images.length === 0) {
    throw new Error('Nova Canvas からの画像レスポンスが空です');
  }
  return body.images[0];
}

async function invokeStabilityModel(
  client: Pick<BedrockRuntimeClient, 'send'>,
  modelId: string,
  prompt: string,
  negativeText: string,
  aspectRatio: string,
): Promise<string> {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      prompt,
      negative_prompt: negativeText,
      aspect_ratio: aspectRatio,
      output_format: 'png',
    }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    images?: string[];
    seeds?: number[];
    finish_reasons?: Array<string | null>;
  };

  if (!body.images || body.images.length === 0) {
    const reason = body.finish_reasons?.[0] ?? 'unknown';
    throw new Error(`Stability AI からの画像レスポンスが空です (reason: ${reason})`);
  }
  return body.images[0];
}
