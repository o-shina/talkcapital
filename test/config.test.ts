import { describe, expect, test } from 'vitest';
import { loadConfig } from '../src/config/index.js';

describe('config', () => {
  test('AWS_S3_BUCKET未設定時にエラー', () => {
    const original = process.env.AWS_S3_BUCKET;
    process.env.AWS_S3_BUCKET = '';
    expect(() => loadConfig()).toThrow('AWS_S3_BUCKET');
    process.env.AWS_S3_BUCKET = original ?? '';
  });

  test('必須設定がある場合にConfigを返す', () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    const config = loadConfig();
    expect(config.aws.s3Bucket).toBe('test-bucket');
    expect(config.llm.provider).toBe('bedrock');
  });

  test('LLM_PROVIDER=openrouter で必要設定があればConfigを返す', () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.LLM_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'key';
    process.env.OPENROUTER_MODEL = 'openrouter/model';

    const config = loadConfig();
    expect(config.llm.provider).toBe('openrouter');
    expect(config.openrouter?.model).toBe('openrouter/model');
  });

  test('LLM_PROVIDER=openrouter でAPIキー未設定ならエラー', () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.LLM_PROVIDER = 'openrouter';
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_MODEL = 'openrouter/model';

    expect(() => loadConfig()).toThrow('OPENROUTER_API_KEY');
  });
});
