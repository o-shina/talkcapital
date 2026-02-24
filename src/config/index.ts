import { config as loadDotEnv } from 'dotenv';

export interface Config {
  aws: {
    region: string;
    s3Bucket: string;
    s3KeyPrefix: string;
  };
  llm: {
    provider: 'bedrock' | 'openrouter';
  };
  bedrock: {
    modelId: string;
    region: string;
  };
  openrouter?: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  output: {
    scale: number;
  };
  streaming?: {
    port: number;
    updateChars: number;
    maxSessions: number;
  };
  illustration: {
    enabled: boolean;
    modelId: string;
    region: string;
    iconSize: number;
  };
}

let loaded = false;

export function loadConfig(): Config {
  if (!loaded) {
    loadDotEnv();
    loaded = true;
  }

  const s3Bucket = process.env.AWS_S3_BUCKET?.trim() || '';
  if (!s3Bucket) {
    throw new Error('環境変数 AWS_S3_BUCKET は必須です');
  }

  const provider = process.env.LLM_PROVIDER ?? 'bedrock';
  if (provider !== 'bedrock' && provider !== 'openrouter') {
    throw new Error('環境変数 LLM_PROVIDER は bedrock または openrouter を指定してください');
  }

  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  const openrouterModel = process.env.OPENROUTER_MODEL;
  if (provider === 'openrouter') {
    if (!openrouterApiKey) {
      throw new Error('環境変数 OPENROUTER_API_KEY は LLM_PROVIDER=openrouter 時に必須です');
    }
    if (!openrouterModel) {
      throw new Error('環境変数 OPENROUTER_MODEL は LLM_PROVIDER=openrouter 時に必須です');
    }
  }

  return {
    aws: {
      region: process.env.AWS_REGION ?? 'ap-northeast-1',
      s3Bucket,
      s3KeyPrefix: process.env.AWS_S3_KEY_PREFIX ?? 'talkcapital',
    },
    llm: {
      provider,
    },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-sonnet-4-20250514-v1:0',
      region: process.env.BEDROCK_REGION ?? 'us-east-1',
    },
    openrouter:
      provider === 'openrouter'
        ? {
            apiKey: openrouterApiKey as string,
            model: openrouterModel as string,
            baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
          }
        : undefined,
    output: {
      scale: Number(process.env.OUTPUT_SCALE ?? '2'),
    },
    streaming: {
      port: Number(process.env.PORT ?? '8080'),
      updateChars: Number(process.env.STREAMING_UPDATE_CHARS ?? '500'),
      maxSessions: Number(process.env.STREAMING_MAX_SESSIONS ?? '1'),
    },
    illustration: {
      enabled: process.env.ILLUSTRATION_ENABLED !== 'false',
      modelId: process.env.BEDROCK_IMAGE_MODEL_ID ?? 'amazon.nova-canvas-v1:0',
      region: process.env.BEDROCK_IMAGE_REGION ?? 'us-east-1',
      iconSize: Number(process.env.ILLUSTRATION_ICON_SIZE ?? '100'),
    },
  };
}
