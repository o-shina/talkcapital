import { describe, expect, test } from 'vitest';
import sampleStructured from '../fixtures/sample-structured.json' with { type: 'json' };
import { renderToExcalidraw } from '../../src/services/template-engine.js';

describe('template-engine', () => {
  test('3ブロックでExcalidrawドキュメントを生成できる', () => {
    const doc = renderToExcalidraw(sampleStructured as any);
    expect(doc.type).toBe('excalidraw');
    expect(doc.appState.width).toBe(1920);
    expect(doc.appState.height).toBe(1080);
    expect(doc.elements.length).toBeGreaterThan(0);

    const ids = doc.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    const bound = doc.elements.find((e) => e.type !== 'text' && e.boundElements?.length);
    expect(bound).toBeTruthy();
  });

  test('4ブロック入力時は4番目ブロックも描画される', () => {
    const data = {
      ...sampleStructured,
      blocks: [
        ...sampleStructured.blocks,
        { heading: '補足', bullets: [{ text: '四つ目のブロック' }] },
      ],
    };
    const doc = renderToExcalidraw(data as any);
    const headingTexts = doc.elements.filter((e) => e.type === 'text').map((e: any) => e.text);
    expect(headingTexts).toContain('補足');
  });
});
