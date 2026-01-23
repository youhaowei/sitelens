import { describe, test, expect } from "bun:test";
import { ReviewsScanner } from "./reviews";
import type { ScannerContext } from "./types";

function createHtml(body: string, head: string = ""): string {
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

function createMockContext(html: string): ScannerContext {
  return {
    url: "https://example.com",
    page: {} as never,
    html,
    browserPort: 9222,
  };
}

describe("ReviewsScanner", () => {
  const scanner = new ReviewsScanner();

  describe("extractSchemaRating via run()", () => {
    test("extracts rating from JSON-LD aggregateRating", async () => {
      const html = createHtml(`
        <script type="application/ld+json">
          {"@type": "LocalBusiness", "aggregateRating": {"ratingValue": "4.5", "reviewCount": "100"}}
        </script>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.5);
    });

    test("extracts rating from @graph array", async () => {
      const html = createHtml(`
        <script type="application/ld+json">
          {"@context": "https://schema.org", "@graph": [
            {"@type": "LocalBusiness", "aggregateRating": {"ratingValue": "4.2", "reviewCount": "50"}}
          ]}
        </script>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.2);
    });

    test("rejects rating > 5 from schema", async () => {
      const html = createHtml(`
        <script type="application/ld+json">
          {"@type": "LocalBusiness", "aggregateRating": {"ratingValue": "9.5", "reviewCount": "100"}}
        </script>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(0);
    });
  });

  describe("extractMicrodataRating via run()", () => {
    test("extracts rating from itemprop ratingValue", async () => {
      const html = createHtml(`
        <div itemscope itemtype="https://schema.org/LocalBusiness">
          <span itemprop="ratingValue" content="4.7">4.7</span>
          <span itemprop="reviewCount" content="25">25 reviews</span>
        </div>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.7);
    });

    test("extracts rating from nested aggregateRating", async () => {
      const html = createHtml(`
        <div itemscope itemtype="https://schema.org/LocalBusiness">
          <div itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
            <span itemprop="ratingValue">4.3</span>
            <span itemprop="reviewCount">15</span>
          </div>
        </div>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.3);
    });
  });

  describe("extractVisibleRating via run()", () => {
    test("extracts '4.8 stars' pattern", async () => {
      const html = createHtml(`<p>We are rated 4.8 stars on Google</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.8);
    });

    test("extracts '4.5/5' pattern", async () => {
      const html = createHtml(`<p>Our rating: 4.5/5</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.5);
    });

    test("normalizes 9/10 to 4.5", async () => {
      const html = createHtml(`<p>9/10 rating from customers</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.5);
    });

    test("extracts 'Rated 4.6' pattern", async () => {
      const html = createHtml(`<p>Rated 4.6 by our customers</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.6);
    });

    test("extracts star symbol pattern", async () => {
      const html = createHtml(`<p>4.9★ average rating</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.9);
    });
  });

  describe("precedence", () => {
    test("schema.org wins over visible text", async () => {
      const html = createHtml(`
        <script type="application/ld+json">
          {"@type": "LocalBusiness", "aggregateRating": {"ratingValue": "4.2", "reviewCount": "100"}}
        </script>
        <p>We are rated 4.8 stars on Google</p>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.2);
    });

    test("microdata wins over visible text", async () => {
      const html = createHtml(`
        <span itemprop="ratingValue" content="4.1">4.1</span>
        <p>We are rated 4.8 stars on Google</p>
      `);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(4.1);
    });
  });

  describe("no rating found", () => {
    test("returns 0 when no rating found", async () => {
      const html = createHtml(`<p>Welcome to our website</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.overall.averageRating).toBe(0);
    });
  });

  describe("platform detection", () => {
    test("detects Google review link", async () => {
      const html = createHtml(`<a href="https://g.page/mybusiness">Reviews</a>`);
      const result = await scanner.run(createMockContext(html));
      const google = result.platforms.find(p => p.name === "Google");
      expect(google?.url).toBe("https://g.page/mybusiness");
    });

    test("platform ratings stay null (free tier)", async () => {
      const html = createHtml(`
        <a href="https://g.page/mybusiness">Reviews</a>
        <script type="application/ld+json">
          {"@type": "LocalBusiness", "aggregateRating": {"ratingValue": "4.5", "reviewCount": "100"}}
        </script>
      `);
      const result = await scanner.run(createMockContext(html));
      const google = result.platforms.find(p => p.name === "Google");
      expect(google?.rating).toBeNull();
      expect(result.overall.averageRating).toBe(4.5);
    });
  });
});
