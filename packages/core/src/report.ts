import type {
  AuditFacts,
  AuditSuggestions,
  NewAuditScores,
  ScoreBreakdown,
  ScoreBreakdowns,
  SitelensAssetReferences,
  SitelensCategory,
  SitelensEvidence,
  SitelensFinding,
  SitelensReport,
} from "@sitelens/shared/types";

const CATEGORY_ORDER = [
  "performance",
  "visibility",
  "security",
  "accessibility",
  "trust",
] as const;

const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  performance: "Performance",
  visibility: "Findability",
  security: "Security",
  accessibility: "Accessibility",
  trust: "Credibility",
};

export interface BuildSitelensReportInput {
  id: string;
  url: string;
  canonicalUrl?: string;
  generatedAt?: string;
  scores: NewAuditScores;
  scoreBreakdowns: ScoreBreakdowns;
  facts: AuditFacts;
  suggestions: AuditSuggestions;
  assets: SitelensAssetReferences;
}

export function buildSitelensReport(input: BuildSitelensReportInput): SitelensReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pageId = createSemanticId("page", input.canonicalUrl ?? input.url);
  const evidenceById = new Map<string, SitelensEvidence>();
  const categoryRanks = new Map<string, number>();
  const suggestions = [
    ...input.suggestions.quickWins,
    ...input.suggestions.priorityFixes,
    ...input.suggestions.niceToHave,
  ];

  const findings: SitelensFinding[] = suggestions.map((suggestion, rank) => {
    const categoryRank = categoryRanks.get(suggestion.category) ?? 0;
    categoryRanks.set(suggestion.category, categoryRank + 1);

    const evidenceRefs: string[] = [];
    if (suggestion.relatedFact) {
      const evidenceId = createSemanticId(
        "e",
        "scanner",
        "fact",
        suggestion.relatedFact,
        input.canonicalUrl ?? input.url
      );
      evidenceRefs.push(evidenceId);
      if (!evidenceById.has(evidenceId)) {
        evidenceById.set(evidenceId, {
          id: evidenceId,
          type: "fact",
          source: "scanner",
          label: suggestion.relatedFact,
          pageRef: pageId,
          value: getPath(input.facts, suggestion.relatedFact),
        });
      }
    }

    return {
      id: createSemanticId(
        "f",
        suggestion.category,
        suggestion.id,
        input.canonicalUrl ?? input.url
      ),
      category: suggestion.category,
      title: suggestion.title,
      summary: suggestion.description,
      severity: mapSeverity(suggestion.impact),
      impact: suggestion.impact,
      effort: suggestion.effort,
      rank,
      categoryRank,
      scoreImpact: suggestion.scoreImprovement,
      evidenceRefs,
      fix: suggestion.howToFix,
      source: {
        type: "scanner",
        ruleId: suggestion.id,
      },
      confidence: "high",
    };
  });

  const categories: SitelensCategory[] = CATEGORY_ORDER.map((key) => {
    const breakdown = input.scoreBreakdowns[key];
    return {
      key,
      label: breakdown.categoryLabel || CATEGORY_LABELS[key],
      score: input.scores[key],
      summary: createCategorySummary(breakdown),
      weight: breakdown.weight,
      findingRefs: findings
        .filter((finding) => finding.category === key)
        .sort((a, b) => a.categoryRank - b.categoryRank)
        .map((finding) => finding.id),
    };
  });

  return {
    metadata: {
      id: input.id,
      url: input.url,
      canonicalUrl: input.canonicalUrl,
      generatedAt,
    },
    pages: [
      {
        id: pageId,
        url: input.url,
        canonicalUrl: input.canonicalUrl,
        title: input.facts.content.title ?? undefined,
        role: "primary",
        screenshotRefs: input.assets.screenshots.map((screenshot) => screenshot.path),
      },
    ],
    scores: input.scores,
    categories,
    findings,
    evidence: [...evidenceById.values()],
    assets: input.assets,
    extensions: [],
  };
}

export function createSemanticId(prefix: string, ...parts: string[]): string {
  return `${prefix}:${stableHash(parts.map(normalizeIdPart).join("|"))}`;
}

function createCategorySummary(breakdown: ScoreBreakdown): string {
  if (breakdown.categoryDescription) {
    return breakdown.categoryDescription;
  }
  return `${breakdown.categoryLabel} scored ${breakdown.score} out of ${breakdown.maxScore}.`;
}

function mapSeverity(impact: "high" | "medium" | "low"): SitelensFinding["severity"] {
  if (impact === "high") {
    return "critical";
  }
  if (impact === "medium") {
    return "warning";
  }
  return "info";
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);
}

function normalizeIdPart(part: string): string {
  return part.trim().toLowerCase().replace(/\s+/g, " ");
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
