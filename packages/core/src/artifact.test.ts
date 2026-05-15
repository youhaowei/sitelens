import { describe, expect, test } from "bun:test";
import type { SitelensReport } from "@sitelens/shared/types";
import {
  createSitelensArtifact,
  parseSitelensArtifact,
  serializeSitelensArtifact,
  validateSitelensArtifact,
} from "./artifact";

function makeReport(): SitelensReport {
  return {
    metadata: {
      id: "report-123",
      url: "https://example.com",
      generatedAt: "2026-05-05T12:00:05.000Z",
    },
    pages: [
      {
        id: "page:home",
        url: "https://example.com",
        role: "primary",
        screenshotRefs: ["assets/screenshots/desktop.png"],
      },
    ],
    scores: {
      overall: 80,
      performance: 75,
      visibility: 82,
      security: 90,
      accessibility: 70,
      trust: 84,
    },
    categories: [
      {
        key: "performance",
        label: "Performance",
        score: 75,
        summary: "Page speed, loading time, and runtime efficiency",
        findingRefs: ["f:performance:lcp"],
      },
      {
        key: "visibility",
        label: "Findability",
        score: 82,
        summary: "SEO and local visibility",
        findingRefs: [],
      },
      {
        key: "security",
        label: "Security",
        score: 90,
        summary: "HTTPS, headers, and security best practices",
        findingRefs: [],
      },
      {
        key: "accessibility",
        label: "Accessibility",
        score: 70,
        summary: "Assistive technology and usability",
        findingRefs: [],
      },
      {
        key: "trust",
        label: "Credibility",
        score: 84,
        summary: "Contact info, reviews, and trust signals",
        findingRefs: [],
      },
    ],
    findings: [
      {
        id: "f:performance:lcp",
        category: "performance",
        title: "Largest Contentful Paint is slow",
        summary: "The main content takes too long to appear.",
        severity: "warning",
        impact: "high",
        effort: "medium",
        rank: 0,
        categoryRank: 0,
        evidenceRefs: ["e:lcp"],
        fix: "Optimize the largest above-the-fold asset.",
        source: {
          type: "scanner",
          ruleId: "lcp",
        },
      },
    ],
    evidence: [
      {
        id: "e:lcp",
        type: "metric",
        source: "lighthouse",
        label: "Largest Contentful Paint",
        pageRef: "page:home",
        metric: {
          key: "lcp",
          value: 4200,
          unit: "ms",
        },
      },
    ],
    assets: {
      screenshots: [
        {
          name: "desktop",
          width: 1440,
          height: 1600,
          path: "assets/screenshots/desktop.png",
        },
      ],
    },
    extensions: [],
  };
}

describe("Sitelens artifact", () => {
  test("creates a portable .sitelens artifact with manifest, report, and binary assets", () => {
    const report = makeReport();
    const artifact = createSitelensArtifact(report, [
      {
        path: "assets/screenshots/desktop.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
    ]);

    expect(artifact.manifest.schema).toBe("sitelens.report");
    expect(artifact.manifest.schemaVersion).toBe("0.2.0");
    expect(artifact.manifest.assets).toEqual([
      {
        path: "assets/screenshots/desktop.png",
        mediaType: "image/png",
        byteLength: 4,
      },
    ]);
    expect(artifact.report).toEqual(report);
    expect(artifact.assets).toHaveLength(1);
    expect(artifact.assets[0]?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(validateSitelensArtifact(artifact)).toEqual([]);
  });

  test("round-trips through serialized zip artifact content", () => {
    const artifact = createSitelensArtifact(makeReport(), [
      {
        path: "assets/screenshots/desktop.png",
        mediaType: "image/png",
        bytes: new Uint8Array([9, 8, 7]),
      },
    ]);

    const serialized = serializeSitelensArtifact(artifact);
    const parsed = parseSitelensArtifact(serialized);

    expect(serialized[0]).toBe(0x50);
    expect(serialized[1]).toBe(0x4b);
    expect(parsed).toEqual(artifact);
  });

  test("reports validation errors for missing referenced assets", () => {
    const artifact = createSitelensArtifact(makeReport(), []);

    expect(validateSitelensArtifact(artifact)).toContain(
      "Missing asset for referenced screenshot path: assets/screenshots/desktop.png"
    );
  });
});
