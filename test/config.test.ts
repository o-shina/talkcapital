import { describe, expect, test } from 'vitest';
import { loadConfig } from '../src/config/index.js';

describe('config', () => {
  test('AWS_S3_BUCKET未設定時にエラー', () => {
    const original = process.env.AWS_S3_BUCKET;
    delete process.env.AWS_S3_BUCKET;
    expect(() => loadConfig()).toThrow('AWS_S3_BUCKET');
    if (original) {
      process.env.AWS_S3_BUCKET = original;
    }
  });

  test('必須設定がある場合にConfigを返す', () => {
    process.env.AWS_S3_BUCKET = 'test-bucket';
    const config = loadConfig();
    expect(config.aws.s3Bucket).toBe('test-bucket');
  });
});
