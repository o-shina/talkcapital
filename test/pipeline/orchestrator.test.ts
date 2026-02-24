import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import sampleStructured from '../fixtures/sample-structured.json' with { type: 'json' };
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';

vi.mock('../../src/services/transcription.js', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('transcript'),
}));
vi.mock('../../src/services/structuring.js', () => ({
  structureTranscript: vi.fn().mockResolvedValue(sampleStructured),
}));
vi.mock('../../src/services/template-engine.js', () => ({
  renderToExcalidraw: vi.fn().mockReturnValue({
    type: 'excalidraw',
    version: 2,
    source: 'test',
    appState: { width: 1920, height: 1080, viewBackgroundColor: '#fff' },
    elements: [],
  }),
}));
vi.mock('../../src/services/exporter.js', () => ({
  exportToPng: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/services/illustration.js', () => ({
  generateBlockIcons: vi.fn().mockResolvedValue({}),
}));

import { runPipeline } from '../../src/pipeline/orchestrator.js';
import { exportToPng } from '../../src/services/exporter.js';

const config = {
  aws: { region: 'ap-northeast-1', s3Bucket: 'bucket', s3KeyPrefix: 'prefix' },
  llm: { provider: 'bedrock' as const },
  bedrock: { region: 'us-east-1', modelId: 'model' },
  output: { scale: 2 },
  illustration: { enabled: false, modelId: 'amazon.nova-canvas-v1:0', region: 'us-east-1', iconSize: 100 },
};

describe('orchestrator', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    stdoutSpy?.mockRestore();
  });

  test('skip-transcribeフローが動作', async () => {
    const transcriptFile = join(tmpdir(), `sample-${Date.now()}.txt`);
    await writeFile(transcriptFile, 'sample transcript', 'utf8');

    const result = await runPipeline(
      {
        transcriptOverride: transcriptFile,
        outputPath: '/tmp/out.png',
      },
      config,
    );

    expect(result.outputPath).toBe('/tmp/out.png');
    expect(result.structuredContent.actions).toHaveLength(3);
  });

  test('inputなしでskip-transcribeも無い場合はエラー', async () => {
    await expect(
      runPipeline(
        {
          outputPath: '/tmp/out.png',
        },
        config,
      ),
    ).rejects.toThrow('--input または --skip-transcribe');
  });

  test('format=excalidraw でJSONを保存する', async () => {
    const transcriptFile = join(tmpdir(), `sample-${Date.now()}.txt`);
    const outputJson = join(tmpdir(), `out-${Date.now()}.json`);
    await writeFile(transcriptFile, 'sample transcript', 'utf8');

    await runPipeline(
      {
        transcriptOverride: transcriptFile,
        outputPath: outputJson,
        outputFormat: 'excalidraw',
      },
      config,
    );

    const saved = JSON.parse(await readFile(outputJson, 'utf8'));
    expect(saved.type).toBe('excalidraw');
    expect(vi.mocked(exportToPng)).not.toHaveBeenCalled();
  });

  test('verbose指定がなくても主要ステージを表示する', async () => {
    const transcriptFile = join(tmpdir(), `sample-${Date.now()}.txt`);
    await writeFile(transcriptFile, 'sample transcript', 'utf8');

    await runPipeline(
      {
        transcriptOverride: transcriptFile,
        outputPath: '/tmp/out.png',
      },
      config,
    );

    expect(stdoutSpy).toHaveBeenCalledWith('[1/5] 文字起こしスキップ: 既存ファイルを読み込み\n');
    expect(stdoutSpy).toHaveBeenCalledWith('[2/5] Bedrock 構造化中...\n');
    expect(stdoutSpy).toHaveBeenCalledWith('[3/5] アイコン生成スキップ\n');
    expect(stdoutSpy).toHaveBeenCalledWith('[4/5] テンプレート描画中...\n');
    expect(stdoutSpy).toHaveBeenCalledWith('[5/5] PNG エクスポート 中...\n');
  });
});
