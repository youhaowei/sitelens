import { z } from "zod";

export const AuditConfigSchema = z.object({
  url: z.string().min(1, "URL is required"),
  output: z.string().default("./reports"),
  format: z
    .array(z.enum(["json", "html", "pdf"]))
    .default(["json"]),
  device: z.enum(["mobile", "desktop", "both"]).default("both"),
  timeout: z.number().default(60000),
  deep: z.boolean().default(false),
  scanners: z
    .object({
      lighthouse: z.boolean().default(true),
      seo: z.boolean().default(true),
      social: z.boolean().default(true),
      tech: z.boolean().default(true),
      local: z.boolean().default(true),
      advertising: z.boolean().default(true),
      ecommerce: z.boolean().default(true),
    })
    .default({
      lighthouse: true,
      seo: true,
      social: true,
      tech: true,
      local: true,
      advertising: true,
      ecommerce: true,
    }),
});

export type ValidatedAuditConfig = z.infer<typeof AuditConfigSchema>;

export function validateConfig(input: unknown): ValidatedAuditConfig {
  return AuditConfigSchema.parse(input);
}

export function validateUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  return trimmed;
}
