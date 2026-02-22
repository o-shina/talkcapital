import { config as loadDotEnv } from 'dotenv';

export interface Config {
  aws: {
    region: string;
    s3Bucket: string;
    s3KeyPrefix: string;
  };
  bedrock: {
    modelId: string;
    region: string;
  };
  output: {
    scale: number;
  };
}

let loaded = false;

export function loadConfig(): Config {
  if (!loaded) {
    loadDotEnv();
    loaded = true;
  }

  const s3Bucket = process.env.AWS_S3_BUCKET;
  if (!s3Bucket) {
    throw new Error('環境変数 AWS_S3_BUCKET は必須です');
  }

  return {
    aws: {
      region: process.env.AWS_REGION ?? 'ap-northeast-1',
      s3Bucket,
      s3KeyPrefix: process.env.AWS_S3_KEY_PREFIX ?? 'talkcapital',
    },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-sonnet-4-20250514-v1:0',
      region: process.env.BEDROCK_REGION ?? 'us-east-1',
    },
    output: {
      scale: Number(process.env.OUTPUT_SCALE ?? '2'),
    },
  };
}
