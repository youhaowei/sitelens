import { validateConfig, runAudit } from "@sitelens/core";
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

    printScores(result.scores);
    printSummary(result);

    await mkdir(config.output, { recursive: true });

    const reportId = crypto.randomUUID();

    if (config.format.includes("json")) {
      const jsonPath = join(config.output, `${reportId}.json`);
      const report = {
        id: reportId,
        url,
        status: "completed" as const,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        ...result,
      };
      await Bun.write(jsonPath, JSON.stringify(report, null, 2));
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
  performance: number;
  seo: number;
  social: number;
  accessibility: number;
}) {
  console.log("📊 Scores:");
  console.log("  ├─ Performance:   " + formatScore(scores.performance));
  console.log("  ├─ SEO:           " + formatScore(scores.seo));
  console.log("  ├─ Social:        " + formatScore(scores.social));
  console.log("  └─ Accessibility: " + formatScore(scores.accessibility));
  console.log();
}

function formatScore(score: number): string {
  const color =
    score >= 90 ? "\x1b[32m" : score >= 50 ? "\x1b[33m" : "\x1b[31m";
  const reset = "\x1b[0m";
  return `${color}${score}%${reset}`;
}

function printSummary(result: Awaited<ReturnType<typeof runAudit>>) {
  const { seo, social, tech } = result.details;

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
