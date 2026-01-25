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

  async run(
    config: ValidatedAuditConfig,
    onProgress?: ProgressCallback
  ): Promise<NewAuditEngineResult> {
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

      // Run Lighthouse FIRST while browser state is clean (before any parallel contexts)
      report(20, "Running Lighthouse audit...");
      const fundamentals = await this.lighthouseScanner.run(context);

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
      const seo = await this.seoScanner.run(context);

      report(60, "Checking social presence...");
      const social = await this.socialScanner.run(context);

      report(65, "Detecting technologies and platforms...");
      const tech = await this.techScanner.run(context);

      report(70, "Detecting advertising platforms...");
      const advertising = await this.advertisingScanner.run(context);

      report(75, "Checking e-commerce features...");
      const ecommerce = await this.ecommerceScanner.run(context);

      report(80, "Finding local business info...");
      const local = await this.localScanner.run(context);

      report(83, "Analyzing local presence...");
      const localPresence = await this.localPresenceScanner.run(context);

      report(86, "Checking reviews...");
      const reviews = await this.reviewsScanner.run(context);

      await page.close();

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
