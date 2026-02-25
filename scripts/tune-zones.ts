/**
 * ゾーン画像合成チューニング用スクリプト
 *
 * 使い方:
 *   npx tsx scripts/tune-zones.ts                    # 全ブロック、Nova Canvas
 *   npx tsx scripts/tune-zones.ts --model sd35       # SD 3.5 Large
 *   npx tsx scripts/tune-zones.ts --block 0          # ブロック0のみ
 *   npx tsx scripts/tune-zones.ts --prompt-only      # プロンプト確認のみ
 *   npx tsx scripts/tune-zones.ts --tag v1           # タグ付き出力
 *   npx tsx scripts/tune-zones.ts --no-open          # プレビューを開かない
 */

import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { buildBlockImagePrompts, type ImageModelTarget } from '../src/services/prompt-builder.js';
import { generateZoneImages } from '../src/services/illustration.js';
import { renderToHtml } from '../src/services/html-renderer.js';
import { exportToPng } from '../src/services/exporter.js';
import type { Config } from '../src/config/index.js';
import type { StructuredContent } from '../src/types/structured-content.js';

loadDotEnv();

async function main() {
  const args = process.argv.slice(2);
  const tagIdx = args.indexOf('--tag');
  const tag = tagIdx >= 0 ? args[tagIdx + 1] : `${Date.now()}`;
  const noOpen = args.includes('--no-open');
  const promptOnly = args.includes('--prompt-only');
  const layoutOnly = args.includes('--layout-only');
  const blockIdx = args.indexOf('--block');
  const blockOnly = blockIdx >= 0 ? Number(args[blockIdx + 1]) : undefined;
  const modelArg = args.indexOf('--model');
  const useSD35 = modelArg >= 0 && args[modelArg + 1] === 'sd35';
  const targetModel: ImageModelTarget = useSD35 ? 'sd35-large' : 'nova-canvas';

  // モデル設定
  const imageModelId = useSD35 ? 'stability.sd3-5-large-v1:0' : 'amazon.nova-canvas-v1:0';
  const imageRegion = useSD35
    ? (process.env.BEDROCK_SD_REGION ?? 'us-west-2')
    : (process.env.BEDROCK_IMAGE_REGION ?? 'us-east-1');

  // 1. サンプルデータ読み込み
  const fixtureIdx = args.indexOf('--fixture');
  const fixturePath = fixtureIdx >= 0
    ? args[fixtureIdx + 1]
    : join(import.meta.dirname, '..', 'test', 'fixtures', 'sample-structured.json');
  const content: StructuredContent = JSON.parse(await readFile(fixturePath, 'utf8'));

  console.log('=== Step 1: StructuredContent ===');
  console.log(`Title: ${content.title}`);
  console.log(`Blocks: ${content.blocks.map(b => b.heading).join(', ')}`);
  console.log(`Model: ${imageModelId} (${imageRegion})`);

  const config: Config = {
    aws: { region: 'ap-northeast-1', s3Bucket: 'dummy', s3KeyPrefix: 'dummy' },
    llm: { provider: 'bedrock' },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      region: process.env.BEDROCK_REGION ?? 'us-east-1',
    },
    output: { scale: 2 },
    illustration: { enabled: true, mode: 'zones', modelId: imageModelId, region: imageRegion, iconSize: 512 },
  };

  // --layout-only: AWS呼び出しなしでレイアウトのみ確認
  if (layoutOnly) {
    console.log('\n=== Layout-only モード（AI画像なし） ===');
    const html = renderToHtml(content);
    const outputPath = `/tmp/talkcapital-layout-${tag}.png`;
    await exportToPng(html, outputPath, 2);
    console.log(`Output: ${outputPath}`);
    if (!noOpen) {
      execFile('open', [outputPath], (err) => {
        if (err) console.error('Failed to open preview:', err.message);
      });
    }
    return;
  }

  // 2. Claude でブロック別プロンプト生成
  console.log(`\n=== Step 2: Claude でブロック別プロンプト生成 (${targetModel}) ===`);

  const startPrompt = Date.now();
  let blockPrompts = await buildBlockImagePrompts(content, config, {}, targetModel);
  const promptElapsed = Date.now() - startPrompt;

  console.log(`Done in ${(promptElapsed / 1000).toFixed(1)}s`);
  for (const bp of blockPrompts) {
    console.log(`\n--- Block ${bp.blockIndex}: ${content.blocks[bp.blockIndex]?.heading ?? '?'} ---`);
    console.log(`PROMPT (${bp.prompt.length} chars):\n${bp.prompt}`);
    console.log(`NEGATIVE: ${bp.negativePrompt}`);
  }

  if (promptOnly) {
    return;
  }

  // 特定ブロックのみ生成
  if (blockOnly !== undefined) {
    blockPrompts = blockPrompts.filter(bp => bp.blockIndex === blockOnly);
    console.log(`\n=== --block ${blockOnly} のみ生成 ===`);
  }

  // 3. ゾーン画像生成
  console.log('\n=== Step 3: ゾーン画像生成 ===');
  const startImage = Date.now();
  const zoneImages = await generateZoneImages(blockPrompts, config);
  const imageElapsed = Date.now() - startImage;

  console.log(`Done in ${(imageElapsed / 1000).toFixed(1)}s (${zoneImages.size} images)`);

  // 個別ゾーン画像を保存
  for (const [idx, dataURL] of zoneImages) {
    const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
    const zonePath = `/tmp/talkcapital-zone-${tag}-block${idx}.png`;
    await writeFile(zonePath, Buffer.from(base64, 'base64'));
    console.log(`  Block ${idx}: ${zonePath}`);
  }

  // 4. 合成画像生成
  console.log('\n=== Step 4: 合成画像生成 ===');
  const html = renderToHtml(content, { zoneImages });
  const outputPath = `/tmp/talkcapital-zones-${tag}.png`;
  await exportToPng(html, outputPath, 2);

  console.log(`Output: ${outputPath}`);
  console.log(`\nTotal: prompt ${(promptElapsed / 1000).toFixed(1)}s + image ${(imageElapsed / 1000).toFixed(1)}s = ${((promptElapsed + imageElapsed) / 1000).toFixed(1)}s`);

  if (!noOpen) {
    // 合成画像 + 個別ゾーン画像を開く
    const filesToOpen = [outputPath];
    for (const [idx] of zoneImages) {
      filesToOpen.push(`/tmp/talkcapital-zone-${tag}-block${idx}.png`);
    }
    execFile('open', filesToOpen, (err) => {
      if (err) console.error('Failed to open preview:', err.message);
    });
  }
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
