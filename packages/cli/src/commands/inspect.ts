import { parseSitelensArtifact, validateSitelensArtifact } from "@sitelens/core";

export async function inspectCommand(path: string): Promise<void> {
  try {
    const content = await Bun.file(path).arrayBuffer();
    const artifact = parseSitelensArtifact(content);
    const validationErrors = validateSitelensArtifact(artifact);

    if (validationErrors.length > 0) {
      console.error("❌ Invalid Sitelens artifact:");
      for (const error of validationErrors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }

    const { manifest, report, assets } = artifact;
    console.log("📦 Sitelens Artifact");
    console.log(`  Kind:       ${manifest.kind}`);
    console.log(`  Version:    ${manifest.version}`);
    console.log(`  Created:    ${manifest.createdAt}`);
    console.log(`  Generator:  ${manifest.generator.name}@${manifest.generator.version}`);
    console.log();
    console.log("🔍 Audit");
    console.log(`  ID:         ${report.id}`);
    console.log(`  URL:        ${report.url}`);
    console.log(`  Status:     ${report.status}`);
    console.log(`  Completed:  ${report.completedAt ?? "not completed"}`);
    console.log();
    console.log("📊 Scores");
    console.log(`  Overall:       ${report.scores.overall}`);
    console.log(`  Performance:   ${report.scores.performance}`);
    console.log(`  Visibility:    ${report.scores.visibility}`);
    console.log(`  Security:      ${report.scores.security}`);
    console.log(`  Accessibility: ${report.scores.accessibility}`);
    console.log(`  Trust:         ${report.scores.trust}`);
    console.log();
    console.log("🧩 Contents");
    console.log(`  Assets:      ${assets.length}`);
    console.log(`  Extensions:  ${Object.keys(manifest.extensions).length}`);
  } catch (error) {
    console.error(
      "❌ Failed to inspect artifact:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
