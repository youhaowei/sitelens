import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type { LocalData } from "@sitelens/shared/types";

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ADDRESS_REGEX = /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?(?:\s*#?\d+)?(?:,\s*[\w\s]+)?(?:,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/gi;

export class LocalScanner implements Scanner<LocalData> {
  id = "local";
  name = "Local Presence";

  async run(context: ScannerContext): Promise<LocalData> {
    context.onProgress?.("Detecting local business info...");

    const $ = cheerio.load(context.html);

    $("script, style, noscript").remove();
    const textContent = $("body").text();

    const phones = this.extractUnique(textContent.match(PHONE_REGEX) || []);
    const emails = this.extractUnique(textContent.match(EMAIL_REGEX) || []);
    const addresses = this.extractUnique(textContent.match(ADDRESS_REGEX) || []);

    return { phones, emails, addresses };
  }

  private extractUnique(matches: string[]): string[] {
    const cleaned = matches.map((m) => m.trim());
    return [...new Set(cleaned)];
  }
}
