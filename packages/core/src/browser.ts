import { chromium, devices, type Browser, type Page } from "playwright";

const DEFAULT_DEBUGGING_PORT = 9222;

// Screenshot viewport configurations
export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceEmulation?: boolean;  // If true, use fresh page with device emulation
  device?: string;            // Playwright device name for emulation
}

// Default viewport sizes for responsive testing
export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: "mobile", width: 390, height: 844, deviceEmulation: true, device: "iPhone 14 Pro" },
  { name: "tablet", width: 834, height: 1194, deviceEmulation: true, device: "iPad Pro 11" },
  { name: "desktop", width: 1920, height: 1080 },
];

export interface Screenshot {
  name: string;
  width: number;
  height: number;
  buffer: Buffer;
}

export type ScreenshotSet = Screenshot[];

export class BrowserManager {
  private browser: Browser | null = null;
  private debuggingPort: number;

  constructor(port = DEFAULT_DEBUGGING_PORT) {
    this.debuggingPort = port;
  }

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        `--remote-debugging-port=${this.debuggingPort}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  async getPage(url: string, timeout = 60000): Promise<{ page: Page; resolvedUrl: string }> {
    if (!this.browser) {
      throw new Error("Browser not launched. Call launch() first.");
    }

    // Normalize URL first - add https:// if no protocol
    const normalizedUrl = this.normalizeUrl(url);
    console.log(`[Browser] getPage called with: "${url}" -> normalized to: "${normalizedUrl}"`);

    const page = await this.browser.newPage();

    // Try to navigate, falling back to http:// if https:// fails
    const resolvedUrl = await this.resolveUrl(normalizedUrl, page, timeout);
    console.log(`[Browser] Resolved URL: "${resolvedUrl}"`);

    return { page, resolvedUrl };
  }

  /**
   * Normalize URL by adding https:// if no protocol is present
   */
  private normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;

    // Already has protocol
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Add https:// by default
    return `https://${trimmed}`;
  }

  /**
   * Try to navigate, falling back to http:// if https:// fails
   */
  private async resolveUrl(url: string, page: Page, timeout: number): Promise<string> {
    // URL should already have a protocol at this point
    try {
      await this.navigateToUrl(page, url, timeout);
      return url;
    } catch (error) {
      // If https failed, try http
      if (url.startsWith("https://")) {
        const httpUrl = url.replace("https://", "http://");
        try {
          await this.navigateToUrl(page, httpUrl, timeout);
          return httpUrl;
        } catch {
          // Both failed, throw original error
        }
      }
      throw error;
    }
  }

  private async navigateToUrl(page: Page, url: string, timeout: number): Promise<void> {
    try {
      // Ensure URL is properly formatted before navigation
      const validUrl = new URL(url).href;
      await page.goto(validUrl, { waitUntil: "networkidle", timeout });
    } catch (error) {
      if (error instanceof Error && error.message.includes("timeout")) {
        throw new Error(`Page load timeout: ${url} took longer than ${timeout / 1000}s to load`);
      }
      if (error instanceof Error && error.message.includes("net::ERR")) {
        throw new Error(`Network error: Unable to reach ${url}`);
      }
      if (error instanceof Error && error.message.includes("Invalid URL")) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      throw error;
    }
  }

  /**
   * Capture screenshots at multiple viewport sizes.
   * Device emulation viewports get a fresh page load.
   * Regular viewports use resize on the existing page.
   */
  async captureScreenshotBuffers(
    page: Page,
    url?: string,
    viewports: ViewportConfig[] = DEFAULT_VIEWPORTS
  ): Promise<ScreenshotSet> {
    const currentUrl = url || page.url();
    const screenshots: Screenshot[] = [];

    // Separate device emulation viewports from resize viewports
    const emulationViewports = viewports.filter(v => v.deviceEmulation);
    const resizeViewports = viewports.filter(v => !v.deviceEmulation);

    // Capture device emulation screenshots in parallel (fresh page loads)
    const emulationPromises = emulationViewports.map(async (viewport) => {
      const buffer = await this.captureWithDeviceEmulation(currentUrl, viewport);
      return {
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        buffer,
      };
    });

    // Capture resize screenshots sequentially on existing page
    for (const viewport of resizeViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(300);
      const buffer = await page.screenshot({ fullPage: true });
      screenshots.push({
        name: viewport.name,
        width: viewport.width,
        height: viewport.height,
        buffer,
      });
    }

    // Wait for emulation screenshots and add them
    const emulationScreenshots = await Promise.all(emulationPromises);
    screenshots.push(...emulationScreenshots);

    // Sort by width (smallest first)
    screenshots.sort((a, b) => a.width - b.width);

    return screenshots;
  }

  /**
   * Legacy method - returns just mobile and desktop
   */
  async captureScreenshots(
    page: Page,
    url?: string
  ): Promise<{ mobile: string; desktop: string }> {
    const screenshots = await this.captureScreenshotBuffers(page, url);
    const mobile = screenshots.find(s => s.name === "mobile");
    const desktop = screenshots.find(s => s.name === "desktop");
    return {
      desktop: desktop?.buffer.toString("base64") || "",
      mobile: mobile?.buffer.toString("base64") || "",
    };
  }

  /**
   * Capture a screenshot with device emulation (fresh browser context).
   */
  private async captureWithDeviceEmulation(
    url: string,
    viewport: ViewportConfig
  ): Promise<Buffer> {
    if (!this.browser) {
      throw new Error("Browser not launched");
    }

    const deviceConfig = viewport.device ? devices[viewport.device] : {};

    const context = await this.browser.newContext({
      ...deviceConfig,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
    });

    const mobilePage = await context.newPage();

    try {
      await mobilePage.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await mobilePage.waitForTimeout(500);
      return await mobilePage.screenshot({ fullPage: true });
    } finally {
      await mobilePage.close();
      await context.close();
    }
  }

  async getHtml(page: Page): Promise<string> {
    return await page.content();
  }

  getPort(): number {
    return this.debuggingPort;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
