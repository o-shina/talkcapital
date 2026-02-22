import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import type { ExcalidrawDocument } from '../types/excalidraw.js';

const MAX_RENDERS_BEFORE_REFRESH = 50;

export interface PlaywrightPoolDeps {
  launchBrowser?: () => Promise<Browser>;
}

export class PlaywrightPool {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private renderCount = 0;
  private busy = false;
  private launchBrowser: () => Promise<Browser>;

  constructor(deps?: PlaywrightPoolDeps) {
    this.launchBrowser =
      deps?.launchBrowser ?? (() => chromium.launch({ headless: true }));
  }

  async init(): Promise<void> {
    this.browser = await this.launchBrowser();
    await this.preparePage();
  }

  async exportToPng(
    doc: ExcalidrawDocument,
    scale = 2,
  ): Promise<string> {
    if (!this.browser || !this.page) {
      throw new Error('PlaywrightPool is not initialized. Call init() first.');
    }
    if (this.busy) {
      throw new Error('PlaywrightPool is busy. Concurrent rendering is not allowed.');
    }

    this.busy = true;
    try {
      const base64: string = await this.page.evaluate(
        async ({ doc: d, renderScale }) => {
          const fn = (window as any).renderAndExport;
          if (typeof fn !== 'function') {
            throw new Error('renderAndExport が見つかりません');
          }
          return fn(d, renderScale);
        },
        { doc, renderScale: scale },
      );

      this.renderCount++;
      if (this.renderCount >= MAX_RENDERS_BEFORE_REFRESH) {
        await this.refreshPage();
      }

      return base64;
    } finally {
      this.busy = false;
    }
  }

  async destroy(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private async preparePage(): Promise<void> {
    if (!this.browser) return;
    this.page = await this.browser.newPage();
    const htmlPath = resolve(process.cwd(), 'export/index.html');
    await this.page.goto(`file://${htmlPath}`);
    this.renderCount = 0;
  }

  private async refreshPage(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    await this.preparePage();
  }
}
