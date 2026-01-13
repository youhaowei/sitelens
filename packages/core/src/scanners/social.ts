import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type { SocialData, AuditIssue, SocialProfile } from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  facebook: /facebook\.com/i,
  instagram: /instagram\.com/i,
  twitter: /twitter\.com|x\.com/i,
  youtube: /youtube\.com/i,
  linkedin: /linkedin\.com/i,
  tiktok: /tiktok\.com/i,
  pinterest: /pinterest\.com/i,
  yelp: /yelp\.com/i,
};

export class SocialScanner implements Scanner<SocialData> {
  id = "social";
  name = "Social & Local Presence";

  async run(context: ScannerContext): Promise<SocialData> {
    context.onProgress?.("Analyzing social presence...");

    const $ = cheerio.load(context.html);
    const issues: AuditIssue[] = [];

    const openGraph = this.extractOpenGraph($, issues);
    const twitter = this.extractTwitterCard($, issues);
    const profiles = this.findSocialProfiles($);
    const profileDetails = this.buildProfileDetails(profiles);

    if (Object.keys(profiles).length === 0) {
      issues.push(createIssue("no_social_profiles"));
    }

    return {
      openGraph,
      twitter,
      profiles,
      profileDetails,
      issues,
    };
  }

  private extractOpenGraph($: cheerio.CheerioAPI, issues: AuditIssue[]) {
    const getOgContent = (property: string): string | null => {
      return $(`meta[property="og:${property}"]`).attr("content") || null;
    };

    const data = {
      title: getOgContent("title"),
      description: getOgContent("description"),
      image: getOgContent("image"),
      url: getOgContent("url"),
      type: getOgContent("type"),
      siteName: getOgContent("site_name"),
    };

    const hasTitle = !!data.title;
    const hasDescription = !!data.description;
    const hasImage = !!data.image;
    const isComplete = hasTitle && hasDescription && hasImage;

    if (!hasTitle) {
      issues.push(createIssue("missing_og_title"));
    }
    if (!hasDescription) {
      issues.push(createIssue("missing_og_description"));
    }
    if (!hasImage) {
      issues.push(createIssue("missing_og_image"));
    }

    return { hasTitle, hasDescription, hasImage, isComplete, data };
  }

  private extractTwitterCard($: cheerio.CheerioAPI, issues: AuditIssue[]) {
    const getTwitterContent = (name: string): string | null => {
      return $(`meta[name="twitter:${name}"]`).attr("content") || null;
    };

    const data = {
      card: getTwitterContent("card"),
      title: getTwitterContent("title"),
      description: getTwitterContent("description"),
      image: getTwitterContent("image"),
      site: getTwitterContent("site"),
    };

    const hasCard = !!data.card;

    if (!hasCard) {
      issues.push(createIssue("missing_twitter_card"));
    }

    return {
      hasCard,
      data,
    };
  }

  private findSocialProfiles($: cheerio.CheerioAPI) {
    const profiles: Record<string, string | undefined> = {};

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";

      for (const [platform, regex] of Object.entries(SOCIAL_PATTERNS)) {
        if (regex.test(href) && !profiles[platform]) {
          profiles[platform] = href;
        }
      }
    });

    return profiles;
  }

  private buildProfileDetails(
    profiles: Record<string, string | undefined>
  ): SocialProfile[] {
    return Object.entries(profiles)
      .filter(([_, url]) => url !== undefined)
      .map(([platform, url]) => ({
        platform,
        url: url!,
        handle: this.extractHandle(url!, platform),
      }));
  }

  private extractHandle(url: string, platform: string): string | undefined {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace(/^\//, "").split("/")[0];

      if (path && path !== "pages" && path !== "channel") {
        return platform === "twitter" ? `@${path}` : path;
      }
    } catch {
    }
    return undefined;
  }
}
