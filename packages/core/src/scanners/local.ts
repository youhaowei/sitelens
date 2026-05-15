import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type { LocalData } from "@sitelens/shared/types";

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ADDRESS_REGEX = /(?:^|\s)(\d+\s+[\w\s]+?\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?\b(?:\s*#?\d+)?,?\s+[A-Za-z][A-Za-z\s]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?|\d+\s+[\w\s]+?\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?\b(?:\s*#?\d+)?)/gi;

export class LocalScanner implements Scanner<LocalData> {
  id = "local";
  name = "Local Presence";

  async run(context: ScannerContext): Promise<LocalData> {
    context.onProgress?.("Detecting local business info...");

    const $ = cheerio.load(context.html);

    $("script, style, noscript").remove();
    const textContent = this.getReadableText($);

    const phones = this.extractPhones($, textContent);
    const emails = this.extractEmails($, textContent);
    const addresses = this.extractAddresses(textContent);

    return { phones, emails, addresses };
  }

  private extractUnique(matches: string[]): string[] {
    const cleaned = matches.map((m) => m.trim());
    return [...new Set(cleaned)];
  }

  private getReadableText($: cheerio.CheerioAPI): string {
    return $("body")
      .find("*")
      .contents()
      .toArray()
      .map((node) => (node.type === "text" ? node.data.trim() : ""))
      .filter(Boolean)
      .join(" ");
  }

  private extractPhones($: cheerio.CheerioAPI, textContent: string): string[] {
    const phones: string[] = [];

    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      const phone = this.formatPhone(text || href.replace(/^tel:/i, ""));
      if (phone) phones.push(phone);
    });

    for (const match of textContent.match(PHONE_REGEX) || []) {
      const phone = this.formatPhone(match);
      if (phone) phones.push(phone);
    }

    return this.extractUniqueBy(phones, (phone) => phone.replace(/\D/g, ""));
  }

  private extractEmails($: cheerio.CheerioAPI, textContent: string): string[] {
    const emails: string[] = [];
    const linkedEmails: string[] = [];

    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      const email = this.cleanEmail(text || href.replace(/^mailto:/i, ""));
      if (email) {
        emails.push(email);
        linkedEmails.push(email);
      }
    });

    for (const match of textContent.match(EMAIL_REGEX) || []) {
      const email = this.cleanEmail(match);
      if (email && !linkedEmails.some((linkedEmail) => email.endsWith(linkedEmail))) {
        emails.push(email);
      }
    }

    return this.extractUniqueBy(emails, (email) => email.toLowerCase());
  }

  private extractAddresses(textContent: string): string[] {
    const addresses: string[] = [];
    for (const match of textContent.matchAll(ADDRESS_REGEX)) {
      const address = this.normalizeAddress(match[1] || "");
      if (address) addresses.push(address);
    }
    return this.extractUnique(addresses);
  }

  private normalizeAddress(value: string): string | null {
    const address = value.trim().replace(/\s+/g, " ").replace(/\s+,/g, ",");
    if (!address) return null;

    return address
      .replace(
        /\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?\s+([A-Z][A-Za-z\s]+),?\s+([A-Z]{2}\s+\d{5}(?:-\d{4})?)$/i,
        (_match, streetType, city, stateZip) => `${streetType}, ${String(city).trim()}, ${stateZip}`
      )
      .trim();
  }

  private extractUniqueBy(values: string[], getKey: (value: string) => string): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const value of values) {
      const key = getKey(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(value);
    }

    return unique;
  }

  private cleanEmail(value: string): string | null {
    const email = (value.split("?")[0]?.trim() ?? "").replace(/^email/i, "");
    return email.match(EMAIL_REGEX)?.[0] === email ? email : null;
  }

  private formatPhone(value: string): string | null {
    const digits = value.replace(/\D/g, "");
    const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (localDigits.length !== 10) return null;
    return `(${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }
}
