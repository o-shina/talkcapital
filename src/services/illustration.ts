import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Config } from '../config/index.js';
import type { StructuredContent } from '../types/structured-content.js';
import type { BinaryFileData, BinaryFiles } from '../types/excalidraw.js';
import { nanoid } from 'nanoid';

export interface IllustrationDependencies {
  client?: Pick<BedrockRuntimeClient, 'send'>;
}

/**
 * 各ブロックの見出しに基づいて手描き風アイコン画像を生成する。
 * 返り値はブロックインデックス → BinaryFileData のマップ。
 */
export async function generateBlockIcons(
  content: StructuredContent,
  config: Config,
  deps: IllustrationDependencies = {},
): Promise<BinaryFiles> {
  if (!config.illustration.enabled) {
    return {};
  }

  const client = deps.client ?? new BedrockRuntimeClient({ region: config.illustration.region });
  const size = config.illustration.iconSize;

  const tasks = content.blocks.map(async (block, index) => {
    const fileId = `icon-block-${index}-${nanoid(8)}`;
    const prompt = buildIconPrompt(block.heading);

    try {
      const imageBase64 = await invokeImageModel(client, config.illustration.modelId, prompt, size);
      const data: BinaryFileData = {
        mimeType: 'image/png',
        id: fileId,
        dataURL: `data:image/png;base64,${imageBase64}`,
        created: Date.now(),
      };
      return { index, fileId, data };
    } catch (error) {
      // アイコン生成失敗は致命的ではない。ログして続行
      process.stderr.write(`[illustration] block ${index} のアイコン生成に失敗: ${String(error)}\n`);
      return null;
    }
  });

  const results = await Promise.all(tasks);
  const files: BinaryFiles = {};
  for (const result of results) {
    if (result) {
      files[result.fileId] = result.data;
    }
  }
  return files;
}

/**
 * 生成済み BinaryFiles からブロックインデックスに対応する fileId を取得する。
 * fileId は "icon-block-{index}-" で始まる。
 */
export function getFileIdForBlock(files: BinaryFiles, blockIndex: number): string | undefined {
  const prefix = `icon-block-${blockIndex}-`;
  return Object.keys(files).find((key) => key.startsWith(prefix));
}

function buildIconPrompt(heading: string): string {
  return `Simple hand-drawn doodle icon representing "${heading}". Black line art on white background. Minimalist sketch style. Single object, no text, no words, no letters.`;
}

async function invokeImageModel(
  client: Pick<BedrockRuntimeClient, 'send'>,
  modelId: string,
  prompt: string,
  size: number,
): Promise<string> {
  // Amazon Nova Canvas のリクエスト形式
  if (modelId.startsWith('amazon.nova-canvas')) {
    return invokeNovaCanvas(client, modelId, prompt, size);
  }

  // Stability AI SDXL のリクエスト形式
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
      },
      imageGenerationConfig: {
        width: Math.max(320, size),
        height: Math.max(320, size),
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
        { text: 'text, words, letters, blurry, low quality', weight: -1 },
      ],
      cfg_scale: 7,
      steps: 30,
      width: Math.max(512, size),
      height: Math.max(512, size),
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
