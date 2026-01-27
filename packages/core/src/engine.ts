import { BrowserManager, type Screenshot } from "./browser";
import {
  LighthouseScanner,
  SeoScanner,
  SocialScanner,
  TechScanner,
  LocalScanner,
  LocalPresenceScanner,
  ReviewsScanner,
  AdvertisingScanner,
  EcommerceScanner,
} from "./scanners";
import type {
  AuditScores,
  FundamentalsData,
  SeoData,
  SocialData,
  TechData,
  LocalData,
  LocalPresenceData,
  ReviewsData,
  Screenshots,
  AdvertisingData,
  EcommerceData,
  AccessibilityData,
  ReportSummary,
} from "@sitelens/shared/types";
import type { ValidatedAuditConfig } from "./config";
import {
  generateSummary,
  calculateOverallScore,
  calculateCategoryScores,
  calculateNewScores,
  generateNewScoreBreakdowns,
  extractFacts,
  generateNewSuggestions,
} from "./summary";
import { createIssue } from "./recommendations";
import type { AuditIssue } from "@sitelens/shared/types";
import type {
  NewAuditScores,
  ScoreBreakdowns,
  AuditFacts,
  AuditSuggestions,
} from "@sitelens/shared/types";

export interface ProgressCallback {
  (progress: number, message: string): void;
}

// Legacy result format (for backward compatibility)
export interface AuditResult {
  screenshots: Screenshots;
  scores: AuditScores;
  summary: ReportSummary;
  details: {
    fundamentals: FundamentalsData;
    seo: SeoData;
    social: SocialData;
    tech: TechData;
    local: LocalData;
    localPresence: LocalPresenceData;
    reviews: ReviewsData;
    advertising: AdvertisingData;
    ecommerce: EcommerceData;
    accessibility: AccessibilityData;
  };
}

// New result format with separated facts/scores/suggestions
export interface NewAuditEngineResult {
  // Raw screenshot buffers as generic array (for storage layer to save separately)
  screenshots: Screenshot[];
  // New separated structure
  newScores: NewAuditScores;
  scoreBreakdowns: ScoreBreakdowns;
  facts: AuditFacts;
  suggestions: AuditSuggestions;
  // Legacy data (for backward compatibility during transition)
  legacy: AuditResult;
}

interface ScannerResult<T> {
  data: T;
  failed: boolean;
  error?: string;
}

export class AuditEngine {
  private browserManager: BrowserManager;
  private lighthouseScanner: LighthouseScanner;
  private seoScanner: SeoScanner;
  private socialScanner: SocialScanner;
  private techScanner: TechScanner;
  private localScanner: LocalScanner;
  private localPresenceScanner: LocalPresenceScanner;
  private reviewsScanner: ReviewsScanner;
  private advertisingScanner: AdvertisingScanner;
  private ecommerceScanner: EcommerceScanner;
  private scannerErrors: AuditIssue[] = [];

  constructor() {
    this.browserManager = new BrowserManager();
    this.lighthouseScanner = new LighthouseScanner();
    this.seoScanner = new SeoScanner();
    this.socialScanner = new SocialScanner();
    this.techScanner = new TechScanner();
    this.localScanner = new LocalScanner();
    this.localPresenceScanner = new LocalPresenceScanner();
    this.reviewsScanner = new ReviewsScanner();
    this.advertisingScanner = new AdvertisingScanner();
    this.ecommerceScanner = new EcommerceScanner();
  }

