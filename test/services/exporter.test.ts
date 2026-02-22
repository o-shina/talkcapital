import { describe, expect, test, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportToPng } from '../../src/services/exporter.js';
import type { ExcalidrawDocument } from '../../src/types/excalidraw.js';

const mocks = vi.hoisted(() => {
  const gotoMock = vi.fn().mockResolvedValue(undefined);
  const evaluateMock = vi.fn().mockResolvedValue(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P5xGXwAAAABJRU5ErkJggg==',
  );
  const closeMock = vi.fn().mockResolvedValue(undefined);
  const newPageMock = vi.fn().mockResolvedValue({
    goto: gotoMock,
    evaluate: evaluateMock,
  });
  const launchMock = vi.fn().mockResolvedValue({
    newPage: newPageMock,
    close: closeMock,
  });

  return { gotoMock, evaluateMock, closeMock, launchMock };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: mocks.launchMock,
  },
}));

const minimalDoc: ExcalidrawDocument = {
  type: 'excalidraw',
  version: 2,
  source: 'test',
  appState: { width: 1920, height: 1080, viewBackgroundColor: '#ffffff' },
  elements: [
    {
      id: 'rect',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 400,
      height: 200,
      strokeColor: '#000000',
      backgroundColor: '#ff0000',
      strokeWidth: 2,
      roughness: 1,
    },
    {
      id: 'text',
      type: 'text',
      x: 120,
      y: 140,
      width: 360,
      height: 80,
      strokeColor: '#111111',
      backgroundColor: 'transparent',
      strokeWidth: 1,
      roughness: 0,
      text: 'テスト',
      fontSize: 48,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
    },
  ],
};

describe('exporter', () => {
  test('PNGファイルを生成できる', async () => {
    const output = join(tmpdir(), `talkcapital-export-${Date.now()}.png`);
    await exportToPng(minimalDoc, output, 1);

    const buf = await readFile(output);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(mocks.launchMock).toHaveBeenCalledWith({ headless: true });
    expect(mocks.gotoMock).toHaveBeenCalledOnce();
    expect(mocks.evaluateMock).toHaveBeenCalledOnce();
    expect(mocks.closeMock).toHaveBeenCalledOnce();
  }, 30000);
});
