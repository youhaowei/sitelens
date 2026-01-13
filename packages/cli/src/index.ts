import { Command } from "commander";
import { auditCommand } from "./commands/audit";

const program = new Command();

program
  .name("sitelens")
  .description("CLI tool for comprehensive website auditing")
  .version("0.1.0");

program
  .command("audit")
  .description("Run a full audit on a website")
  .argument("<url>", "URL to audit")
  .option("-o, --output <path>", "Output directory", "./reports")
  .option("-f, --format <formats>", "Output formats (json,html,pdf)", "json")
  .option("-d, --device <device>", "Device to emulate (mobile,desktop,both)", "both")
  .option("--deep", "Enable deep link checking")
  .option("--timeout <ms>", "Timeout in milliseconds", "60000")
  .action(auditCommand);

program
  .argument("[url]", "URL to audit")
  .option("-o, --output <path>", "Output directory", "./reports")
  .option("-f, --format <formats>", "Output formats (json,html,pdf)", "json")
  .option("-d, --device <device>", "Device to emulate (mobile,desktop,both)", "both")
  .option("--deep", "Enable deep link checking")
  .option("--timeout <ms>", "Timeout in milliseconds", "60000")
  .action(async (url, options) => {
    if (url) {
      await auditCommand(url, options);
    } else {
      program.help();
    }
  });

export { program };
