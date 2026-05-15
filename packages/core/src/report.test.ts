import { describe, expect, test } from "bun:test";
import type { AuditFacts, ScoreBreakdowns } from "@sitelens/shared/types";
import { buildSitelensReport } from "./report";

const scoreBreakdowns: ScoreBreakdowns = {
  performance: makeBreakdown("performance", "Performance", 72, 0.25),
  visibility: makeBreakdown("visibility", "Findability", 88, 0.25),
  security: makeBreakdown("security", "Security", 94, 0.2),
  accessibility: makeBreakdown("accessibility", "Accessibility", 80, 0.15),
  trust: makeBreakdown("trust", "Credibility", 76, 0.15),
};

const facts = {
  content: {
    title: "Example Site",
    images: {
      missingAlt: 3,
    },
  },
} as AuditFacts;

describe("buildSitelensReport", () => {
  test("maps scanner output into the canonical report 0.2 shape", () => {
    const report = buildSitelensReport({
      id: "report-123",
      url: "https://example.com",
      generatedAt: "2026-05-05T12:00:05.000Z",
      scores: {
        overall: 82,
        performance: 72,
        visibility: 88,
        security: 94,
        accessibility: 80,
        trust: 76,
      },
      scoreBreakdowns,
      facts,
      suggestions: {
        quickWins: [
          {
            id: "missing-alt",
            title: "Add image alt text",
            description: "Some images are missing alt text.",
            category: "accessibility",
            impact: "high",
            effort: "low",
            relatedFact: "content.images.missingAlt",
            howToFix: "Add descriptive alt text to meaningful images.",
          },
        ],
        priorityFixes: [],
        niceToHave: [],
      },
      assets: {
        screenshots: [
          {
            name: "desktop",
            width: 1440,
            height: 900,
            path: "assets/screenshots/desktop.png",
          },
        ],
      },
    });

    expect(report.metadata).toEqual({
      id: "report-123",
      url: "https://example.com",
      generatedAt: "2026-05-05T12:00:05.000Z",
    });
    expect(report.pages[0]).toMatchObject({
      url: "https://example.com",
      title: "Example Site",
      role: "primary",
      screenshotRefs: ["assets/screenshots/desktop.png"],
    });
    expect(report.categories).toHaveLength(5);
    expect(report.categories.find((category) => category.key === "accessibility")?.findingRefs).toEqual([
      report.findings[0]!.id,
    ]);
    expect(report.findings[0]).toMatchObject({
      category: "accessibility",
      title: "Add image alt text",
      impact: "high",
      effort: "low",
      rank: 0,
      categoryRank: 0,
      fix: "Add descriptive alt text to meaningful images.",
      source: {
        type: "scanner",
        ruleId: "missing-alt",
      },
    });
    expect(report.evidence[0]).toMatchObject({
      type: "fact",
      source: "scanner",
      label: "content.images.missingAlt",
      value: 3,
    });
    expect(report).not.toHaveProperty("status");
    expect(report).not.toHaveProperty("views");
    expect(report.extensions).toEqual([]);
  });
});

function makeBreakdown(
  category: keyof ScoreBreakdowns,
  label: string,
  score: number,
  weight: number
): ScoreBreakdowns[keyof ScoreBreakdowns] {
  return {
    category,
    categoryLabel: label,
    categoryDescription: `${label} summary`,
    score,
    maxScore: 100,
    weight,
    weightExplanation: "",
    baseScore: score,
    deductions: [],
    bonuses: [],
    tips: [],
  };
}
