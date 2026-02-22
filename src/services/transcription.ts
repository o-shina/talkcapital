import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import type { Config } from '../config/index.js';

const SUPPORTED_EXTENSIONS = new Set(['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.webm']);

export interface TranscriptionDependencies {
  s3Client?: Pick<S3Client, 'send'>;
  transcribeClient?: Pick<TranscribeClient, 'send'>;
  wait?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export async function transcribeAudio(
  audioFilePath: string,
  config: Config,
  deps: TranscriptionDependencies = {},
): Promise<string> {
  const extension = extname(audioFilePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`未対応の音声フォーマットです: ${extension}`);
  }

  const audioBuffer = await readFile(audioFilePath);
  const jobName = `talkcapital-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const objectKey = `${config.aws.s3KeyPrefix}/${jobName}${extension}`;
  const mediaUri = `s3://${config.aws.s3Bucket}/${objectKey}`;

  const s3Client = deps.s3Client ?? new S3Client({ region: config.aws.region });
  const transcribeClient =
    deps.transcribeClient ?? new TranscribeClient({ region: config.aws.region });
  const wait = deps.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const fetchImpl = deps.fetchImpl ?? fetch;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: objectKey,
      Body: audioBuffer,
      ContentType: resolveContentType(extension),
      Metadata: { source: basename(audioFilePath) },
    }),
  );

  await transcribeClient.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      IdentifyLanguage: false,
      LanguageCode: 'ja-JP',
      Media: { MediaFileUri: mediaUri },
      OutputBucketName: config.aws.s3Bucket,
      OutputKey: `${config.aws.s3KeyPrefix}/transcribe-output/${jobName}.json`,
    }),
  );

  const timeoutAt = Date.now() + 5 * 60 * 1000;
  while (Date.now() < timeoutAt) {
    const jobResult = await transcribeClient.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
    );

    const status = jobResult.TranscriptionJob?.TranscriptionJobStatus;
    if (status === 'COMPLETED') {
      const url = jobResult.TranscriptionJob?.Transcript?.TranscriptFileUri;
      if (!url) {
        throw new Error('文字起こし結果URLが取得できませんでした');
      }
      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`文字起こし結果の取得に失敗しました: ${response.status}`);
      }
      const payload = (await response.json()) as {
        results?: { transcripts?: Array<{ transcript?: string }> };
      };
      const transcript = payload.results?.transcripts?.[0]?.transcript;
      if (!transcript) {
        throw new Error('文字起こし結果が空です');
      }
      return transcript;
    }

    if (status === 'FAILED') {
      throw new Error(
        `Transcribeジョブ失敗: ${jobResult.TranscriptionJob?.FailureReason ?? 'unknown error'}`,
      );
    }

    await wait(5000);
  }

  throw new Error('Transcribeジョブがタイムアウトしました(5分)');
}

function resolveContentType(extension: string): string {
  switch (extension) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.m4a':
      return 'audio/mp4';
    case '.flac':
      return 'audio/flac';
    case '.ogg':
      return 'audio/ogg';
    case '.webm':
      return 'audio/webm';
    default:
      return 'application/octet-stream';
  }
}
