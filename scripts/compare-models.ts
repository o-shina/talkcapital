/**
 * SD 3.5 Large vs Nova Canvas 比較スクリプト
 *
 * Usage:
 *   npx tsx scripts/compare-models.ts
 *
 * 環境変数:
 *   BEDROCK_IMAGE_REGION (default: us-east-1)
 *
 * 出力:
 *   /tmp/talkcapital-nova-canvas.png
 *   /tmp/talkcapital-sd35-large.png
 */

import { writeFile } from 'node:fs/promises';
import { config as loadDotEnv } from 'dotenv';
import { generateBackgroundImage, type ImageGenOptions } from '../src/services/illustration.js';

loadDotEnv();

const novaRegion = process.env.BEDROCK_IMAGE_REGION ?? 'us-east-1';
const sdRegion = process.env.BEDROCK_SD_REGION ?? 'us-west-2';

// サンプルのトピック（sample-structured.json ベース）
const topics = {
  title: 'チームの心理的安全性',
  blockHeadings: ['心理的安全性とは', 'リーダーの役割', '実践のポイント'],
};

function buildBackgroundPrompt(t: typeof topics): string {
  // Nova Canvas のプロンプト上限は 1024 文字
  return [
    'Professional graphic recording on white paper.',
    `Topic: ${t.title}. Themes: ${t.blockHeadings.join(', ')}.`,
    'Layout: title banner top-left, 3-4 content zones in 2x2 grid with colored borders, speech bubbles on right, checklist bottom-right.',
    'Style: hand-drawn markers, colorful borders (blue green purple red), doodle icons (stick figures lightbulbs stars arrows), numbered circles, curved arrows, masking tape corners, warm cheerful whiteboard aesthetic.',
    'NO text, words, letters, numbers. Only visual elements: borders, icons, arrows, decorations. Leave blank spaces for text overlay.',
  ].join(' ');
}

interface ModelConfig {
  name: string;
  modelId: string;
  region: string;
  opts: ImageGenOptions;
}

const models: ModelConfig[] = [
  {
    name: 'Nova Canvas',
    modelId: 'amazon.nova-canvas-v1:0',
    region: novaRegion,
    // Nova Canvas の上限は 4.1M pixels。16:9 で最大は 2560x1440 = 3.7M pixels
    opts: { width: 2560, height: 1440 },
  },
  {
    name: 'SD 3.5 Large',
    modelId: 'stability.sd3-5-large-v1:0',
    region: sdRegion,
    opts: { aspectRatio: '16:9' },
  },
];

async function runModel(model: ModelConfig, prompt: string): Promise<{ name: string; elapsed: number; outputPath: string }> {
  const slug = model.name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '');
  const outputPath = `/tmp/talkcapital-${slug}.png`;

  console.log(`\n--- ${model.name} (${model.modelId}) ---`);
  console.log(`Region: ${model.region}`);
  console.log('Generating...');

  const start = Date.now();
  const base64 = await generateBackgroundImage(prompt, model.modelId, model.region, model.opts);
  const elapsed = Date.now() - start;

  const buf = Buffer.from(base64, 'base64');
  await writeFile(outputPath, buf);

  console.log(`Done in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Output: ${outputPath} (${(buf.length / 1024).toFixed(0)} KB)`);

  return { name: model.name, elapsed, outputPath };
}

async function main() {
  const prompt = buildBackgroundPrompt(topics);

  console.log('=== TalkCapital: AI Image Model Comparison ===');
  console.log(`Prompt (${prompt.length} chars):\n${prompt}\n`);

  const results: Array<{ name: string; elapsed: number; outputPath: string; error?: string }> = [];

  for (const model of models) {
    try {
      const result = await runModel(model, prompt);
      results.push(result);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`ERROR: ${model.name} failed: ${errMsg}`);
      results.push({ name: model.name, elapsed: 0, outputPath: '', error: errMsg });
    }
  }

  console.log('\n=== Results Summary ===');
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.name}: FAILED - ${r.error}`);
    } else {
      console.log(`  ${r.name}: ${(r.elapsed / 1000).toFixed(1)}s → ${r.outputPath}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
