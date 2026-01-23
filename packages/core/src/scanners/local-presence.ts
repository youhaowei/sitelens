import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type {
  LocalPresenceData,
  AuditIssue,
  DirectoryListing,
  NapConsistencyItem,
} from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ADDRESS_REGEX =
  /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\.?(?:\s*#?\d+)?(?:,\s*[\w\s]+)?(?:,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/gi;

const DIRECTORIES = [
  { name: "Yelp", domain: "yelp.com" },
  { name: "Yellow Pages", domain: "yellowpages.com" },
  { name: "BBB", domain: "bbb.org" },
  { name: "TripAdvisor", domain: "tripadvisor.com" },
  { name: "Angi", domain: "angi.com" },
  { name: "Thumbtack", domain: "thumbtack.com" },
  { name: "Foursquare", domain: "foursquare.com" },
  { name: "Manta", domain: "manta.com" },
  { name: "Citysearch", domain: "citysearch.com" },
  { name: "MapQuest", domain: "mapquest.com" },
];

export class LocalPresenceScanner implements Scanner<LocalPresenceData> {
  id = "local-presence";
  name = "Local Presence & NAP Consistency";

  async run(context: ScannerContext): Promise<LocalPresenceData> {
    context.onProgress?.("Analyzing local presence...");

    const $ = cheerio.load(context.html);
    const issues: AuditIssue[] = [];

    $("script, style, noscript").remove();
    const textContent = $("body").text();

    const phones = this.extractUnique(textContent.match(PHONE_REGEX) || []);
    const emails = this.extractUnique(textContent.match(EMAIL_REGEX) || []);
    const addresses = this.extractUnique(textContent.match(ADDRESS_REGEX) || []);

    const businessName = this.extractBusinessName($, context.url);
    const googleBusinessProfile = await this.detectGoogleBusinessProfile($);
    const googleMaps = this.detectGoogleMaps($);

    const bingPlaces = {
      listed: false,
      accurate: false,
      issues: ["Bing Places listing not detected from website"],
    };

    const appleBusinessConnect = {
      listed: false,
      issues: ["Apple Business Connect listing not detected from website"],
    };

    const directories = this.detectDirectoryListings($);
    const napConsistency = this.analyzeNapConsistency(businessName, addresses, phones);

    if (!googleBusinessProfile.exists) {
      issues.push(
        createIssue("no_gbp", {
          id: "no_gbp",
          title: "No Google Business Profile Link",
          description: "No link to Google Business Profile found.",
          severity: "warning",
          category: "local",
          recommendation: "Claim your Google Business Profile at business.google.com and add a link to your website.",
          impact: "Google Business Profile is critical for local SEO and appearing in local pack results.",
          effort: "medium",
        })
      );
    }

    if (phones.length === 0) {
      issues.push(
        createIssue("no_phone", {
          id: "no_phone",
          title: "No Phone Number Found",
          description: "No phone number was detected on the page.",
          severity: "warning",
          category: "local",
          recommendation: "Add a clearly visible phone number with schema.org markup.",
          impact: "Phone numbers are essential for local businesses and help with local SEO signals.",
          effort: "low",
        })
      );
    }

    if (addresses.length === 0) {
      issues.push(
        createIssue("no_address", {
          id: "no_address",
          title: "No Physical Address Found",
          description: "No physical address was detected on the page.",
          severity: "warning",
          category: "local",
          recommendation: "Add your business address with proper schema.org LocalBusiness markup.",
          impact: "Physical addresses help establish local relevance for search engines.",
          effort: "low",
        })
      );
    }

    if (!napConsistency.consistent) {
      issues.push(
        createIssue("nap_inconsistent", {
          id: "nap_inconsistent",
          title: "NAP Consistency Issues",
          description: "Multiple variations of business name, address, or phone were found.",
          severity: "warning",
          category: "local",
          recommendation: "Ensure your Name, Address, and Phone (NAP) are exactly consistent across your website.",
          impact: "Inconsistent NAP confuses search engines and can hurt local rankings.",
          effort: "medium",
        })
      );
    }

    const listedDirectories = directories.filter((d) => d.listed);
    if (listedDirectories.length < 3) {
      issues.push(
        createIssue("few_directory_listings", {
          id: "few_directory_listings",
          title: "Few Directory Listings",
          description: `Only ${listedDirectories.length} business directory links found on the page.`,
          severity: "info",
          category: "local",
          recommendation: "List your business on major directories (Yelp, Yellow Pages, BBB) and link to those profiles.",
          impact: "Directory listings provide citation signals for local SEO.",
          effort: "medium",
        })
      );
    }

    return {
      businessName,
      googleBusinessProfile,
      googleMaps,
      bingPlaces,
      appleBusinessConnect,
      directories,
      napConsistency,
      phones,
      addresses,
      emails,
      issues,
    };
  }

  private extractUnique(matches: string[]): string[] {
    const cleaned = matches.map((m) => m.trim());
    return [...new Set(cleaned)];
  }

  private extractBusinessName($: cheerio.CheerioAPI, url: string): string | null {
    const schemaScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < schemaScripts.length; i++) {
      try {
        const content = $(schemaScripts[i]).html();
        if (content) {
          const schema = JSON.parse(content);
          if (schema.name) return schema.name;
          if (schema["@graph"]) {
            const org = schema["@graph"].find(
              (item: { "@type"?: string; name?: string }) =>
                item["@type"] === "Organization" || item["@type"] === "LocalBusiness"
            );
            if (org?.name) return org.name;
          }
        }
      } catch {}
    }

    const ogSiteName = $('meta[property="og:site_name"]').attr("content");
    if (ogSiteName) return ogSiteName;

    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      return domain.split(".")[0] || null;
    } catch {
      return null;
    }
  }

  private async detectGoogleBusinessProfile($: cheerio.CheerioAPI) {
    const result = {
      exists: false,
      url: null as string | null,
      verified: false,
      complete: false,
      issues: [] as string[],
    };

    const gbpPatterns = [
      /maps\.google\.com.*\?cid=/i,
      /google\.com\/maps\/place/i,
      /g\.page\//i,
      /business\.google\.com/i,
    ];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      for (const pattern of gbpPatterns) {
        if (pattern.test(href)) {
          result.exists = true;
          result.url = href;
          return false;
        }
      }
    });

    if ($('iframe[src*="google.com/maps"]').length > 0) {
      result.exists = true;
    }

    if (!result.exists) {
      result.issues.push("No Google Business Profile link detected");
      return result;
    }

    if (result.url) {
      const validation = await this.validateGbpUrl(result.url);
      result.verified = validation.valid;
      if (!validation.valid && validation.error) {
        result.issues.push(validation.error);
      }
    }

    return result;
  }

  private async validateGbpUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);

      if (response.status >= 400) {
        return { valid: false, error: `Link returned HTTP ${response.status}` };
      }
      return { valid: true };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        return { valid: false, error: "Link validation timed out" };
      }
      return { valid: false, error: "Link could not be reached" };
    }
  }

  private detectGoogleMaps($: cheerio.CheerioAPI) {
    const result = {
      listed: false,
      accurate: false,
      issues: [] as string[],
    };

    const mapsIframe = $('iframe[src*="google.com/maps"]');
    if (mapsIframe.length > 0) {
      result.listed = true;
      result.accurate = true;
    }

    const mapsLink = $('a[href*="google.com/maps"], a[href*="maps.google.com"]');
    if (mapsLink.length > 0) {
      result.listed = true;
    }

    if (!result.listed) {
      result.issues.push("No Google Maps embed or link found");
    }

    return result;
  }

  private detectDirectoryListings($: cheerio.CheerioAPI): DirectoryListing[] {
    const listings: DirectoryListing[] = [];

    for (const dir of DIRECTORIES) {
      const link = $(`a[href*="${dir.domain}"]`);
      const listed = link.length > 0;
      const url = listed ? link.first().attr("href") || null : null;

      listings.push({
        name: dir.name,
        url,
        listed,
        accurate: listed,
        issues: listed ? [] : [`No ${dir.name} listing link found`],
      });
    }

    return listings;
  }

  private analyzeNapConsistency(
    businessName: string | null,
    addresses: string[],
    phones: string[]
  ) {
    const nameItem: NapConsistencyItem = {
      value: businessName,
      variations: businessName ? [businessName] : [],
      isConsistent: true,
    };

    const addressItem: NapConsistencyItem = {
      value: addresses[0] || null,
      variations: addresses,
      isConsistent: addresses.length <= 1,
    };

    const phoneItem: NapConsistencyItem = {
      value: phones[0] || null,
      variations: phones.map((p) => this.normalizePhone(p)),
      isConsistent: this.arePhonesConsistent(phones),
    };

    const issues: string[] = [];
    if (!nameItem.isConsistent) issues.push("Multiple business name variations");
    if (!addressItem.isConsistent) issues.push("Multiple address variations");
    if (!phoneItem.isConsistent) issues.push("Multiple phone number variations");

    return {
      consistent: nameItem.isConsistent && addressItem.isConsistent && phoneItem.isConsistent,
      name: nameItem,
      address: addressItem,
      phone: phoneItem,
      issues,
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private arePhonesConsistent(phones: string[]): boolean {
    if (phones.length <= 1) return true;
    const normalized = phones.map((p) => this.normalizePhone(p));
    const unique = new Set(normalized);
    return unique.size === 1;
  }
}
