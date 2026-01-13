import { mkdir, rm } from "node:fs/promises";
import type {
  NewAuditResult,
  AuditFacts,
  NewAuditScores,
  ScoreBreakdowns,
  AuditSuggestions,
  AssetReferences,
  AuditStatus,
  ScreenshotInfo,
} from "@sitelens/shared/types";
import type { Screenshot } from "./browser";

const REPORTS_DIR = "./reports";

// ============================================
// Report Storage Layer
// ============================================

export interface ReportMetadata {
  id: string;
  url: string;
  status: AuditStatus;
  createdAt: string;
  completedAt?: string;
  version: number; // Schema version for migrations
}

export interface StoredReport {
  metadata: ReportMetadata;
  scores: NewAuditScores;
  scoreBreakdowns: ScoreBreakdowns;
  facts: AuditFacts;
  suggestions: AuditSuggestions;
  assets: AssetReferences;
}

// Current schema version
const SCHEMA_VERSION = 1;

/**
 * Get the directory path for a report
 */
export function getReportDir(id: string): string {
  return `${REPORTS_DIR}/${id}`;
}

/**
 * Get the path to the report JSON file
 */
export function getReportJsonPath(id: string): string {
  return `${getReportDir(id)}/report.json`;
}

/**
 * Get the path to a screenshot file
 */
export function getScreenshotPath(id: string, name: string): string {
  return `${getReportDir(id)}/screenshots/${name}.png`;
}

/**
 * Save a new report with separated assets
 */
export async function saveReport(
  result: NewAuditResult,
  screenshots: Screenshot[]
): Promise<void> {
  const reportDir = getReportDir(result.id);
  const screenshotsDir = `${reportDir}/screenshots`;

  // Create directories
  await mkdir(screenshotsDir, { recursive: true });

  // Build screenshot references
  const screenshotRefs: ScreenshotInfo[] = screenshots.map((s) => ({
    name: s.name,
    width: s.width,
    height: s.height,
    path: `screenshots/${s.name}.png`,
  }));

  // Prepare stored report (without inline screenshots)
  const storedReport: StoredReport = {
    metadata: {
      id: result.id,
      url: result.url,
      status: result.status,
      createdAt: result.createdAt,
      completedAt: result.completedAt,
      version: SCHEMA_VERSION,
    },
    scores: result.scores,
    scoreBreakdowns: result.scoreBreakdowns,
    facts: result.facts,
    suggestions: result.suggestions,
    assets: {
      screenshots: screenshotRefs,
    },
  };

  // Write report JSON
  await Bun.write(
    getReportJsonPath(result.id),
    JSON.stringify(storedReport, null, 2)
  );

  // Write all screenshots as separate files
  await Promise.all(
    screenshots.map((s) =>
      Bun.write(getScreenshotPath(result.id, s.name), s.buffer)
    )
  );
}

/**
 * Load a report (JSON only, no screenshots)
 */
export async function loadReport(id: string): Promise<StoredReport | null> {
  const reportPath = getReportJsonPath(id);
  const file = Bun.file(reportPath);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return JSON.parse(content) as StoredReport;
}

/**
 * Load a screenshot file by name
 */
export async function loadScreenshot(
  id: string,
  name: string
): Promise<Buffer | null> {
  const screenshotPath = getScreenshotPath(id, name);
  const file = Bun.file(screenshotPath);

  if (!(await file.exists())) {
    return null;
  }

  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a report and all its assets
 */
export async function deleteReport(id: string): Promise<boolean> {
  const reportDir = getReportDir(id);

  try {
    await rm(reportDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all report IDs
 */
export async function listReportIds(): Promise<string[]> {
  const glob = new Bun.Glob("*/report.json");
  const ids: string[] = [];

  for await (const path of glob.scan(REPORTS_DIR)) {
    const id = path.split("/")[0];
    if (id) {
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Create a new report result with all required fields
 */
export function createNewAuditResult(
  id: string,
  url: string,
  scores: NewAuditScores,
  scoreBreakdowns: ScoreBreakdowns,
  facts: AuditFacts,
  suggestions: AuditSuggestions,
  screenshots: Screenshot[],
  completedAt?: string
): NewAuditResult {
  const now = new Date().toISOString();
  return {
    id,
    url,
    status: "completed",
    createdAt: now,
    completedAt: completedAt ?? now,
    scores,
    scoreBreakdowns,
    facts,
    suggestions,
    assets: {
      screenshots: screenshots.map((s) => ({
        name: s.name,
        width: s.width,
        height: s.height,
        path: `screenshots/${s.name}.png`,
      })),
    },
  };
}
