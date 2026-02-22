import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import type { Config } from '../config/index.js';
import { transcribeAudio } from '../services/transcription.js';
import { structureTranscript } from '../services/structuring.js';
import { renderToExcalidraw } from '../services/template-engine.js';
import { exportToPng } from '../services/exporter.js';
import type { StructuredContent } from '../types/structured-content.js';

export interface PipelineOptions {
  inputAudioPath?: string;
  outputPath: string;
  outputFormat?: 'png' | 'excalidraw';
  transcriptOverride?: string;
  verbose?: boolean;
  scale?: number;
}

export interface PipelineResult {
  outputPath: string;
  transcript: string;
  structuredContent: StructuredContent;
  timings: Record<string, number>;
}

export async function runPipeline(options: PipelineOptions, config: Config): Promise<PipelineResult> {
  const timings: Record<string, number> = {};
  const stageStart = Date.now();

  let transcript: string;
  if (options.transcriptOverride) {
    logStage('[1/4] 文字起こしスキップ: 既存ファイルを読み込み');
    transcript = await readFile(options.transcriptOverride, 'utf8');
    timings.transcription = Date.now() - stageStart;
  } else {
    if (!options.inputAudioPath) {
      throw new Error('--input または --skip-transcribe + --transcript を指定してください');
    }
    logStage('[1/4] Transcribe 実行中...');
    const started = Date.now();
    transcript = await transcribeAudio(options.inputAudioPath, config);
    timings.transcription = Date.now() - started;
  }

  logStage('[2/4] Bedrock 構造化中...');
  const structureStarted = Date.now();
  const structured = await structureTranscript(transcript, config);
  timings.structuring = Date.now() - structureStarted;

  logStage('[3/4] テンプレート描画中...');
  const templateStarted = Date.now();
  const excalidrawDoc = renderToExcalidraw(structured);
  timings.template = Date.now() - templateStarted;

  const outputFormat = options.outputFormat ?? 'png';
  logStage(`[4/4] ${outputFormat === 'png' ? 'PNG エクスポート' : 'Excalidraw JSON 保存'} 中...`);
  const exportStarted = Date.now();
  if (outputFormat === 'png') {
    await exportToPng(excalidrawDoc, options.outputPath, options.scale ?? config.output.scale);
  } else {
    await writeFile(options.outputPath, JSON.stringify(excalidrawDoc, null, 2), 'utf8');
  }
  timings.export = Date.now() - exportStarted;

  return {
    outputPath: options.outputPath,
    transcript,
    structuredContent: structured,
    timings,
  };
}

function logStage(message: string): void {
  process.stdout.write(`${message}\n`);
}
