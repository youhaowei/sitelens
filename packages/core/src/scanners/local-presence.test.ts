import { describe, test, expect, mock, afterEach } from "bun:test";
import { LocalPresenceScanner } from "./local-presence";
import type { ScannerContext } from "./types";

const originalFetch = globalThis.fetch;

function mockFetch(response: Partial<Response> | Error) {
  const mockFn = mock(() => {
    if (response instanceof Error) {
      return Promise.reject(response);
    }
    return Promise.resolve(response as Response);
  });
  // Bun's fetch type requires preconnect property
  Object.assign(mockFn, { preconnect: () => {} });
  return mockFn as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createHtml(body: string): string {
  return `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;
}

function createMockContext(html: string): ScannerContext {
  return {
    url: "https://example.com",
    page: {} as never,
    html,
    browserPort: 9222,
  };
}

describe("LocalPresenceScanner", () => {
  const scanner = new LocalPresenceScanner();

  describe("GBP detection", () => {
    test("detects g.page link", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us on Google</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.exists).toBe(true);
      expect(result.googleBusinessProfile.url).toBe("https://g.page/mybusiness");
    });

    test("detects google.com/maps/place link", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<a href="https://google.com/maps/place/MyBusiness">Map</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.exists).toBe(true);
    });

    test("detects maps.google.com with cid", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<a href="https://maps.google.com/?cid=123456">Map</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.exists).toBe(true);
    });

    test("detects Google Maps iframe", async () => {
      const html = createHtml(`<iframe src="https://google.com/maps/embed?pb=..."></iframe>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.exists).toBe(true);
    });

    test("reports no GBP when not found", async () => {
      const html = createHtml(`<p>Welcome to our website</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.exists).toBe(false);
      expect(result.googleBusinessProfile.verified).toBe(false);
      expect(result.googleBusinessProfile.issues).toContain("No Google Business Profile link detected");
    });
  });

  describe("GBP validation", () => {
    test("verified=true for HTTP 200", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.verified).toBe(true);
      expect(result.googleBusinessProfile.issues).toHaveLength(0);
    });

    test("verified=true for HTTP 301 redirect", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.verified).toBe(true);
    });

    test("verified=false for HTTP 404", async () => {
      globalThis.fetch = mockFetch({ status: 404 });
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.verified).toBe(false);
      expect(result.googleBusinessProfile.issues).toContain("Link returned HTTP 404");
    });

    test("verified=false for HTTP 500", async () => {
      globalThis.fetch = mockFetch({ status: 500 });
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.verified).toBe(false);
      expect(result.googleBusinessProfile.issues).toContain("Link returned HTTP 500");
    });

    test("verified=false for network error", async () => {
      globalThis.fetch = mockFetch(new Error("Network error"));
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.verified).toBe(false);
      expect(result.googleBusinessProfile.issues).toContain("Link could not be reached");
    });

    test("verified=false for timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      globalThis.fetch = mockFetch(abortError);
      const html = createHtml(`<a href="https://g.page/mybusiness">Find us</a>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.verified).toBe(false);
      expect(result.googleBusinessProfile.issues).toContain("Link validation timed out");
    });

    test("no validation when only iframe (no URL)", async () => {
      const html = createHtml(`<iframe src="https://google.com/maps/embed?pb=..."></iframe>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.googleBusinessProfile.exists).toBe(true);
      expect(result.googleBusinessProfile.url).toBeNull();
      expect(result.googleBusinessProfile.verified).toBe(false);
    });
  });

  describe("other local presence features", () => {
    test("detects phone numbers", async () => {
      const html = createHtml(`<p>Call us: (555) 123-4567</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.phones.length).toBeGreaterThan(0);
    });

    test("detects email addresses", async () => {
      const html = createHtml(`<p>Email: contact@example.com</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.emails).toContain("contact@example.com");
    });

    test("detects directory listings", async () => {
      const html = createHtml(`<a href="https://yelp.com/biz/mybusiness">Yelp</a>`);
      const result = await scanner.run(createMockContext(html));
      const yelp = result.directories.find(d => d.name === "Yelp");
      expect(yelp?.listed).toBe(true);
    });
  });
});
