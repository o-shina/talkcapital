import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Config } from '../config/index.js';
import type { StructuredContent } from '../types/structured-content.js';

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
      const imageBase64 = await invokeImageModel(client, config.illustration.modelId, prompt, size);
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

function buildIconPrompt(heading: string): string {
  return `Cute hand-drawn watercolor doodle illustration of "${heading}". Soft pastel colors, simple shapes, white background. Children's book illustration style. No text, no words, no letters, no characters.`;
}

const NEGATIVE_TEXT = 'text, words, letters, alphabet, numbers, kanji, hiragana, katakana, writing, caption, label, watermark, signature';

async function invokeImageModel(
  client: Pick<BedrockRuntimeClient, 'send'>,
  modelId: string,
  prompt: string,
  size: number,
): Promise<string> {
  if (modelId.startsWith('amazon.nova-canvas')) {
    return invokeNovaCanvas(client, modelId, prompt, size);
  }

  if (modelId.startsWith('stability.')) {
    return invokeStabilityModel(client, modelId, prompt, size);
  }

  throw new Error(`未対応の画像生成モデル: ${modelId}`);
}

async function invokeNovaCanvas(
  client: Pick<BedrockRuntimeClient, 'send'>,
  modelId: string,
  prompt: string,
  size: number,
): Promise<string> {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt,
        negativeText: NEGATIVE_TEXT,
      },
      imageGenerationConfig: {
        width: size,
        height: size,
        numberOfImages: 1,
        quality: 'standard',
      },
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
  size: number,
): Promise<string> {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      text_prompts: [
        { text: prompt, weight: 1 },
        { text: NEGATIVE_TEXT, weight: -1 },
      ],
      cfg_scale: 7,
      steps: 30,
      width: size,
      height: size,
    }),
  });

  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    artifacts?: Array<{ base64: string; finishReason: string }>;
  };

  if (!body.artifacts || body.artifacts.length === 0) {
    throw new Error('Stability AI からの画像レスポンスが空です');
  }
  return body.artifacts[0].base64;
}
