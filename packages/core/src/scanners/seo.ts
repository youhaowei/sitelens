import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type {
  SeoData,
  BrokenLink,
  StructuredDataInfo,
  SitemapInfo,
  RobotsInfo,
  AuditIssue,
  SpellingError,
} from "@sitelens/shared/types";
import { createIssue } from "../recommendations";
import { checkSpelling } from "../spellcheck";

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const DESC_MIN_LENGTH = 120;
const DESC_MAX_LENGTH = 160;
const THIN_CONTENT_THRESHOLD = 300;

export class SeoScanner implements Scanner<SeoData> {
  id = "seo";
  name = "On-Page SEO";

  async run(context: ScannerContext): Promise<SeoData> {
    context.onProgress?.("Analyzing SEO elements...");

    const $ = cheerio.load(context.html);
    const issues: AuditIssue[] = [];

    const meta = this.extractMeta($, issues);
    const headings = this.extractHeadings($, issues);
    const content = await this.analyzeContent($, issues, context.html, context.url);
    const images = await this.analyzeImages($, issues, context.url);
    const links = await this.extractLinks($, context.url, context, issues);
    const structuredData = this.extractStructuredData($, issues);
    const sitemap = await this.checkSitemap(context.url, context);
    const robots = await this.checkRobots(context.url, context);

    if (!sitemap.exists) {
      issues.push(createIssue("missing_sitemap"));
    }

    if (!robots.exists) {
      issues.push(createIssue("missing_robots"));
    }

    return {
      meta,
      headings,
      content,
      images,
      links,
      structuredData,
      sitemap,
      robots,
      issues,
    };
  }

  private extractMeta($: cheerio.CheerioAPI, issues: AuditIssue[]) {
    const title = $("title").text().trim() || null;
    const description =
      $('meta[name="description"]').attr("content")?.trim() || null;
    const canonical = $('link[rel="canonical"]').attr("href") || null;
    const robots = $('meta[name="robots"]').attr("content") || null;
    const hreflang = $('link[rel="alternate"][hreflang]').length > 0;
    const language =
      $("html").attr("lang") ||
      $('meta[http-equiv="content-language"]').attr("content") ||
      null;

    const titleLength = title?.length ?? 0;
    const descriptionLength = description?.length ?? 0;

    const titleLengthOk =
      titleLength >= TITLE_MIN_LENGTH && titleLength <= TITLE_MAX_LENGTH;
    const descriptionLengthOk =
      descriptionLength >= DESC_MIN_LENGTH &&
      descriptionLength <= DESC_MAX_LENGTH;

    if (!title) {
      issues.push(createIssue("missing_title"));
    } else if (titleLength < TITLE_MIN_LENGTH) {
      issues.push(
        createIssue("title_too_short", {
          description: `Title is ${titleLength} characters (recommended: ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH})`,
        })
      );
    } else if (titleLength > TITLE_MAX_LENGTH) {
      issues.push(
        createIssue("title_too_long", {
          description: `Title is ${titleLength} characters (recommended: ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH})`,
        })
      );
    }

    if (!description) {
      issues.push(createIssue("missing_description"));
    } else if (descriptionLength < DESC_MIN_LENGTH) {
      issues.push(
        createIssue("description_too_short", {
          description: `Description is ${descriptionLength} characters (recommended: ${DESC_MIN_LENGTH}-${DESC_MAX_LENGTH})`,
        })
      );
    } else if (descriptionLength > DESC_MAX_LENGTH) {
      issues.push(
        createIssue("description_too_long", {
          description: `Description is ${descriptionLength} characters (recommended: ${DESC_MIN_LENGTH}-${DESC_MAX_LENGTH})`,
        })
      );
    }

    return {
      title,
      description,
      canonical,
      robots,
      titleLength,
      descriptionLength,
      titleLengthOk,
      descriptionLengthOk,
      hasHreflang: hreflang,
      language,
    };
  }