  private async runScanner<T>(
    name: string,
    scannerFn: () => Promise<T>,
    defaultValue: T
  ): Promise<ScannerResult<T>> {
    try {
      console.log(`[Engine] Starting ${name}...`);
      const startTime = Date.now();
      const data = await scannerFn();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Engine] ${name} completed in ${elapsed}s`);
      return { data, failed: false };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Engine] ${name} FAILED: ${errorMsg}`);
      this.scannerErrors.push(
        createIssue("scanner_failed", {
          title: `${name} Failed`,
          description: `${name} failed: ${errorMsg}`,
        })
      );
      return { data: defaultValue, failed: true, error: errorMsg };
    }
  }

  async run(
    config: ValidatedAuditConfig,
    onProgress?: ProgressCallback
  ): Promise<NewAuditEngineResult> {
    // Reset scanner errors for each run
    this.scannerErrors = [];

    let currentProgress = 0;
    const report = (progress: number, message: string) => {
      currentProgress = progress;
      onProgress?.(progress, message);
    };

    try {
      report(5, "Launching browser...");
      await this.browserManager.launch();

      report(10, "Loading page...");
      const { page, resolvedUrl } = await this.browserManager.getPage(config.url);

      report(15, "Extracting HTML...");
      const html = await this.browserManager.getHtml(page);

      // Use the resolved URL (with correct protocol) for all operations
      const context = {
        url: resolvedUrl,
        page,
        html,
        browserPort: this.browserManager.getPort(),
        onProgress: (msg: string) => report(currentProgress, msg),
      };

      // Default values for failed scanners
      const defaultFundamentals: FundamentalsData = {
        scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
        metrics: {},
        mobile: { isMobileFriendly: false, viewportConfigured: false, fontSizeOk: false, tapTargetsOk: false },
        opportunities: [],
        diagnostics: {},
        issues: [],
      };
      const defaultSeo: SeoData = {
        meta: { title: null, description: null, canonical: null, robots: null, titleLength: 0, descriptionLength: 0, titleLengthOk: false, descriptionLengthOk: false, hasHreflang: false, language: null },
        headings: { h1Count: 0, structure: [], structureOk: false, issues: [] },
        content: { wordCount: 0, isThinContent: true, readingLevel: 0, readingEase: 0, readingEaseLabel: "Unknown", spellingErrors: [], paragraphCount: 0, avgSentenceLength: 0 },
        images: { total: 0, missingAlt: 0, images: [], oversizedImages: [], unoptimizedCount: 0 },
        links: { internal: [], external: [], broken: [], total: 0, nofollow: [] },
        structuredData: [],
        sitemap: { exists: false, url: null, issues: [] },
        robots: { exists: false, content: null, allowsIndexing: false, sitemapUrls: [], issues: [] },
        issues: [],
      };
      const defaultSocial: SocialData = {
        openGraph: { hasTitle: false, hasDescription: false, hasImage: false, isComplete: false, data: { title: null, description: null, image: null, url: null, type: null, siteName: null } },
        twitter: { hasCard: false, data: { card: null, title: null, description: null, image: null, site: null } },
        profiles: {},
        profileDetails: [],
        issues: [],
      };
      const defaultTech: TechData = {
        security: { isHTTPS: false, hasHSTS: false, mixedContent: false, securityHeaders: [], gdprCompliance: { hasPrivacyPolicy: false, hasCookieBanner: false, hasCookiePolicy: false, issues: [] }, issues: [] },
        analytics: { googleAnalytics: false, googleAnalytics4: false, googleTagManager: false, facebookPixel: false, hotjar: false, mixpanel: false, segment: false, otherTrackers: [] },
        advertising: { paidSearch: { googleAds: false, bingAds: false, detected: false, issues: [] }, socialAds: { facebookAds: false, instagramAds: false, linkedinAds: false, twitterAds: false, detected: false }, retargeting: { googleRemarketing: false, facebookPixel: false, otherPixels: [], detected: false }, displayAds: { googleDisplayNetwork: false, otherNetworks: [], detected: false }, issues: [] },
        technologies: [],
        cdns: [],
        issues: [],
      };
      const defaultLocal: LocalData = { phones: [], addresses: [], emails: [] };
      const defaultLocalPresence: LocalPresenceData = {
        businessName: null,
        googleBusinessProfile: { exists: false, url: null, verified: false, complete: false, issues: [] },
        googleMaps: { listed: false, accurate: false, issues: [] },
        bingPlaces: { listed: false, accurate: false, issues: [] },
        appleBusinessConnect: { listed: false, issues: [] },
        directories: [],
        napConsistency: { consistent: false, name: { value: null, variations: [], isConsistent: false }, address: { value: null, variations: [], isConsistent: false }, phone: { value: null, variations: [], isConsistent: false }, issues: [] },
        phones: [],
        addresses: [],
        emails: [],
        issues: [],
      };
      const defaultReviews: ReviewsData = {
        overall: { averageRating: 0, totalReviews: 0, recentReviews: 0 },
        platforms: [],
        websiteShowsReviews: false,
        testimonialPage: null,
        issues: [],
      };
      const defaultAdvertising: AdvertisingData = {
        paidSearch: { googleAds: false, bingAds: false, detected: false, issues: [] },
        socialAds: { facebookAds: false, instagramAds: false, linkedinAds: false, twitterAds: false, detected: false },
        retargeting: { googleRemarketing: false, facebookPixel: false, otherPixels: [], detected: false },
        displayAds: { googleDisplayNetwork: false, otherNetworks: [], detected: false },
        issues: [],
      };
      const defaultEcommerce: EcommerceData = {
        hasEcommerce: false,
        platform: { name: null, detected: false },
        paymentProcessors: [],
        cartFunctionality: false,
        sslOnCheckout: false,
        productSchema: false,
        issues: [],
      };

      // Run Lighthouse FIRST while browser state is clean (before any parallel contexts)
      report(20, "Running Lighthouse audit...");
      const { data: fundamentals } = await this.runScanner(
        "Lighthouse Audit",
        () => this.lighthouseScanner.run(context),
        defaultFundamentals
      );

      // Capture screenshots AFTER Lighthouse to avoid debugging port conflicts
      report(35, "Capturing screenshots...");
      const capturedScreenshots = await this.browserManager.captureScreenshotBuffers(page, resolvedUrl);

      // Legacy screenshots format - find desktop and mobile from captured array
      const desktopScreenshot = capturedScreenshots.find(s => s.name === "desktop");
      const mobileScreenshot = capturedScreenshots.find(s => s.name === "mobile");
      const screenshots = {
        desktop: desktopScreenshot?.buffer.toString("base64") || "",
        mobile: mobileScreenshot?.buffer.toString("base64") || "",
      };

      const accessibility = this.lighthouseScanner.extractAccessibilityData(
        {},
        fundamentals.scores.accessibility
      );

      report(50, "Analyzing SEO...");
      const { data: seo } = await this.runScanner("SEO Analysis", () => this.seoScanner.run(context), defaultSeo);

      report(60, "Checking social presence...");
      const { data: social } = await this.runScanner("Social Presence", () => this.socialScanner.run(context), defaultSocial);

      report(65, "Detecting technologies and platforms...");
      const { data: tech } = await this.runScanner("Technology Detection", () => this.techScanner.run(context), defaultTech);

      report(70, "Detecting advertising platforms...");
      const { data: advertising } = await this.runScanner("Advertising Detection", () => this.advertisingScanner.run(context), defaultAdvertising);

      report(75, "Checking e-commerce features...");
      const { data: ecommerce } = await this.runScanner("E-commerce Detection", () => this.ecommerceScanner.run(context), defaultEcommerce);

      report(80, "Finding local business info...");
      const { data: local } = await this.runScanner("Local Business Info", () => this.localScanner.run(context), defaultLocal);

      report(83, "Analyzing local presence...");
      const { data: localPresence } = await this.runScanner("Local Presence", () => this.localPresenceScanner.run(context), defaultLocalPresence);

      report(86, "Checking reviews...");
      const { data: reviews } = await this.runScanner("Reviews Check", () => this.reviewsScanner.run(context), defaultReviews);

      await page.close();

      // Add any scanner errors to fundamentals issues
      if (this.scannerErrors.length > 0) {
        fundamentals.issues = [...fundamentals.issues, ...this.scannerErrors];
        console.log(`[Engine] ${this.scannerErrors.length} scanner(s) failed, continuing with partial results`);
      }

      report(92, "Calculating scores...");

      const partialReport = {
        id: "",
        url: resolvedUrl,
        status: "completed" as const,
        createdAt: new Date().toISOString(),
        details: {
          fundamentals,
          seo,
          social,
          tech,
          local,
          localPresence,
          reviews,
          advertising,
          ecommerce,
          accessibility,
        },
      };

      // Legacy scoring (for backward compatibility)
      const categoryScores = calculateCategoryScores(partialReport);
      const overallScore = calculateOverallScore(categoryScores);

      const scores: AuditScores = {
        ...categoryScores,
        overall: overallScore,
      };

      const reportWithScores = { ...partialReport, scores };

      report(93, "Extracting facts...");
      const facts = extractFacts(reportWithScores, resolvedUrl);

      report(94, "Calculating new scores...");
      const newScores = calculateNewScores(reportWithScores);

      report(95, "Generating score breakdowns...");
      const scoreBreakdowns = generateNewScoreBreakdowns(reportWithScores);

      report(96, "Generating suggestions...");
      const suggestions = generateNewSuggestions(reportWithScores, newScores);

      report(97, "Generating legacy summary...");
      const summary = generateSummary(reportWithScores);

      report(100, "Complete");

      // Return both new and legacy formats
      return {
        screenshots: capturedScreenshots,
        newScores,
        scoreBreakdowns,
        facts,
        suggestions,
        legacy: {
          screenshots,
          scores,
          summary,
          details: {
            fundamentals,
            seo,
            social,
            tech,
            local,
            localPresence,
            reviews,
            advertising,
            ecommerce,
            accessibility,
          },
        },
      };
    } finally {
      await this.browserManager.close();
    }
  }
}

export async function runAudit(
  config: ValidatedAuditConfig,
  onProgress?: ProgressCallback
): Promise<NewAuditEngineResult> {
  const engine = new AuditEngine();
  return engine.run(config, onProgress);
}

// Legacy wrapper for backward compatibility
export async function runAuditLegacy(
  config: ValidatedAuditConfig,
  onProgress?: ProgressCallback
): Promise<AuditResult> {
  const result = await runAudit(config, onProgress);
  return result.legacy;
}
