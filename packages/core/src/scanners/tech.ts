import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type {
  TechData,
  SecurityData,
  SecurityHeader,
  AnalyticsData,
  TechnologyItem,
  AuditIssue,
} from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

const TECH_SIGNATURES: Record<
  string,
  {
    detect: (html: string, $: cheerio.CheerioAPI) => boolean;
    category: string;
    confidence?: number;
  }
> = {
  React: {
    detect: (_, $) => $("[data-reactroot], [data-reactid]").length > 0,
    category: "JavaScript Framework",
    confidence: 90,
  },
  "Next.js": {
    detect: (_, $) => $('script[src*="_next"]').length > 0,
    category: "JavaScript Framework",
    confidence: 95,
  },
  Vue: {
    detect: (_, $) =>
      $("[data-v-]").length > 0 || $('script[src*="vue"]').length > 0,
    category: "JavaScript Framework",
    confidence: 90,
  },
  Nuxt: {
    detect: (html) => html.includes("__nuxt") || html.includes("_nuxt"),
    category: "JavaScript Framework",
    confidence: 95,
  },
  Angular: {
    detect: (_, $) => $("[ng-app], [ng-controller], [_ngcontent]").length > 0,
    category: "JavaScript Framework",
    confidence: 90,
  },
  Svelte: {
    detect: (_, $) => $("[class*='svelte-']").length > 0,
    category: "JavaScript Framework",
    confidence: 85,
  },
  jQuery: {
    detect: (_, $) => $('script[src*="jquery"]').length > 0,
    category: "JavaScript Library",
    confidence: 95,
  },
  WordPress: {
    detect: (html) => html.includes("wp-content") || html.includes("wp-includes"),
    category: "CMS",
    confidence: 95,
  },
  Drupal: {
    detect: (html) => html.includes("drupal") || html.includes("/sites/default/files"),
    category: "CMS",
    confidence: 90,
  },
  Joomla: {
    detect: (html) => html.includes("/media/jui/") || html.includes("joomla"),
    category: "CMS",
    confidence: 90,
  },
  Shopify: {
    detect: (html) => html.includes("cdn.shopify.com"),
    category: "E-commerce Platform",
    confidence: 95,
  },
  WooCommerce: {
    detect: (html) => html.includes("woocommerce") || html.includes("wc-cart"),
    category: "E-commerce Platform",
    confidence: 95,
  },
  Magento: {
    detect: (html) => html.includes("mage-cache") || html.includes("/static/version"),
    category: "E-commerce Platform",
    confidence: 90,
  },
  Webflow: {
    detect: (html) => html.includes("webflow.com"),
    category: "Website Builder",
    confidence: 95,
  },
  Wix: {
    detect: (html) => html.includes("wix.com") || html.includes("parastorage.com"),
    category: "Website Builder",
    confidence: 95,
  },
  Squarespace: {
    detect: (html) => html.includes("squarespace.com"),
    category: "Website Builder",
    confidence: 95,
  },
  Framer: {
    detect: (html) => html.includes("framer.com") || html.includes("framer-motion"),
    category: "Website Builder",
    confidence: 90,
  },
  Bootstrap: {
    detect: (_, $) =>
      $('link[href*="bootstrap"], script[src*="bootstrap"]').length > 0,
    category: "CSS Framework",
    confidence: 90,
  },
  Tailwind: {
    detect: (html) => /class="[^"]*(?:flex|grid|p-\d|m-\d|text-\w+)/.test(html),
    category: "CSS Framework",
    confidence: 70,
  },
  "Material UI": {
    detect: (_, $) => $("[class*='MuiBox'], [class*='MuiButton']").length > 0,
    category: "UI Library",
    confidence: 90,
  },
  Chakra: {
    detect: (_, $) => $("[class*='chakra-']").length > 0,
    category: "UI Library",
    confidence: 90,
  },
  Cloudflare: {
    detect: (html) => html.includes("cloudflare") || html.includes("cdnjs.cloudflare.com"),
    category: "CDN",
    confidence: 90,
  },
  Vercel: {
    detect: (html) => html.includes("vercel.com") || html.includes("vercel-analytics"),
    category: "Hosting",
    confidence: 85,
  },
  Netlify: {
    detect: (html) => html.includes("netlify"),
    category: "Hosting",
    confidence: 85,
  },
  "Google Fonts": {
    detect: (_, $) => $('link[href*="fonts.googleapis.com"]').length > 0,
    category: "Font Service",
    confidence: 95,
  },
};

export class TechScanner implements Scanner<TechData> {
  id = "tech";
  name = "Technology & Security";

