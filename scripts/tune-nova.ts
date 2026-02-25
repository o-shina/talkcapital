/**
 * Nova Canvas プロンプトチューニング用スクリプト
 *
 * 使い方:
 *   npx tsx scripts/tune-nova.ts              # Claude でプロンプト生成 → Nova Canvas で画像生成
 *   npx tsx scripts/tune-nova.ts --tag v8     # タグ付きで出力
 *   npx tsx scripts/tune-nova.ts --no-open    # プレビューを開かない
 *   npx tsx scripts/tune-nova.ts --prompt-only # プロンプト生成のみ（画像生成しない）
 */

import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { buildImagePrompt } from '../src/services/prompt-builder.js';
import { generateBackgroundImage } from '../src/services/illustration.js';
import type { Config } from '../src/config/index.js';
import type { StructuredContent } from '../src/types/structured-content.js';

loadDotEnv();

const CONFIG = {
  width: 2560,
  height: 1440,
  quality: 'standard' as 'standard' | 'premium',
  seed: 42,
};

async function main() {
  const args = process.argv.slice(2);
  const tagIdx = args.indexOf('--tag');
  const tag = tagIdx >= 0 ? args[tagIdx + 1] : `${Date.now()}`;
  const noOpen = args.includes('--no-open');
  const promptOnly = args.includes('--prompt-only');

  // 1. サンプルデータ読み込み
  const fixturePath = join(import.meta.dirname, '..', 'test', 'fixtures', 'sample-structured.json');
  const content: StructuredContent = JSON.parse(await readFile(fixturePath, 'utf8'));

  console.log('=== Step 1: StructuredContent ===');
  console.log(`Title: ${content.title}`);
  console.log(`Blocks: ${content.blocks.map(b => b.heading).join(', ')}`);

  // 2. Claude でプロンプト生成
  console.log('\n=== Step 2: Claude でプロンプト生成 ===');
  const config: Config = {
    aws: { region: 'ap-northeast-1', s3Bucket: 'dummy', s3KeyPrefix: 'dummy' },
    llm: { provider: 'bedrock' },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      region: process.env.BEDROCK_REGION ?? 'us-east-1',
    },
    output: { scale: 2 },
    illustration: { enabled: true, modelId: 'amazon.nova-canvas-v1:0', region: 'us-east-1', iconSize: 512 },
  };
  const startPrompt = Date.now();
  const { prompt, negativePrompt } = await buildImagePrompt(content, config);
  const promptElapsed = Date.now() - startPrompt;

  console.log(`Done in ${(promptElapsed / 1000).toFixed(1)}s`);
  console.log(`\nPROMPT (${prompt.length} chars):\n${prompt}\n`);
  console.log(`NEGATIVE (${negativePrompt.length} chars):\n${negativePrompt}\n`);

  if (promptOnly) {
    return;
  }

  // 3. Nova Canvas で画像生成
  const outputPath = `/tmp/talkcapital-tune-${tag}.png`;
  const region = process.env.BEDROCK_IMAGE_REGION ?? 'us-east-1';

  console.log('=== Step 3: Nova Canvas で画像生成 ===');
  console.log(`Config: ${CONFIG.width}x${CONFIG.height}, quality=${CONFIG.quality}, seed=${CONFIG.seed}`);
  console.log(`Output: ${outputPath}`);
  console.log('Generating...');

  const startImage = Date.now();
  const base64 = await generateBackgroundImage(
    prompt,
    'amazon.nova-canvas-v1:0',
    region,
    {
      width: CONFIG.width,
      height: CONFIG.height,
      negativeText: negativePrompt,
      quality: CONFIG.quality,
      seed: CONFIG.seed,
    },
  );
  const imageElapsed = Date.now() - startImage;

  const buf = Buffer.from(base64, 'base64');
  await writeFile(outputPath, buf);

  console.log(`Done in ${(imageElapsed / 1000).toFixed(1)}s (${(buf.length / 1024).toFixed(0)} KB)`);
  console.log(`\nTotal: prompt ${(promptElapsed / 1000).toFixed(1)}s + image ${(imageElapsed / 1000).toFixed(1)}s = ${((promptElapsed + imageElapsed) / 1000).toFixed(1)}s`);

  if (!noOpen) {
    execFile('open', [outputPath], (err) => {
      if (err) console.error('Failed to open preview:', err.message);
    });
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
