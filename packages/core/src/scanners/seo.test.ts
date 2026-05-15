import { describe, expect, mock, test, afterEach } from "bun:test";
import { SeoScanner } from "./seo";
import type { ScannerContext } from "./types";

const originalFetch = globalThis.fetch;

function createHtml(body: string, head: string = ""): string {
  return `<!DOCTYPE html><html><head><title>Example business website page</title>${head}</head><body>${body}</body></html>`;
}

function createMockContext(html: string): ScannerContext {
  return {
    url: "https://example.com",
    page: {} as never,
    html,
    browserPort: 9222,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SeoScanner", () => {
  const scanner = new SeoScanner();

  test("does not treat mailto and tel links as broken HTTP links", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        status: 200,
        text: () => Promise.resolve(""),
      } as Response)
    );
    Object.assign(fetchMock, { preconnect: () => {} });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await scanner.run(
      createMockContext(`
        <a href="mailto:frontdesk@hopespringswc.com">Email</a>
        <a href="tel:5203728575">Call</a>
        <a href="/about">About</a>
      `)
    );

    expect(result.links.broken).toEqual([]);
    expect(result.links.internal).toEqual(["https://example.com/about"]);
    expect(result.links.external).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^(mailto|tel):/),
      expect.anything()
    );
  });

  test("reports linked internal pages that return 404", async () => {
    const fetchMock = mock((url: string) =>
      Promise.resolve({
        status: url === "https://example.com/contact" ? 404 : 200,
        statusText: url === "https://example.com/contact" ? "Not Found" : "OK",
        text: () => Promise.resolve(""),
      } as Response)
    );
    Object.assign(fetchMock, { preconnect: () => {} });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await scanner.run(
      createMockContext(`
        <a href="/contact">Contact</a>
        <a href="/about">About</a>
      `)
    );

    expect(result.links.broken).toEqual([
      {
        url: "https://example.com/contact",
        statusCode: 404,
        statusText: "Not Found",
        foundOn: "https://example.com",
        anchorText: "Contact",
      },
    ]);
  });
});