  async run(context: ScannerContext): Promise<TechData> {
    context.onProgress?.("Detecting technologies...");

    const $ = cheerio.load(context.html);
    const url = new URL(context.url);
    const issues: AuditIssue[] = [];

    const scripts = this.extractScripts($);
    const security = await this.analyzeSecurity(url, context, issues);
    const analytics = this.detectAnalytics(scripts, context.html);
    const technologies = this.detectTechnologies(context.html, $);
    const cdns = this.detectCDNs(context.html, $);

    const cms = technologies.find((t) => t.category === "CMS")?.name;
    const framework = technologies.find(
      (t) => t.category === "JavaScript Framework"
    )?.name;

    if (!analytics.googleAnalytics && !analytics.googleAnalytics4) {
      issues.push(createIssue("no_google_analytics"));
    }

    return {
      security,
      analytics,
      advertising: {
        paidSearch: { googleAds: false, bingAds: false, detected: false, issues: [] },
        socialAds: {
          facebookAds: false,
          instagramAds: false,
          linkedinAds: false,
          twitterAds: false,
          detected: false,
        },
        retargeting: {
          googleRemarketing: false,
          facebookPixel: analytics.facebookPixel,
          otherPixels: [],
          detected: analytics.facebookPixel,
        },
        displayAds: { googleDisplayNetwork: false, otherNetworks: [], detected: false },
        issues: [],
      },
      technologies,
      cms,
      framework,
      cdns,
      issues,
    };
  }

