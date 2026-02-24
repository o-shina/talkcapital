#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config/index.js';
import { runPipeline } from './pipeline/orchestrator.js';

const program = new Command();

program.name('talkcapital').description('講演音声から手書き風グラレコPNGを生成するCLI').version('0.1.0');

program
  .command('generate')
  .requiredOption('-o, --output <path>', '出力ファイルパス')
  .option('-i, --input <path>', '入力音声ファイルパス')
  .option('--format <format>', '出力形式 (png|html)', 'png')
  .option('--skip-transcribe', '文字起こしをスキップ')
  .option('--transcript <path>', '文字起こしテキストファイルパス')
  .option('--scale <number>', '出力スケール（デフォルト:2）', '2')
  .option('--verbose', '詳細ログを表示')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const transcriptOverride = options.skipTranscribe ? options.transcript : undefined;
      if (options.skipTranscribe && !transcriptOverride) {
        throw new Error('--skip-transcribe 時は --transcript が必須です');
      }
      if (options.format !== 'png' && options.format !== 'html') {
        throw new Error('--format は png または html を指定してください');
      }

      const result = await runPipeline(
        {
          inputAudioPath: options.input,
          outputPath: options.output,
          outputFormat: options.format,
          transcriptOverride,
          verbose: options.verbose,
          scale: Number(options.scale),
        },
        config,
      );

      process.stdout.write(`出力完了: ${result.outputPath}\n`);
      process.stdout.write(`所要時間(ms): ${JSON.stringify(result.timings)}\n`);
    } catch (error) {
      process.stderr.write(`エラー: ${String(error)}\n`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`CLI実行エラー: ${String(error)}\n`);
  process.exit(1);
});
