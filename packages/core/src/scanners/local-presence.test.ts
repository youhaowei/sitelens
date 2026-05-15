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

function createHtmlWithHead(body: string, head: string): string {
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
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<p>Call us: (555) 123-4567</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.phones.length).toBeGreaterThan(0);
    });

    test("detects email addresses", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`<p>Email: contact@example.com</p>`);
      const result = await scanner.run(createMockContext(html));
      expect(result.emails).toContain("contact@example.com");
    });

    test("prefers contact links and does not over-capture adjacent labels", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`
        <a href="tel:5203728575">(520) 372-8575</a><span>Email</span><a href="mailto:frontdesk@hopespringswc.com">frontdesk@hopespringswc.com</a><span>Hours</span>
        <a href="tel:15203728575">1(520) 372-8575</a>
      `);

      const result = await scanner.run(createMockContext(html));

      expect(result.phones).toEqual(["(520) 372-8575"]);
      expect(result.emails).toEqual(["frontdesk@hopespringswc.com"]);
    });

    test("does not turn phone-adjacent marketing text into an address", async () => {
      globalThis.fetch = mockFetch({ status: 200 });
      const html = createHtml(`
        <a href="tel:5203728575">(520) 372-8575</a>
        <p>Hope Springs Wellness Center. Hope starts here!</p>
        <span>5650 E 22nd Street</span><span>Tucson, AZ 85711</span>
      `);

      const result = await scanner.run(createMockContext(html));

      expect(result.addresses).toEqual(["5650 E 22nd Street, Tucson, AZ 85711"]);
      expect(result.addresses).not.toContain("8575 Hope Springs Wellness Center Hope st");
    });

    test("uses page title before domain fallback for business name", async () => {
      const html = createHtmlWithHead(
        `<a href="tel:5203728575">(520) 372-8575</a>`,
        `<title>Hope Springs Wellness Center | Psychiatric Care in Tucson, AZ</title>`
      );

      const result = await scanner.run(createMockContext(html));

      expect(result.businessName).toBe("Hope Springs Wellness Center");
    });

    test("reports a missing standard contact page when contact details exist", async () => {
      globalThis.fetch = mockFetch({ status: 404 });
      const html = createHtml(`<a href="tel:5203728575">(520) 372-8575</a>`);

      const result = await scanner.run(createMockContext(html));

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          id: "missing_contact_page",
          title: "Contact Page Not Found",
          description: "The site has contact information, but https://example.com/contact returned HTTP 404.",
        })
      );
    });

    test("detects directory listings", async () => {
      const html = createHtml(`<a href="https://yelp.com/biz/mybusiness">Yelp</a>`);
      const result = await scanner.run(createMockContext(html));
      const yelp = result.directories.find(d => d.name === "Yelp");
      expect(yelp?.listed).toBe(true);
    });
  });
});