  private extractScripts($: cheerio.CheerioAPI): string[] {
    const scripts: string[] = [];
    $("script[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (src) scripts.push(src);
    });
    return scripts;
  }

  private async analyzeSecurity(
    url: URL,
    context: ScannerContext,
    issues: AuditIssue[]
  ): Promise<SecurityData> {
    context.onProgress?.("Checking security...");

    const $ = cheerio.load(context.html);
    const isHTTPS = url.protocol === "https:";
    const hasMixedContent = this.detectMixedContent($, url);

    const securityHeaders = await this.checkSecurityHeaders(context.url);
    const gdprCompliance = this.checkGDPRCompliance($, context.html);

    if (!isHTTPS) {
      issues.push(createIssue("not_https"));
    }

    if (hasMixedContent) {
      issues.push(createIssue("mixed_content"));
    }

    const missingHeaders = securityHeaders.filter((h) => !h.present);
    if (missingHeaders.length > 0) {
      issues.push(
        createIssue("missing_security_headers", {
          description: `Missing: ${missingHeaders.map((h) => h.name).join(", ")}`,
        })
      );
    }

    if (!gdprCompliance.hasPrivacyPolicy) {
      issues.push(createIssue("no_privacy_policy"));
    }

    if (!gdprCompliance.hasCookieBanner) {
      issues.push(createIssue("no_cookie_banner"));
    }

    return {
      isHTTPS,
      hasHSTS: securityHeaders.some(
        (h) => h.name === "Strict-Transport-Security" && h.present
      ),
      mixedContent: hasMixedContent,
      securityHeaders,
      gdprCompliance,
      issues: [],
    };
  }

  private detectMixedContent($: cheerio.CheerioAPI, baseUrl: URL): boolean {
    if (baseUrl.protocol !== "https:") return false;

    let hasMixed = false;

    $("img, script, link, iframe, video, audio, source").each((_, el) => {
      const src =
        $(el).attr("src") || $(el).attr("href") || $(el).attr("data-src");
      if (src && src.startsWith("http://") && !src.startsWith("http://localhost")) {
        hasMixed = true;
        return false;
      }
    });

    return hasMixed;
  }

  private async checkSecurityHeaders(url: string): Promise<SecurityHeader[]> {
    const headers: SecurityHeader[] = [
      {
        name: "Strict-Transport-Security",
        present: false,
        recommendation: "Add HSTS header to enforce HTTPS",
      },
      {
        name: "X-Content-Type-Options",
        present: false,
        recommendation: "Add 'nosniff' to prevent MIME sniffing",
      },
      {
        name: "X-Frame-Options",
        present: false,
        recommendation: "Add 'DENY' or 'SAMEORIGIN' to prevent clickjacking",
      },
      {
        name: "Content-Security-Policy",
        present: false,
        recommendation: "Configure CSP to prevent XSS attacks",
      },
      {
        name: "X-XSS-Protection",
        present: false,
        recommendation: "Add '1; mode=block' for legacy browser XSS protection",
      },
      {
        name: "Referrer-Policy",
        present: false,
        recommendation: "Control referrer information sent with requests",
      },
    ];

    try {
      const response = await fetch(url, { method: "HEAD" });

      for (const header of headers) {
        const value = response.headers.get(header.name);
        if (value) {
          header.present = true;
          header.value = value;
        }
      }
    } catch {
    }

    return headers;
  }

  private checkGDPRCompliance(
    $: cheerio.CheerioAPI,
    html: string
  ): SecurityData["gdprCompliance"] {
    const hasPrivacyPolicy =
      $('a[href*="privacy"]').length > 0 ||
      $('a[href*="datenschutz"]').length > 0 ||
      html.toLowerCase().includes("privacy policy");

    const hasCookieBanner =
      $('[class*="cookie"], [id*="cookie"]').length > 0 ||
      $('[class*="consent"], [id*="consent"]').length > 0 ||
      html.includes("onetrust") ||
      html.includes("cookiebot") ||
      html.includes("cookieconsent") ||
      html.includes("cookie-banner") ||
      html.includes("cookie_banner");

    const hasCookiePolicy =
      $('a[href*="cookie-policy"]').length > 0 ||
      $('a[href*="cookies"]').length > 0;

    const issues: string[] = [];
    if (!hasPrivacyPolicy) issues.push("No privacy policy link found");
    if (!hasCookieBanner) issues.push("No cookie consent mechanism detected");

    return {
      hasPrivacyPolicy,
      hasCookieBanner,
      hasCookiePolicy,
      issues,
    };
  }

  private detectAnalytics(scripts: string[], html: string): AnalyticsData {
    const allScripts = scripts.join(" ") + " " + html;

    return {
      googleAnalytics:
        /UA-\d+-\d+/.test(allScripts) ||
        allScripts.includes("google-analytics.com/analytics.js"),
      googleAnalytics4:
        /G-[A-Z0-9]+/.test(allScripts) ||
        allScripts.includes("gtag/js") ||
        allScripts.includes("googletagmanager.com/gtag"),
      googleTagManager:
        allScripts.includes("googletagmanager.com/gtm.js") ||
        /GTM-[A-Z0-9]+/.test(allScripts),
      facebookPixel:
        allScripts.includes("connect.facebook.net") ||
        allScripts.includes("fbevents.js") ||
        allScripts.includes("fbq("),
      hotjar: allScripts.includes("hotjar.com") || allScripts.includes("hj("),
      mixpanel: allScripts.includes("mixpanel.com"),
      segment: allScripts.includes("segment.com") || allScripts.includes("analytics.js"),
      otherTrackers: this.detectOtherTrackers(allScripts),
    };
  }

  private detectOtherTrackers(content: string): string[] {
    const trackers: string[] = [];

    if (content.includes("clarity.ms")) trackers.push("Microsoft Clarity");
    if (content.includes("amplitude.com")) trackers.push("Amplitude");
    if (content.includes("heap.io") || content.includes("heapanalytics")) {
      trackers.push("Heap");
    }
    if (content.includes("fullstory.com")) trackers.push("FullStory");
    if (content.includes("logrocket.com")) trackers.push("LogRocket");
    if (content.includes("posthog.com")) trackers.push("PostHog");
    if (content.includes("plausible.io")) trackers.push("Plausible");
    if (content.includes("fathom")) trackers.push("Fathom");
    if (content.includes("matomo") || content.includes("piwik")) {
      trackers.push("Matomo");
    }

    return trackers;
  }

  private detectTechnologies(
    html: string,
    $: cheerio.CheerioAPI
  ): TechnologyItem[] {
    const detected: TechnologyItem[] = [];

    for (const [tech, config] of Object.entries(TECH_SIGNATURES)) {
      if (config.detect(html, $)) {
        detected.push({
          name: tech,
          category: config.category,
          confidence: config.confidence || 80,
        });
      }
    }

    return detected;
  }

  private detectCDNs(html: string, $: cheerio.CheerioAPI): string[] {
    const cdns: string[] = [];

    if (
      html.includes("cloudflare") ||
      $('script[src*="cloudflare"]').length > 0
    ) {
      cdns.push("Cloudflare");
    }
    if (
      html.includes("amazonaws.com") ||
      html.includes("cloudfront.net")
    ) {
      cdns.push("AWS CloudFront");
    }
    if (html.includes("akamaized.net") || html.includes("akamai")) {
      cdns.push("Akamai");
    }
    if (html.includes("fastly.net")) {
      cdns.push("Fastly");
    }
    if (html.includes("stackpath") || html.includes("bootstrapcdn")) {
      cdns.push("StackPath");
    }
    if (html.includes("unpkg.com")) {
      cdns.push("unpkg");
    }
    if (html.includes("jsdelivr.net")) {
      cdns.push("jsDelivr");
    }

    return cdns;
  }
}
