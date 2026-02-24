import { describe, expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportToPng } from '../../src/services/exporter.js';

const mocks = vi.hoisted(() => {
  const screenshotMock = vi.fn().mockResolvedValue(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P5xGXwAAAABJRU5ErkJggg==', 'base64'),
  );
  const setContentMock = vi.fn().mockResolvedValue(undefined);
  const pageCloseMock = vi.fn().mockResolvedValue(undefined);
  const contextCloseMock = vi.fn().mockResolvedValue(undefined);
  const newPageMock = vi.fn().mockResolvedValue({
    setContent: setContentMock,
    screenshot: screenshotMock,
    close: pageCloseMock,
  });
  const newContextMock = vi.fn().mockResolvedValue({
    newPage: newPageMock,
    close: contextCloseMock,
  });
  const browserCloseMock = vi.fn().mockResolvedValue(undefined);
  const launchMock = vi.fn().mockResolvedValue({
    newContext: newContextMock,
    close: browserCloseMock,
  });

  return { setContentMock, screenshotMock, browserCloseMock, launchMock, newContextMock };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: mocks.launchMock,
  },
}));

const sampleHtml = '<html><body><h1>Test</h1></body></html>';

describe('exporter', () => {
  test('PNGファイルを生成できる', async () => {
    const output = join(tmpdir(), `talkcapital-export-${Date.now()}.png`);
    await exportToPng(sampleHtml, output, 1);

    const buf = await readFile(output);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(mocks.launchMock).toHaveBeenCalledWith({ headless: true });
    expect(mocks.setContentMock).toHaveBeenCalledWith(sampleHtml, { waitUntil: 'networkidle' });
    expect(mocks.screenshotMock).toHaveBeenCalledOnce();
    expect(mocks.browserCloseMock).toHaveBeenCalledOnce();
  }, 30000);

  test('レンダリング失敗時もbrowserをcloseする', async () => {
    mocks.screenshotMock.mockRejectedValueOnce(new Error('render failed'));
    const output = join(tmpdir(), `talkcapital-export-fail-${Date.now()}.png`);

    await expect(exportToPng(sampleHtml, output, 1)).rejects.toThrow('render failed');
    expect(mocks.browserCloseMock).toHaveBeenCalled();
  });

  test('newContext に deviceScaleFactor が渡される', async () => {
    const output = join(tmpdir(), `talkcapital-export-scale-${Date.now()}.png`);
    await exportToPng(sampleHtml, output, 2);

    expect(mocks.newContextMock).toHaveBeenCalledWith({
      viewport: { width: 3840, height: 2160 },
      deviceScaleFactor: 2,
    });
  });
});