  private extractHeadings($: cheerio.CheerioAPI, issues: AuditIssue[]) {
    const structure: Array<{ level: number; text: string }> = [];
    const headingIssues: string[] = [];

    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      const level = parseInt(el.tagName.charAt(1), 10);
      const text = $(el).text().trim();
      structure.push({ level, text });
    });

    const h1Count = structure.filter((h) => h.level === 1).length;

    if (h1Count === 0) {
      headingIssues.push("Missing H1 tag");
      issues.push(createIssue("missing_h1"));
    } else if (h1Count > 1) {
      headingIssues.push(`Multiple H1 tags found (${h1Count})`);
      issues.push(
        createIssue("multiple_h1", {
          description: `Found ${h1Count} H1 tags instead of one.`,
        })
      );
    }

    let structureOk = h1Count === 1;
    for (let i = 1; i < structure.length; i++) {
      const current = structure[i];
      const previous = structure[i - 1];
      if (current && previous && current.level > previous.level + 1) {
        structureOk = false;
        const msg = `Heading hierarchy skip: H${previous.level} to H${current.level}`;
        headingIssues.push(msg);
      }
    }

    if (!structureOk && h1Count === 1) {
      issues.push(createIssue("heading_hierarchy"));
    }

    return { h1Count, structure, structureOk, issues: headingIssues };
  }

  private async analyzeContent(
    $: cheerio.CheerioAPI,
    issues: AuditIssue[],
    html?: string,
    pageUrl?: string
  ) {
    const $clone = $.root().clone();
    $clone.find("script, style, nav, footer, header, noscript").remove();

    const bodyText = $clone.find("body").text().replace(/\s+/g, " ").trim();
    const words = bodyText.split(" ").filter((w) => w.length > 0);
    const wordCount = words.length;

    const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = $clone.find("p").length;
    const avgSentenceLength =
      sentences.length > 0 ? wordCount / sentences.length : 0;

    const syllables = this.countSyllables(bodyText);
    const readingEase = this.calculateFleschReadingEase(
      wordCount,
      sentences.length,
      syllables
    );
    const readingLevel = this.calculateFleschKincaidGrade(
      wordCount,
      sentences.length,
      syllables
    );
    const readingEaseLabel = this.getReadingEaseLabel(readingEase);

    let spellingErrors: SpellingError[] = [];
    if (html) {
      spellingErrors = checkSpelling(html, { pageUrl });
      if (spellingErrors.length > 0) {
        issues.push(
          createIssue("spelling_errors", {
            description: `Found ${spellingErrors.length} potential spelling errors`,
          })
        );
      }
    }

    const isThinContent = wordCount < THIN_CONTENT_THRESHOLD;
    if (isThinContent) {
      issues.push(
        createIssue("thin_content", {
          description: `Page has only ${wordCount} words (minimum recommended: ${THIN_CONTENT_THRESHOLD})`,
        })
      );
    }

    if (readingEase < 30) {
      issues.push(
        createIssue("poor_readability", {
          description: `Content has a Flesch Reading Ease score of ${readingEase.toFixed(0)} (very difficult to read)`,
        })
      );
    }

    return {
      wordCount,
      isThinContent,
      readingLevel: Math.round(readingLevel * 10) / 10,
      readingEase: Math.round(readingEase),
      readingEaseLabel,
      spellingErrors,
      paragraphCount: paragraphs,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    };
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;

    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, "");
      if (cleaned.length === 0) continue;

      let syllables = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
      syllables = syllables.replace(/^y/, "");
      const matches = syllables.match(/[aeiouy]{1,2}/g);
      totalSyllables += matches ? matches.length : 1;
    }

    return totalSyllables;
  }

  private calculateFleschReadingEase(
    words: number,
    sentences: number,
    syllables: number
  ): number {
    if (words === 0 || sentences === 0) return 0;
    return (
      206.835 -
      1.015 * (words / sentences) -
      84.6 * (syllables / words)
    );
  }

  private calculateFleschKincaidGrade(
    words: number,
    sentences: number,
    syllables: number
  ): number {
    if (words === 0 || sentences === 0) return 0;
    return (
      0.39 * (words / sentences) +
      11.8 * (syllables / words) -
      15.59
    );
  }

  private getReadingEaseLabel(score: number): string {
    if (score >= 90) return "Very Easy";
    if (score >= 80) return "Easy";
    if (score >= 70) return "Fairly Easy";
    if (score >= 60) return "Standard";
    if (score >= 50) return "Fairly Difficult";
    if (score >= 30) return "Difficult";
    return "Very Difficult";
  }

  private async analyzeImages(
    $: cheerio.CheerioAPI,
    issues: AuditIssue[],
    baseUrl: string
  ) {
    const images: Array<{
      src: string;
      alt: string | null;
      hasMissingAlt: boolean;
    }> = [];
    const oversizedImages: Array<{
      src: string;
      size: number;
      suggestedSize: number;
    }> = [];

    const imgElements: Array<{ src: string; alt: string | null }> = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || "";
      const alt = $(el).attr("alt");
      imgElements.push({ src, alt: alt ?? null });
    });

    let unoptimizedCount = 0;

    for (const { src, alt } of imgElements) {
      const hasMissingAlt = alt === undefined || alt === null || alt.trim() === "";
      images.push({ src, alt, hasMissingAlt });

      if (!src || src.startsWith("data:")) continue;

      try {
        const absoluteUrl = new URL(src, baseUrl).href;
        const isModernFormat = /\.(webp|avif)$/i.test(absoluteUrl);

        if (!isModernFormat && /\.(jpg|jpeg|png|gif)$/i.test(absoluteUrl)) {
          unoptimizedCount++;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(absoluteUrl, {
            method: "HEAD",
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const contentLength = response.headers.get("content-length");
          if (contentLength) {
            const sizeKB = parseInt(contentLength) / 1024;
            if (sizeKB > 200) {
              oversizedImages.push({
                src: absoluteUrl,
                size: Math.round(sizeKB),
                suggestedSize: Math.round(sizeKB * 0.3),
              });
            }
          }
        } catch {
          clearTimeout(timeout);
        }
      } catch {}
    }

    const missingAltCount = images.filter((img) => img.hasMissingAlt).length;

    if (missingAltCount > 0) {
      issues.push(
        createIssue("images_missing_alt", {
          description: `${missingAltCount} of ${images.length} images are missing alt text`,
        })
      );
    }

    if (oversizedImages.length > 0) {
      issues.push(
        createIssue("oversized_images", {
          id: "oversized_images",
          title: "Oversized Images Detected",
          description: `${oversizedImages.length} images are larger than 200KB and should be optimized`,
          severity: "warning",
          category: "performance",
          recommendation:
            "Compress images using tools like TinyPNG or Squoosh. Consider using WebP format for better compression.",
          impact: "Large images slow down page load and hurt Core Web Vitals scores.",
          effort: "medium",
        })
      );
    }

    if (unoptimizedCount > 0) {
      issues.push(
        createIssue("unoptimized_images", {
          id: "unoptimized_images",
          title: "Images Not Using Modern Formats",
          description: `${unoptimizedCount} images could use WebP or AVIF format for better compression`,
          severity: "info",
          category: "performance",
          recommendation:
            "Convert images to WebP format which provides 25-35% smaller file sizes compared to JPEG/PNG.",
          impact: "Modern image formats improve page load speed with no quality loss.",
          effort: "medium",
        })
      );
    }

    return {
      total: images.length,
      missingAlt: missingAltCount,
      images,
      oversizedImages,
      unoptimizedCount,
    };
  }

  private async extractLinks(
    $: cheerio.CheerioAPI,
    baseUrl: string,
    context: ScannerContext,
    issues: AuditIssue[]
  ) {
    const internal: string[] = [];
    const external: string[] = [];
    const nofollow: string[] = [];
    const baseHost = new URL(baseUrl).hostname;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const rel = $(el).attr("rel") || "";

      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return;
      }

      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        const linkHost = new URL(absoluteUrl).hostname;

        if (rel.includes("nofollow")) {
          nofollow.push(absoluteUrl);
        }

        if (linkHost === baseHost) {
          if (!internal.includes(absoluteUrl)) {
            internal.push(absoluteUrl);
          }
        } else {
          if (!external.includes(absoluteUrl)) {
            external.push(absoluteUrl);
          }
        }
      } catch {
      }
    });

    const broken: BrokenLink[] = await this.checkBrokenLinks(
      [...internal, ...external].slice(0, 50),
      baseUrl,
      $,
      context
    );

    if (broken.length > 0) {
      issues.push(
        createIssue("broken_links", {
          description: `Found ${broken.length} broken links on the page`,
        })
      );
    }

    return {
      internal,
      external,
      broken,
      total: internal.length + external.length,
      nofollow,
    };
  }

  private async checkBrokenLinks(
    urls: string[],
    pageUrl: string,
    $: cheerio.CheerioAPI,
    context: ScannerContext
  ): Promise<BrokenLink[]> {
    context.onProgress?.("Checking for broken links...");

    const broken: BrokenLink[] = [];
    const checkPromises = urls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeout);

        if (response.status >= 400) {
          const anchorEl = $(`a[href="${url}"], a[href^="${url}"]`);
          broken.push({
            url,
            statusCode: response.status,
            statusText: response.statusText,
            foundOn: pageUrl,
            anchorText: anchorEl.first().text().trim() || undefined,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          broken.push({
            url,
            statusCode: 0,
            statusText: "Connection failed",
            foundOn: pageUrl,
          });
        }
      }
    });

    await Promise.all(checkPromises);
    return broken;
  }

  private extractStructuredData(
    $: cheerio.CheerioAPI,
    _issues: AuditIssue[]
  ): StructuredDataInfo[] {
    const structuredData: StructuredDataInfo[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const parsed = JSON.parse(content);
          const type = parsed["@type"] || "Unknown";
          structuredData.push({
            type: Array.isArray(type) ? type.join(", ") : type,
            isValid: true,
          });
        }
      } catch {
        structuredData.push({
          type: "Invalid JSON-LD",
          isValid: false,
          errors: ["Failed to parse JSON-LD"],
        });
      }
    });

    return structuredData;
  }

  private async checkSitemap(
    baseUrl: string,
    context: ScannerContext
  ): Promise<SitemapInfo> {
    context.onProgress?.("Checking sitemap...");

    const sitemapUrls = [
      new URL("/sitemap.xml", baseUrl).href,
      new URL("/sitemap_index.xml", baseUrl).href,
      new URL("/sitemap/sitemap.xml", baseUrl).href,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, {
          method: "GET",
          headers: { Accept: "application/xml, text/xml" },
        });

        if (response.ok) {
          const content = await response.text();
          const urlMatches = content.match(/<loc>/g);

          return {
            exists: true,
            url: sitemapUrl,
            urlCount: urlMatches?.length || 0,
            issues: [],
          };
        }
      } catch {
      }
    }

    return {
      exists: false,
      url: null,
      issues: ["No sitemap found at common locations"],
    };
  }

  private async checkRobots(
    baseUrl: string,
    context: ScannerContext
  ): Promise<RobotsInfo> {
    context.onProgress?.("Checking robots.txt...");

    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const issues: string[] = [];

    try {
      const response = await fetch(robotsUrl);

      if (response.ok) {
        const content = await response.text();
        const sitemapMatches = content.match(/Sitemap:\s*(.+)/gi) || [];
        const sitemapUrls = sitemapMatches.map((m) =>
          m.replace(/Sitemap:\s*/i, "").trim()
        );

        const disallowAll = content.includes("Disallow: /\n") ||
          content.includes("Disallow: /\r");
        const allowsIndexing = !disallowAll;

        if (!allowsIndexing) {
          issues.push("Site blocks all crawlers");
        }

        return {
          exists: true,
          content,
          allowsIndexing,
          sitemapUrls,
          issues,
        };
      }
    } catch {
    }

    return {
      exists: false,
      content: null,
      allowsIndexing: true,
      sitemapUrls: [],
      issues: ["No robots.txt found"],
    };
  }
}
