import { describe, expect, test } from 'vitest';
import sampleStructured from '../fixtures/sample-structured.json' with { type: 'json' };
import { renderToHtml } from '../../src/services/html-renderer.js';

describe('html-renderer', () => {
  test('valid HTML を生成できる', () => {
    const html = renderToHtml(sampleStructured as any);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Klee One');
    expect(html).toContain('3840');
    expect(html).toContain('2160');
  });

  test('タイトルとメインメッセージが含まれる', () => {
    const html = renderToHtml(sampleStructured as any);
    expect(html).toContain(sampleStructured.title);
    expect(html).toContain(sampleStructured.mainMessage);
  });

  test('ブロック見出しと箇条書きが含まれる', () => {
    const html = renderToHtml(sampleStructured as any);
    for (const block of sampleStructured.blocks) {
      expect(html).toContain(block.heading);
      for (const bullet of block.bullets) {
        expect(html).toContain(bullet.text);
      }
    }
  });

  test('吹き出しテキストが含まれる', () => {
    const html = renderToHtml(sampleStructured as any);
    for (const bubble of sampleStructured.speechBubbles) {
      expect(html).toContain(bubble.quote);
    }
  });

  test('アクションテキストが含まれる', () => {
    const html = renderToHtml(sampleStructured as any);
    for (const action of sampleStructured.actions) {
      expect(html).toContain(action.text);
    }
  });

  test('4ブロック入力時は4番目ブロックも描画される', () => {
    const data = {
      ...sampleStructured,
      blocks: [
        ...sampleStructured.blocks,
        { heading: '補足ブロック', bullets: [{ text: '四つ目のブロック' }] },
      ],
    };
    const html = renderToHtml(data as any);
    expect(html).toContain('補足ブロック');
    expect(html).toContain('四つ目のブロック');
  });

  test('illustrations が渡された場合にimg要素が含まれる', () => {
    const illustrations = new Map<number, string>();
    illustrations.set(0, 'data:image/png;base64,iVBORw0KGgo=');
    const html = renderToHtml(sampleStructured as any, { illustrations });
    expect(html).toContain('<img');
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  test('illustrations なしでは img 要素がない', () => {
    const html = renderToHtml(sampleStructured as any);
    expect(html).not.toContain('<img');
  });

  test('rough.js による手描き風描画が含まれる', () => {
    const html = renderToHtml(sampleStructured as any);
    expect(html).toContain('<svg id="rough-canvas"');
    expect(html).toContain('rough.svg(svg)');
    expect(html).toContain('rc.rectangle');
    expect(html).toContain('rc.line');
  });

  test('HTMLエスケープが正しく動作する', () => {
    const data = {
      ...sampleStructured,
      title: 'テスト<b>太字</b>',
    };
    const html = renderToHtml(data as any);
    expect(html).not.toContain('<b>太字</b>');
    expect(html).toContain('&lt;b&gt;太字&lt;/b&gt;');
  });
});
