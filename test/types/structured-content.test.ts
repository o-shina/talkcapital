import { describe, expect, test } from 'vitest';
import sampleStructured from '../fixtures/sample-structured.json' with { type: 'json' };
import {
  getStructuredContentJsonSchema,
  structuredContentSchema,
} from '../../src/types/structured-content.js';

describe('structured content schema', () => {
  test('fixtureがスキーマ検証を通る', () => {
    const result = structuredContentSchema.parse(sampleStructured);
    expect(result.title).toBe('チームの心理的安全性');
  });

  test('bedrock用json schemaの基本項目を含む', () => {
    const schema = getStructuredContentJsonSchema();
    expect(schema).toHaveProperty('type', 'object');
    expect(schema).toHaveProperty('properties.blocks');
  });
});
