import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type { ReviewsData, ReviewPlatform, AuditIssue } from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

interface ExtractedRating {
  rating: number;
  count: number;
}

const REVIEW_PLATFORMS = [
  { name: "Google", patterns: [/google\.com\/maps\/place/i, /g\.page/i, /maps\.google\.com/i] },
  { name: "Yelp", patterns: [/yelp\.com\/biz/i] },
  { name: "Facebook", patterns: [/facebook\.com\//i] },
  { name: "TripAdvisor", patterns: [/tripadvisor\.com/i] },
  { name: "Trustpilot", patterns: [/trustpilot\.com/i] },
  { name: "BBB", patterns: [/bbb\.org/i] },
  { name: "Angi", patterns: [/angi\.com/i, /angieslist\.com/i] },
];

export class ReviewsScanner implements Scanner<ReviewsData> {
  id = "reviews";
  name = "Reviews & Reputation";

  async run(context: ScannerContext): Promise<ReviewsData> {
    context.onProgress?.("Analyzing reviews and reputation...");

    const $ = cheerio.load(context.html);
    const issues: AuditIssue[] = [];

    const platforms = this.detectReviewPlatforms($);
    const testimonialPage = this.findTestimonialPage($, context.url);
    const websiteShowsReviews = this.detectEmbeddedReviews($);

    const extractedRating = this.extractRatingWithPrecedence($);
    const averageRating = extractedRating?.rating || 0;

    const totalReviews = platforms.reduce((sum, p) => sum + p.reviewCount, 0);

    if (platforms.filter((p) => p.url !== null).length === 0) {
      issues.push(
        createIssue("no_review_profiles", {
          id: "no_review_profiles",
          title: "No Review Platform Links",
          description: "No links to review platforms (Google, Yelp, etc.) were found.",
          severity: "warning",
          category: "local",
          recommendation: "Add links to your Google Business Profile, Yelp, and other review sites.",
          impact: "Review signals are important for local SEO and consumer trust.",
          effort: "low",
        })
      );
    }

    if (!websiteShowsReviews && !testimonialPage) {
      issues.push(
        createIssue("no_reviews_displayed", {
          id: "no_reviews_displayed",
          title: "No Reviews/Testimonials Displayed",
          description: "The website does not appear to display customer reviews or testimonials.",
          severity: "info",
          category: "local",
          recommendation: "Add a testimonials section or embed reviews from Google/Yelp.",
          impact: "Displaying reviews builds trust and can improve conversion rates by up to 270%.",
          effort: "medium",
        })
      );
    }

    const googlePlatform = platforms.find((p) => p.name === "Google");
    if (!googlePlatform?.url) {
      issues.push(
        createIssue("no_google_reviews", {
          id: "no_google_reviews",
          title: "No Google Reviews Link",
          description: "No link to Google reviews or Google Business Profile.",
          severity: "warning",
          category: "local",
          recommendation: "Link to your Google Business Profile and encourage customers to leave Google reviews.",
          impact: "Google reviews directly impact local pack rankings and click-through rates.",
          effort: "low",
        })
      );
    }

    return {
      overall: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews,
        recentReviews: 0,
      },
      platforms,
      websiteShowsReviews,
      testimonialPage,
      issues,
    };
  }

  private detectReviewPlatforms($: cheerio.CheerioAPI): ReviewPlatform[] {
    const results: ReviewPlatform[] = [];

    for (const platform of REVIEW_PLATFORMS) {
      let url: string | null = null;

      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        for (const pattern of platform.patterns) {
          if (pattern.test(href)) {
            url = href;
            return false;
          }
        }
      });

      results.push({
        name: platform.name,
        url,
        rating: null,
        reviewCount: 0,
      });
    }

    return results;
  }

  private findTestimonialPage($: cheerio.CheerioAPI, baseUrl: string): string | null {
    const testimonialPatterns = [/testimonial/i, /review/i, /customer-stories/i, /success-stories/i, /what-.*say/i];

    let testimonialUrl: string | null = null;

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().toLowerCase();

      for (const pattern of testimonialPatterns) {
        if (pattern.test(href) || pattern.test(text)) {
          try {
            testimonialUrl = new URL(href, baseUrl).toString();
            return false;
          } catch {
            testimonialUrl = href;
            return false;
          }
        }
      }
    });

    return testimonialUrl;
  }

  private detectEmbeddedReviews($: cheerio.CheerioAPI): boolean {
    const reviewIndicators = [
      '[class*="review"]',
      '[class*="testimonial"]',
      '[id*="review"]',
      '[id*="testimonial"]',
      '[class*="star"]',
      '[class*="rating"]',
      ".elfsight-app",
      ".trustpilot-widget",
      ".yotpo",
      ".stamped-reviews",
      ".judge-me",
      ".loox-review",
      '[itemtype*="Review"]',
      '[typeof="Review"]',
    ];

    for (const selector of reviewIndicators) {
      if ($(selector).length > 0) {
        const element = $(selector).first();
        const text = element.text().toLowerCase();
        if (
          text.includes("star") ||
          text.includes("rating") ||
          text.includes("review") ||
          element.find('[class*="star"]').length > 0
        ) {
          return true;
        }
      }
    }

    const bodyText = $("body").text().toLowerCase();
    const reviewPhrases = ["customer reviews", "what our customers say", "testimonials", "5 stars", "4.5 stars", "rated", "reviews from"];

    for (const phrase of reviewPhrases) {
      if (bodyText.includes(phrase)) {
        return true;
      }
    }

    return false;
  }

  private extractSchemaRating($: cheerio.CheerioAPI): { rating: number; count: number } | null {
    const schemaScripts = $('script[type="application/ld+json"]');

    for (let i = 0; i < schemaScripts.length; i++) {
      try {
        const content = $(schemaScripts[i]).html();
        if (content) {
          const schema = JSON.parse(content);
          const rating = this.findRatingInSchema(schema);
          if (rating) return rating;
        }
      } catch {}
    }

    return null;
  }

  private findRatingInSchema(schema: Record<string, unknown>): ExtractedRating | null {
    if (schema.aggregateRating) {
      const aggRating = schema.aggregateRating as Record<string, unknown>;
      const rating = parseFloat(String(aggRating.ratingValue)) || 0;
      if (rating > 0 && rating <= 5) {
        return {
          rating,
          count: parseInt(String(aggRating.reviewCount)) || 0,
        };
      }
    }

    if (Array.isArray(schema["@graph"])) {
      for (const item of schema["@graph"]) {
        const itemObj = item as Record<string, unknown>;
        if (itemObj.aggregateRating) {
          const aggRating = itemObj.aggregateRating as Record<string, unknown>;
          const rating = parseFloat(String(aggRating.ratingValue)) || 0;
          if (rating > 0 && rating <= 5) {
            return {
              rating,
              count: parseInt(String(aggRating.reviewCount)) || 0,
            };
          }
        }
      }
    }

    return null;
  }

  private extractRatingWithPrecedence($: cheerio.CheerioAPI): ExtractedRating | null {
    const schemaRating = this.extractSchemaRating($);
    if (schemaRating) return schemaRating;

    const microdataRating = this.extractMicrodataRating($);
    if (microdataRating) return microdataRating;

    const visibleRating = this.extractVisibleRating($);
    if (visibleRating) return visibleRating;

    return null;
  }

  private extractMicrodataRating($: cheerio.CheerioAPI): ExtractedRating | null {
    const ratingValueEl = $('[itemprop="ratingValue"]');
    if (ratingValueEl.length > 0) {
      const content = ratingValueEl.attr("content") || ratingValueEl.text();
      const rating = parseFloat(content);
      if (rating > 0 && rating <= 5) {
        const reviewCountEl = $('[itemprop="reviewCount"]');
        const count = reviewCountEl.length > 0
          ? parseInt(reviewCountEl.attr("content") || reviewCountEl.text()) || 0
          : 0;
        return { rating, count };
      }
    }

    const aggregateRatingEl = $('[itemprop="aggregateRating"]');
    if (aggregateRatingEl.length > 0) {
      const ratingEl = aggregateRatingEl.find('[itemprop="ratingValue"]');
      if (ratingEl.length > 0) {
        const content = ratingEl.attr("content") || ratingEl.text();
        const rating = parseFloat(content);
        if (rating > 0 && rating <= 5) {
          const countEl = aggregateRatingEl.find('[itemprop="reviewCount"]');
          const count = countEl.length > 0
            ? parseInt(countEl.attr("content") || countEl.text()) || 0
            : 0;
          return { rating, count };
        }
      }
    }

    return null;
  }

  private extractVisibleRating($: cheerio.CheerioAPI): ExtractedRating | null {
    const bodyText = $("body").text();

    const starsPattern = /(\d+(?:\.\d+)?)\s*(?:star|stars|★)/i;
    const starsMatch = bodyText.match(starsPattern);
    if (starsMatch?.[1]) {
      const rating = parseFloat(starsMatch[1]);
      if (rating > 0 && rating <= 5) {
        return { rating, count: 0 };
      }
    }

    const outOf5Pattern = /(\d+(?:\.\d+)?)\s*\/\s*5/i;
    const outOf5Match = bodyText.match(outOf5Pattern);
    if (outOf5Match?.[1]) {
      const rating = parseFloat(outOf5Match[1]);
      if (rating > 0 && rating <= 5) {
        return { rating, count: 0 };
      }
    }

    const outOf10Pattern = /(\d+(?:\.\d+)?)\s*\/\s*10/i;
    const outOf10Match = bodyText.match(outOf10Pattern);
    if (outOf10Match?.[1]) {
      const rawRating = parseFloat(outOf10Match[1]);
      const rating = rawRating / 2;
      if (rating > 0 && rating <= 5) {
        return { rating, count: 0 };
      }
    }

    const ratedPattern = /rated\s+(\d+(?:\.\d+)?)/i;
    const ratedMatch = bodyText.match(ratedPattern);
    if (ratedMatch?.[1]) {
      const rating = parseFloat(ratedMatch[1]);
      if (rating > 0 && rating <= 5) {
        return { rating, count: 0 };
      }
    }

    return null;
  }
}
