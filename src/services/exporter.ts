import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { ExcalidrawDocument } from '../types/excalidraw.js';

export async function exportToPng(
  excalidrawDoc: ExcalidrawDocument,
  outputPath: string,
  scale = 2,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const htmlPath = resolve(process.cwd(), 'export/index.html');
    await page.goto(`file://${htmlPath}`);
    const base64 = await page.evaluate(
      async ({ doc, renderScale }) => {
        const fn = (window as any).renderAndExport;
        if (typeof fn !== 'function') {
          throw new Error('renderAndExport が見つかりません');
        }
        return fn(doc, renderScale);
      },
      { doc: excalidrawDoc, renderScale: scale },
    );

    const buffer = Buffer.from(base64, 'base64');
    await writeFile(outputPath, buffer);
  } finally {
    await browser.close();
  }
}
