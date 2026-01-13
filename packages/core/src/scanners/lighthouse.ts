import lighthouse from "lighthouse";
import type { Scanner, ScannerContext } from "./types";
import type {
  FundamentalsData,
  SpeedOpportunity,
  AuditIssue,
  AccessibilityData,
  AccessibilityViolation,
  AccessibilityLevelSummary,
} from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

interface LighthouseResult {
  lhr: {
    categories: Record<string, { score: number | null }>;
    audits: Record<
      string,
      {
        id: string;
        title: string;
        description: string;
        score: number | null;
        numericValue?: number;
        details?: {
          type: string;
          overallSavingsMs?: number;
          items?: Array<{
            node?: { selector?: string };
            impact?: string;
            help?: string;
          }>;
        };
      }
    >;
  };
}

const WCAG_MAPPING: Record<string, { level: "A" | "AA" | "AAA" }> = {
  "button-name": { level: "A" },
  "color-contrast": { level: "AA" },
  "document-title": { level: "A" },
  "html-has-lang": { level: "A" },
  "image-alt": { level: "A" },
  "input-image-alt": { level: "A" },
  "label": { level: "A" },
  "link-name": { level: "A" },
  "list": { level: "A" },
  "listitem": { level: "A" },
  "meta-viewport": { level: "AA" },
  "bypass": { level: "A" },
  "frame-title": { level: "A" },
  "heading-order": { level: "AA" },
  "aria-allowed-attr": { level: "A" },
  "aria-hidden-body": { level: "A" },
  "aria-hidden-focus": { level: "A" },
  "aria-required-attr": { level: "A" },
  "aria-valid-attr": { level: "A" },
  "aria-valid-attr-value": { level: "A" },
  "form-field-multiple-labels": { level: "A" },
  "duplicate-id-aria": { level: "A" },
  "tabindex": { level: "A" },
  "td-headers-attr": { level: "A" },
  "th-has-data-cells": { level: "A" },
  "valid-lang": { level: "A" },
  "video-caption": { level: "A" },
  "accesskeys": { level: "A" },
  "focus-traps": { level: "A" },
  "interactive-element-affordance": { level: "A" },
  "logical-tab-order": { level: "A" },
  "managed-focus": { level: "A" },
  "use-landmarks": { level: "AA" },
  "visual-order-follows-dom": { level: "A" },
  "target-size": { level: "AAA" },
};

export class LighthouseScanner implements Scanner<FundamentalsData> {
  id = "lighthouse";
  name = "Core Fundamentals";

  async run(context: ScannerContext): Promise<FundamentalsData> {
    context.onProgress?.("Running Lighthouse audit...");

    const result = (await lighthouse(context.url, {
      port: context.browserPort,
      output: "json",
      logLevel: "error",
      disableStorageReset: true,
    })) as LighthouseResult | undefined;

    if (!result?.lhr) {
      throw new Error("Lighthouse failed to produce results");
    }

    const { lhr } = result;
    const categories = lhr.categories;
    const audits = lhr.audits;
    const issues: AuditIssue[] = [];

    const getScore = (category: string): number => {
      const score = categories[category]?.score;
      return Math.round((score ?? 0) * 100);
    };

    const getNumericValue = (auditId: string): number | undefined => {
      return audits[auditId]?.numericValue;
    };

    const viewportAudit = audits["viewport"];
    const fontSizeAudit = audits["font-size"];
    const tapTargetsAudit = audits["tap-targets"];

    const opportunities = this.extractOpportunities(audits);
    this.addPerformanceIssues(audits, issues);
    this.addMobileIssues(viewportAudit, categories, issues);

    return {
      scores: {
        performance: getScore("performance"),
        accessibility: getScore("accessibility"),
        bestPractices: getScore("best-practices"),
        seo: getScore("seo"),
      },
      metrics: {
        tti: getNumericValue("interactive"),
        lcp: getNumericValue("largest-contentful-paint"),
        cls: getNumericValue("cumulative-layout-shift"),
        fcp: getNumericValue("first-contentful-paint"),
        si: getNumericValue("speed-index"),
        tbt: getNumericValue("total-blocking-time"),
        ttfb: getNumericValue("server-response-time"),
      },
      mobile: {
        isMobileFriendly: categories["seo"]?.score
          ? categories["seo"].score >= 0.9
          : false,
        viewportConfigured: viewportAudit?.score === 1,
        fontSizeOk: fontSizeAudit?.score === 1,
        tapTargetsOk: tapTargetsAudit?.score === 1,
      },
      opportunities,
      issues,
    };
  }

