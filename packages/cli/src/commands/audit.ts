import {
  createNewAuditResult,
  createSitelensArtifact,
  runAudit,
  serializeSitelensArtifact,
  validateConfig,
} from "@sitelens/core";
import type { NewAuditResult } from "@sitelens/shared/types";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

interface AuditOptions {
  output: string;
  format: string;
  device: string;
  deep?: boolean;
  timeout: string;
}

export async function auditCommand(url: string, options: AuditOptions) {
  console.log(`\n🔍 Starting audit for: ${url}\n`);

  try {
    const config = validateConfig({
      url,
      output: options.output,
      format: options.format.split(","),
      device: options.device,
      deep: options.deep ?? false,
      timeout: parseInt(options.timeout, 10),
    });

    const startTime = Date.now();

    const result = await runAudit(config, (progress, message) => {
      const bar = createProgressBar(progress);
      process.stdout.write(`\r${bar} ${message.padEnd(40)}`);
    });

    console.log("\n");

    printScores(result.newScores);
    printSummary(result);

    await mkdir(config.output, { recursive: true });

    const reportId = crypto.randomUUID();
    const completedAt = new Date().toISOString();
    const baseReport = createNewAuditResult(
      reportId,
      url,
      result.newScores,
      result.scoreBreakdowns,
      result.facts,
      result.suggestions,
      result.screenshots,
      completedAt
    );
    const report: NewAuditResult = {
      ...baseReport,
      assets: {
        screenshots: baseReport.assets.screenshots.map((screenshot) => ({
          ...screenshot,
          path: getScreenshotArtifactPath(screenshot.name),
        })),
      },
    };

    const unsupportedFormats = config.format.filter(
      (format) => format !== "sitelens" && format !== "json"
    );
    for (const format of unsupportedFormats) {
      console.warn(`⚠️  ${format.toUpperCase()} output is not implemented yet; skipping.`);
    }

    if (config.format.includes("sitelens")) {
      const artifactPath = join(config.output, `${reportId}.sitelens`);
      const artifact = createSitelensArtifact(
        report,
        result.screenshots.map((screenshot) => ({
          path: getScreenshotArtifactPath(screenshot.name),
          mediaType: "image/png",
          bytes: screenshot.buffer,
        })),
        {
          name: "sitelens-cli",
          version: "0.1.0",
        }
      );
      await Bun.write(artifactPath, serializeSitelensArtifact(artifact));
      console.log(`📦 Sitelens artifact saved: ${artifactPath}`);
    }

    if (config.format.includes("json")) {
      const jsonPath = join(config.output, `${reportId}.json`);
      await Bun.write(jsonPath, `${JSON.stringify(toJsonReport(report), null, 2)}\n`);
      console.log(`📄 JSON report saved: ${jsonPath}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Audit completed in ${duration}s\n`);
  } catch (error) {
    console.error(
      "\n❌ Audit failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

function createProgressBar(progress: number): string {
  const width = 30;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${progress
    .toString()
    .padStart(3)}%`;
}

function printScores(scores: {
  overall: number;
  performance: number;
  visibility: number;
  security: number;
  accessibility: number;
  trust: number;
}) {
  console.log("📊 Scores:");
  console.log("  ├─ Overall:       " + formatScore(scores.overall));
  console.log("  ├─ Performance:   " + formatScore(scores.performance));
  console.log("  ├─ Visibility:    " + formatScore(scores.visibility));
  console.log("  ├─ Security:      " + formatScore(scores.security));
  console.log("  ├─ Accessibility: " + formatScore(scores.accessibility));
  console.log("  └─ Trust:         " + formatScore(scores.trust));
  console.log();
}

function formatScore(score: number): string {
  const color =
    score >= 90 ? "\x1b[32m" : score >= 50 ? "\x1b[33m" : "\x1b[31m";
  const reset = "\x1b[0m";
  return `${color}${score}%${reset}`;
}

function printSummary(result: Awaited<ReturnType<typeof runAudit>>) {
  const { seo, social, tech } = result.legacy.details;

  console.log("📝 Summary:");

  if (!seo.meta.title) {
    console.log("  ⚠️  Missing page title");
  }
  if (!seo.meta.description) {
    console.log("  ⚠️  Missing meta description");
  }
  if (seo.headings.h1Count === 0) {
    console.log("  ⚠️  Missing H1 tag");
  } else if (seo.headings.h1Count > 1) {
    console.log(`  ⚠️  Multiple H1 tags (${seo.headings.h1Count})`);
  }
  if (seo.content.isThinContent) {
    console.log(`  ⚠️  Thin content (${seo.content.wordCount} words)`);
  }
  if (seo.images.missingAlt > 0) {
    console.log(`  ⚠️  Images missing alt text (${seo.images.missingAlt})`);
  }
  if (!social.openGraph.isComplete) {
    console.log("  ⚠️  Incomplete Open Graph tags");
  }
  if (!tech.security.isHTTPS) {
    console.log("  ⚠️  Site not using HTTPS");
  }

  console.log();

  if (tech.technologies.length > 0) {
    console.log("🔧 Technologies detected:", tech.technologies.join(", "));
  }

  const profileCount = Object.keys(social.profiles).length;
  if (profileCount > 0) {
    console.log(
      "📱 Social profiles found:",
      Object.keys(social.profiles).join(", ")
    );
  }
}

function getScreenshotArtifactPath(name: string): string {
  return `assets/screenshots/${name}.png`;
}

function toJsonReport(report: NewAuditResult): NewAuditResult {
  return report;
}
