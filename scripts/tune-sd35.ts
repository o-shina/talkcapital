/**
 * SD 3.5 Large プロンプトチューニング用スクリプト
 *
 * 使い方:
 *   npx tsx scripts/tune-sd35.ts              # Claude でプロンプト生成 → SD 3.5 Large で画像生成
 *   npx tsx scripts/tune-sd35.ts --tag v1     # タグ付きで出力
 *   npx tsx scripts/tune-sd35.ts --no-open    # プレビューを開かない
 *   npx tsx scripts/tune-sd35.ts --prompt-only # プロンプト生成のみ（画像生成しない）
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

const MODEL_ID = 'stability.sd3-5-large-v1:0';
const REGION = process.env.BEDROCK_SD_REGION ?? 'us-west-2';

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

  // 2. Claude でプロンプト生成（SD 3.5 Large 向け）
  console.log('\n=== Step 2: Claude でプロンプト生成 (SD 3.5 Large 向け) ===');
  const config: Config = {
    aws: { region: 'ap-northeast-1', s3Bucket: 'dummy', s3KeyPrefix: 'dummy' },
    llm: { provider: 'bedrock' },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      region: process.env.BEDROCK_REGION ?? 'us-east-1',
    },
    output: { scale: 2 },
    illustration: { enabled: true, modelId: MODEL_ID, region: REGION, iconSize: 512 },
  };
  const startPrompt = Date.now();
  const { prompt, negativePrompt } = await buildImagePrompt(content, config, {}, 'sd35-large');
  const promptElapsed = Date.now() - startPrompt;

  console.log(`Done in ${(promptElapsed / 1000).toFixed(1)}s`);
  console.log(`\nPROMPT (${prompt.length} chars):\n${prompt}\n`);
  console.log(`NEGATIVE (${negativePrompt.length} chars):\n${negativePrompt}\n`);

  if (promptOnly) {
    return;
  }

  // 3. SD 3.5 Large で画像生成
  const outputPath = `/tmp/talkcapital-sd35-${tag}.png`;

  console.log(`=== Step 3: SD 3.5 Large で画像生成 ===`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Region: ${REGION}`);
  console.log(`Aspect: 16:9 (max ~1344x756)`);
  console.log(`Output: ${outputPath}`);
  console.log('Generating...');

  const startImage = Date.now();
  const base64 = await generateBackgroundImage(
    prompt,
    MODEL_ID,
    REGION,
    {
      aspectRatio: '16:9',
      negativeText: negativePrompt,
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
