import { chromium, type Browser } from 'playwright';
import { CANVAS } from '../templates/layout.js';

export interface PlaywrightPoolDeps {
  launchBrowser?: () => Promise<Browser>;
}

export class PlaywrightPool {
  private browser: Browser | null = null;
  private busy = false;
  private launchBrowser: () => Promise<Browser>;

  constructor(deps?: PlaywrightPoolDeps) {
    this.launchBrowser =
      deps?.launchBrowser ?? (() => chromium.launch({ headless: true }));
  }

  async init(): Promise<void> {
    this.browser = await this.launchBrowser();
  }

  async renderHtmlToPng(html: string, scale = 2): Promise<string> {
    if (!this.browser) {
      throw new Error('PlaywrightPool is not initialized. Call init() first.');
    }
    if (this.busy) {
      throw new Error('PlaywrightPool is busy. Concurrent rendering is not allowed.');
    }

    this.busy = true;
    try {
      const context = await this.browser.newContext({
        viewport: { width: CANVAS.width, height: CANVAS.height },
        deviceScaleFactor: scale,
      });
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (window as any).__roughDone === true, null, { timeout: 10000 }).catch(() => {});
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      await page.close();
      await context.close();
      return buffer.toString('base64');
    } finally {
      this.busy = false;
    }
  }

  async destroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