  extractAccessibilityData(
    audits: LighthouseResult["lhr"]["audits"],
    overallScore: number
  ): AccessibilityData {
    const violations: AccessibilityViolation[] = [];
    const issues: AuditIssue[] = [];

    const levelA: AccessibilityLevelSummary = { passed: 0, failed: 0, violations: [] };
    const levelAA: AccessibilityLevelSummary = { passed: 0, failed: 0, violations: [] };
    const levelAAA: AccessibilityLevelSummary = { passed: 0, failed: 0, violations: [] };

    for (const [auditId, audit] of Object.entries(audits)) {
      const wcagInfo = WCAG_MAPPING[auditId];
      if (!wcagInfo) continue;

      const passed = audit.score === 1;
      const level = wcagInfo.level;

      if (level === "A") {
        passed ? levelA.passed++ : levelA.failed++;
        if (!passed) levelA.violations.push(audit.title);
      } else if (level === "AA") {
        passed ? levelAA.passed++ : levelAA.failed++;
        if (!passed) levelAA.violations.push(audit.title);
      } else if (level === "AAA") {
        passed ? levelAAA.passed++ : levelAAA.failed++;
        if (!passed) levelAAA.violations.push(audit.title);
      }

      if (!passed && audit.score !== null) {
        const impact = this.mapScoreToImpact(audit.score);
        const nodeCount = audit.details?.items?.length || 1;

        violations.push({
          id: auditId,
          impact,
          description: audit.title,
          helpUrl: `https://web.dev/${auditId}`,
          wcagLevel: level,
          nodes: nodeCount,
          recommendation: audit.description,
        });
      }
    }

    let wcagLevel: AccessibilityData["wcagLevel"] = "None";
    if (levelA.failed === 0 && levelAA.failed === 0 && levelAAA.failed === 0) {
      wcagLevel = "AAA";
    } else if (levelA.failed === 0 && levelAA.failed === 0) {
      wcagLevel = "AA";
    } else if (levelA.failed === 0) {
      wcagLevel = "A";
    }

    if (levelA.failed > 0) {
      issues.push(
        createIssue("wcag_level_a_violations", {
          description: `${levelA.failed} WCAG Level A violations found`,
        })
      );
    }

    if (levelAA.failed > 0) {
      issues.push(
        createIssue("wcag_level_aa_violations", {
          description: `${levelAA.failed} WCAG Level AA violations found`,
        })
      );
    }

    return {
      score: overallScore,
      wcagLevel,
      violations: violations.sort(
        (a, b) => this.impactOrder(b.impact) - this.impactOrder(a.impact)
      ),
      levelA,
      levelAA,
      levelAAA,
      issues,
    };
  }

  private extractOpportunities(
    audits: LighthouseResult["lhr"]["audits"]
  ): SpeedOpportunity[] {
    const opportunities: SpeedOpportunity[] = [];

    const opportunityAudits = [
      "render-blocking-resources",
      "unused-css-rules",
      "unused-javascript",
      "modern-image-formats",
      "offscreen-images",
      "unminified-css",
      "unminified-javascript",
      "uses-responsive-images",
      "efficient-animated-content",
      "uses-optimized-images",
      "uses-text-compression",
      "server-response-time",
      "redirects",
      "uses-rel-preconnect",
      "uses-rel-preload",
      "font-display",
      "third-party-summary",
    ];

    for (const auditId of opportunityAudits) {
      const audit = audits[auditId];
      if (!audit) continue;

      const savings = audit.details?.overallSavingsMs || 0;
      if (savings > 0 || audit.score === 0) {
        opportunities.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          savings: Math.round(savings),
        });
      }
    }

    return opportunities.sort((a, b) => b.savings - a.savings);
  }

  private addPerformanceIssues(
    audits: LighthouseResult["lhr"]["audits"],
    issues: AuditIssue[]
  ) {
    const lcp = audits["largest-contentful-paint"]?.numericValue;
    const cls = audits["cumulative-layout-shift"]?.numericValue;
    const tbt = audits["total-blocking-time"]?.numericValue;
    const tti = audits["interactive"]?.numericValue;

    if (lcp && lcp > 2500) {
      issues.push(
        createIssue("large_lcp", {
          description: `LCP is ${(lcp / 1000).toFixed(1)}s (target: under 2.5s)`,
        })
      );
    }

    if (cls && cls > 0.1) {
      issues.push(
        createIssue("high_cls", {
          description: `CLS is ${cls.toFixed(3)} (target: under 0.1)`,
        })
      );
    }

    if (tbt && tbt > 300) {
      issues.push(
        createIssue("high_tbt", {
          description: `TBT is ${Math.round(tbt)}ms (target: under 300ms)`,
        })
      );
    }

    if (tti && tti > 5000) {
      issues.push(
        createIssue("slow_page_load", {
          description: `Time to Interactive is ${(tti / 1000).toFixed(1)}s (target: under 5s)`,
        })
      );
    }
  }

  private addMobileIssues(
    viewportAudit: LighthouseResult["lhr"]["audits"][string] | undefined,
    categories: LighthouseResult["lhr"]["categories"],
    issues: AuditIssue[]
  ) {
    if (viewportAudit?.score !== 1) {
      issues.push(createIssue("not_mobile_friendly"));
    }

    const seoScore = categories["seo"]?.score ?? 0;
    if (seoScore < 0.9 && viewportAudit?.score !== 1) {
      issues.push(
        createIssue("not_mobile_friendly", {
          description:
            "Page is not optimized for mobile devices. Configure viewport meta tag.",
        })
      );
    }
  }

  private mapScoreToImpact(
    score: number | null
  ): AccessibilityViolation["impact"] {
    if (score === null || score === 0) return "critical";
    if (score < 0.5) return "serious";
    if (score < 0.9) return "moderate";
    return "minor";
  }

  private impactOrder(impact: AccessibilityViolation["impact"]): number {
    const order = { critical: 4, serious: 3, moderate: 2, minor: 1 };
    return order[impact];
  }
}
