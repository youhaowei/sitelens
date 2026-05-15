import { z } from "zod";

export const SITELENS_ARTIFACT_SCHEMA = "sitelens.report";
export const SITELENS_SCHEMA_VERSION = "0.2.0";

export const scoreCategorySchema = z.enum([
  "performance",
  "visibility",
  "security",
  "accessibility",
  "trust",
]);

export const scoreSchema = z.object({
  overall: z.number(),
  performance: z.number(),
  visibility: z.number(),
  security: z.number(),
  accessibility: z.number(),
  trust: z.number(),
});

export const screenshotRefSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
  path: z.string(),
});

export const assetReferencesSchema = z.object({
  screenshots: z.array(screenshotRefSchema),
});

export const pageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  title: z.string().optional(),
  role: z.enum(["primary", "submitted", "discovered"]),
  screenshotRefs: z.array(z.string()),
});

export const evidenceSchema = z.object({
  id: z.string(),
  type: z.string(),
  source: z.string(),
  label: z.string(),
  pageRef: z.string().optional(),
  value: z.unknown().optional(),
  url: z.string().url().optional(),
  selector: z.string().optional(),
  screenshotRef: z.string().optional(),
  excerpt: z.string().optional(),
  metric: z
    .object({
      key: z.string(),
      value: z.number(),
      unit: z.string().optional(),
    })
    .optional(),
  collectedAt: z.string().datetime().optional(),
});

export const findingSchema = z.object({
  id: z.string(),
  category: scoreCategorySchema,
  title: z.string(),
  summary: z.string(),
  severity: z.enum(["critical", "warning", "info", "success"]),
  impact: z.enum(["high", "medium", "low"]),
  effort: z.enum(["low", "medium", "high"]),
  rank: z.number().int().nonnegative(),
  categoryRank: z.number().int().nonnegative(),
  scoreImpact: z
    .array(
      z.object({
        category: scoreCategorySchema,
        points: z.number(),
      })
    )
    .optional(),
  evidenceRefs: z.array(z.string()),
  fix: z.string().optional(),
  source: z.object({
    type: z.string(),
    ruleId: z.string().optional(),
  }),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const categorySchema = z.object({
  key: scoreCategorySchema,
  label: z.string(),
  score: z.number(),
  summary: z.string(),
  weight: z.number().optional(),
  findingRefs: z.array(z.string()),
});

export const extensionSchema = z.object({
  key: z.string(),
  source: z.string(),
  generatedAt: z.string().datetime(),
  data: z.unknown(),
});

export const reportMetadataSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  generatedAt: z.string().datetime(),
});

export const sitelensReportSchema = z.object({
  metadata: reportMetadataSchema,
  pages: z.array(pageSchema),
  scores: scoreSchema,
  categories: z.array(categorySchema),
  findings: z.array(findingSchema),
  evidence: z.array(evidenceSchema),
  assets: assetReferencesSchema,
  extensions: z.array(extensionSchema),
});

export const artifactAssetManifestSchema = z.object({
  path: z.string(),
  mediaType: z.string(),
  byteLength: z.number().int().nonnegative(),
});

export const sitelensArtifactManifestSchema = z.object({
  schema: z.literal(SITELENS_ARTIFACT_SCHEMA),
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  versionedAt: z.string().datetime(),
  assets: z.array(artifactAssetManifestSchema),
  extensions: z.array(extensionSchema),
});

export const sitelensArtifactAssetSchema = artifactAssetManifestSchema.extend({
  bytes: z.instanceof(Uint8Array),
});

export const sitelensArtifactSchema = z.object({
  manifest: sitelensArtifactManifestSchema,
  report: sitelensReportSchema,
  assets: z.array(sitelensArtifactAssetSchema),
});

export type ScoreCategory = z.infer<typeof scoreCategorySchema>;
export type SitelensScores = z.infer<typeof scoreSchema>;
export type SitelensScreenshotRef = z.infer<typeof screenshotRefSchema>;
export type SitelensAssetReferences = z.infer<typeof assetReferencesSchema>;
export type SitelensPage = z.infer<typeof pageSchema>;
export type SitelensEvidence = z.infer<typeof evidenceSchema>;
export type SitelensFinding = z.infer<typeof findingSchema>;
export type SitelensCategory = z.infer<typeof categorySchema>;
export type SitelensExtension = z.infer<typeof extensionSchema>;
export type SitelensReportMetadata = z.infer<typeof reportMetadataSchema>;
export type SitelensReport = z.infer<typeof sitelensReportSchema>;
export type SitelensArtifactManifest = z.infer<typeof sitelensArtifactManifestSchema>;
export type SitelensArtifactAsset = z.infer<typeof sitelensArtifactAssetSchema>;
export type SitelensArtifact = z.infer<typeof sitelensArtifactSchema>;
