import { describe, it, expect, vi } from 'vitest';
import { PlaywrightPool } from '../../src/streaming/playwright-pool.js';

function createMockBrowser() {
  const mockPage = {
    setContent: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('pngdata')),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { mockBrowser, mockContext, mockPage };
}

describe('PlaywrightPool', () => {
  it('init でブラウザを起動する', async () => {
    const { mockBrowser } = createMockBrowser();
    const launchBrowser = vi.fn().mockResolvedValue(mockBrowser);
    const pool = new PlaywrightPool({ launchBrowser });

    await pool.init();

    expect(launchBrowser).toHaveBeenCalledOnce();
    await pool.destroy();
  });

  it('renderHtmlToPng で base64 PNG を返す', async () => {
    const { mockBrowser, mockPage } = createMockBrowser();
    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });
    await pool.init();

    const html = '<html><body>test</body></html>';
    const result = await pool.renderHtmlToPng(html);

    expect(result).toBe(Buffer.from('pngdata').toString('base64'));
    expect(mockPage.setContent).toHaveBeenCalledWith(html, { waitUntil: 'networkidle' });
    expect(mockPage.screenshot).toHaveBeenCalledWith({ type: 'png', fullPage: false });

    await pool.destroy();
  });

  it('init 前に renderHtmlToPng を呼ぶとエラー', async () => {
    const pool = new PlaywrightPool();

    await expect(pool.renderHtmlToPng('<html></html>')).rejects.toThrow('not initialized');
  });

  it('renderHtmlToPng に deviceScaleFactor が渡される', async () => {
    const { mockBrowser } = createMockBrowser();
    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });
    await pool.init();

    await pool.renderHtmlToPng('<html></html>', 3);

    expect(mockBrowser.newContext).toHaveBeenCalledWith({
      viewport: { width: 3840, height: 2160 },
      deviceScaleFactor: 3,
    });

    await pool.destroy();
  });

  it('destroy でブラウザを閉じる', async () => {
    const { mockBrowser } = createMockBrowser();
    const pool = new PlaywrightPool({
      launchBrowser: vi.fn().mockResolvedValue(mockBrowser),
    });
    await pool.init();

    await pool.destroy();

    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
