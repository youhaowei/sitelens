import { describe, expect, test } from "bun:test";
import type { NewAuditResult } from "@sitelens/shared/types";
import {
  createSitelensArtifact,
  parseSitelensArtifact,
  serializeSitelensArtifact,
  validateSitelensArtifact,
} from "./artifact";

function makeReport(): NewAuditResult {
  return {
    id: "report-123",
    url: "https://example.com",
    status: "completed",
    createdAt: "2026-05-05T12:00:00.000Z",
    completedAt: "2026-05-05T12:00:05.000Z",
    scores: {
      overall: 80,
      performance: 75,
      visibility: 82,
      security: 90,
      accessibility: 70,
      trust: 84,
    },
    scoreBreakdowns: {
      performance: {} as NewAuditResult["scoreBreakdowns"]["performance"],
      visibility: {} as NewAuditResult["scoreBreakdowns"]["visibility"],
      security: {} as NewAuditResult["scoreBreakdowns"]["security"],
      accessibility: {} as NewAuditResult["scoreBreakdowns"]["accessibility"],
      trust: {} as NewAuditResult["scoreBreakdowns"]["trust"],
    },
    facts: {} as NewAuditResult["facts"],
    suggestions: {
      quickWins: [],
      priorityFixes: [],
      niceToHave: [],
    },
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

    expect(artifact.manifest.kind).toBe("sitelens.report");
    expect(artifact.manifest.version).toBe(1);
    expect(artifact.manifest.audit.id).toBe(report.id);
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
