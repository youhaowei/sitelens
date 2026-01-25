import * as cheerio from "cheerio";

export interface CrawledPage {
  url: string;
  title: string | null;
  description: string | null;
  statusCode: number;
  loadTime: number;
  wordCount: number;
  html: string;
  crawledAt: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  sitemapFound: boolean;
  sitemapUrl: string | null;
  totalDiscovered: number;
  totalCrawled: number;
  errors: Array<{ url: string; error: string }>;
}

export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  timeout: number;
  respectRobotsTxt: boolean;
  includeSubdomains: boolean;
  onProgress?: (crawled: number, total: number, currentUrl: string) => void;
}

const DEFAULT_OPTIONS: CrawlOptions = {
  maxPages: 25,
  maxDepth: 3,
  timeout: 10000,
  respectRobotsTxt: true,
  includeSubdomains: false,
};

export class SiteCrawler {
  private baseUrl: URL;
  private baseHost: string;
  private visited: Set<string> = new Set();
  private queue: Array<{ url: string; depth: number }> = [];
  private pages: CrawledPage[] = [];
  private errors: Array<{ url: string; error: string }> = [];
  private options: CrawlOptions;
  private disallowedPaths: string[] = [];

  constructor(startUrl: string, options: Partial<CrawlOptions> = {}) {
    this.baseUrl = new URL(startUrl);
    this.baseHost = this.baseUrl.hostname;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async crawl(): Promise<CrawlResult> {
    if (this.options.respectRobotsTxt) {
      await this.parseRobotsTxt();
    }

    const sitemapResult = await this.parseSitemap();

    if (sitemapResult.urls.length > 0) {
      for (const url of sitemapResult.urls.slice(0, this.options.maxPages)) {
        this.queue.push({ url, depth: 0 });
      }
    } else {
      this.queue.push({ url: this.baseUrl.href, depth: 0 });
    }

    while (this.queue.length > 0 && this.pages.length < this.options.maxPages) {
      const item = this.queue.shift();
      if (!item) break;

      const { url, depth } = item;

      if (this.visited.has(url)) continue;
      if (depth > this.options.maxDepth) continue;
      if (this.isDisallowed(url)) continue;

      this.visited.add(url);

      this.options.onProgress?.(
        this.pages.length,
        Math.min(this.queue.length + this.pages.length, this.options.maxPages),
        url
      );

      const page = await this.fetchPage(url);

      if (page) {
        this.pages.push(page);

        if (depth < this.options.maxDepth) {
          const links = this.extractLinks(page.html, url);
          for (const link of links) {
            if (!this.visited.has(link) && this.pages.length + this.queue.length < this.options.maxPages * 2) {
              this.queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      }
    }

    return {
      pages: this.pages,
      sitemapFound: sitemapResult.found,
      sitemapUrl: sitemapResult.url,
      totalDiscovered: this.visited.size,
      totalCrawled: this.pages.length,
      errors: this.errors,
    };
  }

  private async parseRobotsTxt(): Promise<void> {
    try {
      const robotsUrl = new URL("/robots.txt", this.baseUrl).href;
      const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });

      if (response.ok) {
        const content = await response.text();
        const lines = content.split("\n");
        let isRelevantUserAgent = false;

        for (const line of lines) {
          const trimmed = line.trim().toLowerCase();

          if (trimmed.startsWith("user-agent:")) {
            const agent = trimmed.replace("user-agent:", "").trim();
            isRelevantUserAgent = agent === "*" || agent.includes("bot");
          } else if (isRelevantUserAgent && trimmed.startsWith("disallow:")) {
            const path = trimmed.replace("disallow:", "").trim();
            if (path) {
              this.disallowedPaths.push(path);
            }
          }
        }
      }
    } catch {
    }
  }

  private isDisallowed(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      for (const disallowed of this.disallowedPaths) {
        if (disallowed === "/") return true;
        if (path.startsWith(disallowed)) return true;
      }
    } catch {
    }
    return false;
  }

  private async parseSitemap(): Promise<{ found: boolean; url: string | null; urls: string[] }> {
    const sitemapUrls = [
      new URL("/sitemap.xml", this.baseUrl).href,
      new URL("/sitemap_index.xml", this.baseUrl).href,
      new URL("/sitemap/sitemap.xml", this.baseUrl).href,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, {
          signal: AbortSignal.timeout(10000),
          headers: { Accept: "application/xml, text/xml" },
        });

        if (response.ok) {
          const content = await response.text();
          const urls = this.extractUrlsFromSitemap(content);

          if (urls.length > 0) {
            return { found: true, url: sitemapUrl, urls };
          }
        }
      } catch {
      }
    }

    return { found: false, url: null, urls: [] };
  }

  private extractUrlsFromSitemap(xml: string): string[] {
    const urls: string[] = [];
    const locMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];

    for (const match of locMatches) {
      const url = match.replace(/<\/?loc>/g, "").trim();
      if (this.isValidInternalUrl(url)) {
        urls.push(url);
      }
    }

    return urls;
  }

  private async fetchPage(url: string): Promise<CrawledPage | null> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.options.timeout),
        headers: {
          "User-Agent": "Sitelens/1.0 (+https://github.com/youhaowei/sitelens)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const loadTime = Date.now() - startTime;
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) {
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $("script, style, noscript, iframe").remove();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      const words = bodyText.split(" ").filter((w) => w.length > 0);

      return {
        url,
        title: $("title").text().trim() || null,
        description: $('meta[name="description"]').attr("content")?.trim() || null,
        statusCode: response.status,
        loadTime,
        wordCount: words.length,
        html,
        crawledAt: new Date().toISOString(),
      };
    } catch (error) {
      this.errors.push({
        url,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        if (this.isValidInternalUrl(absoluteUrl) && !links.includes(absoluteUrl)) {
          links.push(absoluteUrl);
        }
      } catch {
      }
    });

    return links;
  }

  private isValidInternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return false;
      }

      if (this.options.includeSubdomains) {
        if (!urlObj.hostname.endsWith(this.baseHost) && urlObj.hostname !== this.baseHost) {
          return false;
        }
      } else {
        if (urlObj.hostname !== this.baseHost) {
          return false;
        }
      }

      const ext = urlObj.pathname.split(".").pop()?.toLowerCase();
      const excludedExtensions = ["pdf", "jpg", "jpeg", "png", "gif", "svg", "webp", "mp4", "mp3", "zip", "doc", "docx", "xls", "xlsx"];
      if (ext && excludedExtensions.includes(ext)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

export async function crawlSite(
  url: string,
  options?: Partial<CrawlOptions>
): Promise<CrawlResult> {
  const crawler = new SiteCrawler(url, options);
  return crawler.crawl();
}
