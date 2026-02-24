import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { CANVAS } from '../templates/layout.js';

export async function exportToPng(
  html: string,
  outputPath: string,
  scale = 2,
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: CANVAS.width, height: CANVAS.height },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    await writeFile(outputPath, buffer);
  } finally {
    await browser.close();
  }
}
