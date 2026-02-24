import { describe, it, expect, vi } from 'vitest';
import { PlaywrightPool } from '../../src/streaming/playwright-pool.js';

function createMockBrowser() {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue('base64pngdata'),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockBrowser, mockPage };
}

describe('PlaywrightPool', () => {
  it('init でブラウザとページを起動する', async () => {
    const { mockBrowser } = createMockBrowser();
    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });

    await pool.init();

    expect(mockBrowser.newPage).toHaveBeenCalledOnce();
    await pool.destroy();
  });

  it('exportToPng で base64 PNG を返す', async () => {
    const { mockBrowser, mockPage } = createMockBrowser();
    mockPage.evaluate.mockResolvedValue('iVBORw0KGgo=');

    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });
    await pool.init();

    const doc = {
      type: 'excalidraw' as const,
      version: 2 as const,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#fff', width: 1920, height: 1080 },
    };

    const result = await pool.exportToPng(doc);
    expect(result).toBe('iVBORw0KGgo=');
    expect(mockPage.evaluate).toHaveBeenCalledOnce();

    await pool.destroy();
  });

  it('init 前に exportToPng を呼ぶとエラー', async () => {
    const pool = new PlaywrightPool();
    const doc = {
      type: 'excalidraw' as const,
      version: 2 as const,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#fff', width: 1920, height: 1080 },
    };

    await expect(pool.exportToPng(doc)).rejects.toThrow('not initialized');
  });

  it('50回レンダリング後にページが再作成される', async () => {
    const { mockBrowser, mockPage } = createMockBrowser();
    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });
    await pool.init();

    const doc = {
      type: 'excalidraw' as const,
      version: 2 as const,
      source: 'test',
      elements: [],
      appState: { viewBackgroundColor: '#fff', width: 1920, height: 1080 },
    };

    // 50回レンダリング
    for (let i = 0; i < 50; i++) {
      await pool.exportToPng(doc);
    }

    // 初期の1回 + 50回目でリフレッシュの1回 = 2回
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    // ページのclose: リフレッシュ時の1回
    expect(mockPage.close).toHaveBeenCalledTimes(1);

    await pool.destroy();
  });

  it('destroy でブラウザとページを閉じる', async () => {
    const { mockBrowser, mockPage } = createMockBrowser();
    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });
    await pool.init();

    await pool.destroy();

    expect(mockPage.close).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
