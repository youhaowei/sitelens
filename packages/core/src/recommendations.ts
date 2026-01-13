import type { AuditIssue, IssueSeverity } from "@sitelens/shared/types";

type IssueCategory =
  | "seo"
  | "performance"
  | "accessibility"
  | "security"
  | "social"
  | "local"
  | "advertising"
  | "ecommerce"
  | "content";

interface IssueTemplate {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
  recommendation: string;
  learnMoreUrl?: string;
  impact: string;
  effort: "low" | "medium" | "high";
}

const ISSUE_TEMPLATES: Record<string, IssueTemplate> = {
  missing_title: {
    id: "missing_title",
    title: "Missing Page Title",
    description: "The page does not have a title tag defined.",
    severity: "critical",
    category: "seo",
    recommendation:
      "Add a unique, descriptive title tag between 50-60 characters. Include your primary keyword near the beginning. Format: 'Primary Keyword - Secondary Keyword | Brand Name'",
    learnMoreUrl: "https://moz.com/learn/seo/title-tag",
    impact: "Title tags are the most important on-page SEO element and directly impact search rankings and click-through rates.",
    effort: "low",
  },

  title_too_short: {
    id: "title_too_short",
    title: "Title Tag Too Short",
    description: "The title tag is shorter than the recommended 50 characters.",
    severity: "warning",
    category: "seo",
    recommendation:
      "Expand your title to 50-60 characters. Include relevant keywords and make it compelling for users to click. Consider adding your brand name at the end.",
    impact: "Short titles may not fully convey your page content and miss keyword opportunities.",
    effort: "low",
  },

  title_too_long: {
    id: "title_too_long",
    title: "Title Tag Too Long",
    description: "The title tag exceeds 60 characters and will be truncated in search results.",
    severity: "warning",
    category: "seo",
    recommendation:
      "Shorten your title to 60 characters or less. Put the most important keywords and information at the beginning since the end may be cut off.",
    impact: "Truncated titles in search results look unprofessional and may hide important information.",
    effort: "low",
  },

  missing_description: {
    id: "missing_description",
    title: "Missing Meta Description",
    description: "The page does not have a meta description defined.",
    severity: "critical",
    category: "seo",
    recommendation:
      "Add a compelling meta description between 150-160 characters. Include a call-to-action and your target keyword. Make it unique for each page.",
    learnMoreUrl: "https://moz.com/learn/seo/meta-description",
    impact: "Without a meta description, search engines will auto-generate one from page content, which may not be optimized for clicks.",
    effort: "low",
  },

  description_too_short: {
    id: "description_too_short",
    title: "Meta Description Too Short",
    description: "The meta description is shorter than the recommended 120 characters.",
    severity: "warning",
    category: "seo",
    recommendation:
      "Expand your meta description to 150-160 characters. Include a value proposition, target keyword, and clear call-to-action.",
    impact: "Short descriptions miss the opportunity to fully sell the page content to searchers.",
    effort: "low",
  },

  description_too_long: {
    id: "description_too_long",
    title: "Meta Description Too Long",
    description: "The meta description exceeds 160 characters and will be truncated.",
    severity: "info",
    category: "seo",
    recommendation:
      "Shorten your meta description to 160 characters. Front-load the most important information and call-to-action.",
    impact: "Truncated descriptions may lose their call-to-action or key selling points.",
    effort: "low",
  },

  missing_h1: {
    id: "missing_h1",
    title: "Missing H1 Heading",
    description: "The page does not have an H1 heading tag.",
    severity: "critical",
    category: "seo",
    recommendation:
      "Add a single H1 heading that clearly describes the page content and includes your primary keyword. This should be the main headline visible on the page.",
    impact: "H1 tags help search engines understand page structure and topic. Missing H1 hurts SEO and accessibility.",
    effort: "low",
  },

  multiple_h1: {
    id: "multiple_h1",
    title: "Multiple H1 Headings",
    description: "The page has more than one H1 heading tag.",
    severity: "warning",
    category: "seo",
    recommendation:
      "Use only one H1 tag per page for your main headline. Convert other H1 tags to H2 or appropriate heading levels based on content hierarchy.",
    impact: "Multiple H1s dilute the importance signal and can confuse search engines about the main topic.",
    effort: "low",
  },

  heading_hierarchy: {
    id: "heading_hierarchy",
    title: "Heading Hierarchy Issues",
    description: "Headings skip levels (e.g., H1 to H3 without H2).",
    severity: "warning",
    category: "seo",
    recommendation:
      "Restructure headings to follow proper hierarchy: H1 → H2 → H3. Never skip levels. Use headings to create a logical document outline.",
    impact: "Proper heading structure improves accessibility for screen readers and helps search engines understand content organization.",
    effort: "medium",
  },

  thin_content: {
    id: "thin_content",
    title: "Thin Content Detected",
    description: "The page has less than 300 words of content.",
    severity: "warning",
    category: "content",
    recommendation:
      "Expand page content to at least 500-1000 words for informational pages. Add valuable, unique content that addresses user intent. Include relevant keywords naturally.",
    impact: "Thin content pages may not rank well and provide less value to users. Google prefers comprehensive content.",
    effort: "high",
  },

  poor_readability: {
    id: "poor_readability",
    title: "Content Difficult to Read",
    description: "The content has a low Flesch Reading Ease score, making it hard for many users to understand.",
    severity: "warning",
    category: "content",
    recommendation:
      "Simplify your writing: use shorter sentences (15-20 words), simpler words, and active voice. Break up long paragraphs. Aim for a reading level around 8th grade.",
    impact: "Difficult-to-read content has higher bounce rates and lower engagement.",
    effort: "medium",
  },

  spelling_errors: {
    id: "spelling_errors",
    title: "Spelling Errors Detected",
    description: "The page contains spelling mistakes that may hurt credibility.",
    severity: "warning",
    category: "content",
    recommendation:
      "Review and correct all spelling errors. Use a spell-checker tool and have content proofread before publishing. Consider using Grammarly or similar tools.",
    impact: "Spelling errors reduce trust and professionalism. They may also hurt SEO as Google may see low-quality signals.",
    effort: "low",
  },

  images_missing_alt: {
    id: "images_missing_alt",
    title: "Images Missing Alt Text",
    description: "Some images on the page do not have alt attributes.",
    severity: "warning",
    category: "accessibility",
    recommendation:
      "Add descriptive alt text to all images. Describe what the image shows in 125 characters or less. For decorative images, use alt=\"\".",
    learnMoreUrl: "https://moz.com/learn/seo/alt-text",
    impact: "Missing alt text hurts accessibility (screen readers can't describe images) and loses SEO value from image search.",
    effort: "medium",
  },

  broken_links: {
    id: "broken_links",
    title: "Broken Links Detected",
    description: "Some links on the page return 404 or other error status codes.",
    severity: "critical",
    category: "seo",
    recommendation:
      "Fix or remove all broken links. Update URLs to working destinations, set up 301 redirects for moved pages, or remove links to deleted content entirely.",
    impact: "Broken links hurt user experience, waste crawl budget, and can negatively impact SEO rankings.",
    effort: "medium",
  },

  missing_sitemap: {
    id: "missing_sitemap",
    title: "No XML Sitemap Found",
    description: "No XML sitemap was detected at common locations.",
    severity: "warning",
    category: "seo",
    recommendation:
      "Create an XML sitemap and submit it to Google Search Console and Bing Webmaster Tools. Most CMS platforms can generate this automatically.",
    learnMoreUrl: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
    impact: "Sitemaps help search engines discover and index your pages more efficiently.",
    effort: "medium",
  },

  missing_robots: {
    id: "missing_robots",
    title: "No robots.txt Found",
    description: "No robots.txt file was found at the root of the domain.",
    severity: "info",
    category: "seo",
    recommendation:
      "Create a robots.txt file to guide search engine crawlers. At minimum, include your sitemap URL. Block any pages you don't want indexed.",
    impact: "Without robots.txt, you can't control crawler access or direct them to your sitemap.",
    effort: "low",
  },

  missing_og_title: {
    id: "missing_og_title",
    title: "Missing Open Graph Title",
    description: "The page lacks an og:title meta tag for social sharing.",
    severity: "warning",
    category: "social",
    recommendation:
      "Add an og:title meta tag with a compelling title for social shares. It can be the same as your page title or a more engaging version.",
    impact: "Without OG tags, social platforms may display incorrect or unappealing previews when your page is shared.",
    effort: "low",
  },

  missing_og_description: {
    id: "missing_og_description",
    title: "Missing Open Graph Description",
    description: "The page lacks an og:description meta tag for social sharing.",
    severity: "warning",
    category: "social",
    recommendation:
      "Add an og:description meta tag with a compelling summary of the page content. Make it engaging and include a call-to-action.",
    impact: "Social shares without descriptions look incomplete and get fewer clicks.",
    effort: "low",
  },

  missing_og_image: {
    id: "missing_og_image",
    title: "Missing Open Graph Image",
    description: "The page lacks an og:image meta tag for social sharing.",
    severity: "critical",
    category: "social",
    recommendation:
      "Add an og:image meta tag with a high-quality image (minimum 1200x630 pixels for Facebook). Use branded images that stand out in social feeds.",
    impact: "Posts without images get significantly less engagement. Visual content is crucial for social sharing.",
    effort: "medium",
  },

  missing_twitter_card: {
    id: "missing_twitter_card",
    title: "Missing Twitter Card",
    description: "The page lacks Twitter Card meta tags.",
    severity: "warning",
    category: "social",
    recommendation:
      "Add Twitter Card meta tags: twitter:card, twitter:title, twitter:description, and twitter:image. Use 'summary_large_image' card type for maximum impact.",
    learnMoreUrl: "https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards",
    impact: "Without Twitter Cards, your shared links will appear as plain text URLs with no preview.",
    effort: "low",
  },

  no_social_profiles: {
    id: "no_social_profiles",
    title: "No Social Profile Links Found",
    description: "The website does not link to any social media profiles.",
    severity: "info",
    category: "social",
    recommendation:
      "Add links to your active social media profiles in the header, footer, or contact page. Include schema.org markup for social profiles.",
    impact: "Social links help users connect with your brand across platforms and can contribute to local SEO signals.",
    effort: "low",
  },

  not_https: {
    id: "not_https",
    title: "Site Not Using HTTPS",
    description: "The website is not served over a secure HTTPS connection.",
    severity: "critical",
    category: "security",
    recommendation:
      "Install an SSL certificate and redirect all HTTP traffic to HTTPS. Most hosting providers offer free SSL via Let's Encrypt. Update all internal links to use HTTPS.",
    learnMoreUrl: "https://web.dev/why-https-matters/",
    impact: "HTTPS is a confirmed ranking factor. Without it, browsers show security warnings, hurting trust and conversions.",
    effort: "medium",
  },

  mixed_content: {
    id: "mixed_content",
    title: "Mixed Content Detected",
    description: "The HTTPS page loads some resources over insecure HTTP.",
    severity: "warning",
    category: "security",
    recommendation:
      "Update all resource URLs (images, scripts, stylesheets) to use HTTPS. Check embedded content and third-party resources.",
    impact: "Mixed content triggers browser warnings and can block some resources from loading.",
    effort: "medium",
  },

  missing_security_headers: {
    id: "missing_security_headers",
    title: "Missing Security Headers",
    description: "Important security headers are not configured.",
    severity: "warning",
    category: "security",
    recommendation:
      "Configure security headers: X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, and Strict-Transport-Security (HSTS).",
    learnMoreUrl: "https://owasp.org/www-project-secure-headers/",
    impact: "Missing headers leave your site vulnerable to clickjacking, XSS, and other attacks.",
    effort: "medium",
  },

  no_privacy_policy: {
    id: "no_privacy_policy",
    title: "No Privacy Policy Found",
    description: "The website does not appear to have a privacy policy page.",
    severity: "critical",
    category: "security",
    recommendation:
      "Create a privacy policy page that explains how you collect, use, and protect user data. This is legally required in most jurisdictions if you collect any user data.",
    impact: "Missing privacy policy can result in legal issues and hurts user trust. Required for GDPR, CCPA compliance.",
    effort: "medium",
  },

  no_cookie_banner: {
    id: "no_cookie_banner",
    title: "No Cookie Consent Banner",
    description: "No cookie consent mechanism was detected.",
    severity: "warning",
    category: "security",
    recommendation:
      "Implement a cookie consent banner that allows users to accept or reject non-essential cookies. Use tools like Cookiebot, OneTrust, or a custom solution.",
    impact: "Cookie consent is required by GDPR for EU visitors and CCPA for California residents.",
    effort: "medium",
  },

  slow_page_load: {
    id: "slow_page_load",
    title: "Slow Page Load Time",
    description: "The page takes longer than 3 seconds to become interactive.",
    severity: "critical",
    category: "performance",
    recommendation:
      "Optimize images (use WebP format, lazy loading), minify CSS/JS, enable browser caching, use a CDN, and reduce server response time. Consider code splitting for large JavaScript bundles.",
    learnMoreUrl: "https://web.dev/performance/",
    impact: "53% of mobile users abandon sites that take over 3 seconds to load. Speed is a confirmed ranking factor.",
    effort: "high",
  },

  large_lcp: {
    id: "large_lcp",
    title: "Large Contentful Paint Too Slow",
    description: "The largest visible content takes too long to appear (over 2.5 seconds).",
    severity: "critical",
    category: "performance",
    recommendation:
      "Optimize your largest content element: preload hero images, use proper image formats, ensure fast server response. Consider using a CDN for static assets.",
    learnMoreUrl: "https://web.dev/lcp/",
    impact: "LCP is a Core Web Vital. Poor scores negatively impact search rankings and user experience.",
    effort: "high",
  },

  high_cls: {
    id: "high_cls",
    title: "High Cumulative Layout Shift",
    description: "Page elements shift unexpectedly during loading (CLS over 0.1).",
    severity: "warning",
    category: "performance",
    recommendation:
      "Set explicit width/height on images and videos, avoid inserting content above existing content, and use CSS transform for animations instead of layout-changing properties.",
    learnMoreUrl: "https://web.dev/cls/",
    impact: "Layout shifts are frustrating for users and CLS is a Core Web Vital affecting rankings.",
    effort: "medium",
  },

  high_tbt: {
    id: "high_tbt",
    title: "High Total Blocking Time",
    description: "JavaScript execution blocks the main thread for too long.",
    severity: "warning",
    category: "performance",
    recommendation:
      "Reduce JavaScript execution time: break up long tasks, use web workers, defer non-critical scripts, remove unused code, and consider using lighter libraries.",
    learnMoreUrl: "https://web.dev/tbt/",
    impact: "High TBT makes the page feel unresponsive. It correlates with poor First Input Delay (FID).",
    effort: "high",
  },

  not_mobile_friendly: {
    id: "not_mobile_friendly",
    title: "Page Not Mobile-Friendly",
    description: "The page is not optimized for mobile devices.",
    severity: "critical",
    category: "performance",
    recommendation:
      "Implement responsive design with a viewport meta tag, flexible layouts, and mobile-appropriate font sizes. Ensure touch targets are at least 48x48 pixels.",
    learnMoreUrl: "https://web.dev/responsive-web-design-basics/",
    impact: "Mobile-first indexing means Google primarily uses mobile version for ranking. Non-mobile-friendly sites rank poorly.",
    effort: "high",
  },

  wcag_level_a_violations: {
    id: "wcag_level_a_violations",
    title: "WCAG Level A Violations",
    description: "Critical accessibility issues prevent some users from accessing content.",
    severity: "critical",
    category: "accessibility",
    recommendation:
      "Fix Level A violations immediately: add alt text to images, ensure form labels, fix color contrast, enable keyboard navigation, and add skip links.",
    learnMoreUrl: "https://www.w3.org/WAI/WCAG21/quickref/",
    impact: "Level A is the minimum accessibility standard. Violations may violate ADA/accessibility laws and exclude users.",
    effort: "high",
  },

  wcag_level_aa_violations: {
    id: "wcag_level_aa_violations",
    title: "WCAG Level AA Violations",
    description: "Accessibility issues may create barriers for some users.",
    severity: "warning",
    category: "accessibility",
    recommendation:
      "Address Level AA issues: improve color contrast ratios (4.5:1 for text), add captions to videos, ensure focus indicators are visible, and provide text alternatives for non-text content.",
    impact: "Level AA is the target standard for most organizations and required for many government sites.",
    effort: "medium",
  },

  no_google_analytics: {
    id: "no_google_analytics",
    title: "No Analytics Tracking Detected",
    description: "No Google Analytics or similar tracking was found.",
    severity: "info",
    category: "advertising",
    recommendation:
      "Install Google Analytics 4 to track website traffic, user behavior, and conversions. Also set up Google Search Console to monitor search performance.",
    impact: "Without analytics, you can't measure marketing effectiveness or understand user behavior.",
    effort: "low",
  },

  no_retargeting: {
    id: "no_retargeting",
    title: "No Retargeting Pixels Detected",
    description: "No Facebook Pixel, Google Remarketing, or similar retargeting was found.",
    severity: "info",
    category: "advertising",
    recommendation:
      "Install retargeting pixels for platforms where you advertise. This allows you to show ads to past visitors who didn't convert.",
    impact: "Retargeting typically has 2-3x higher conversion rates than standard display ads.",
    effort: "low",
  },

  ecommerce_no_ssl: {
    id: "ecommerce_no_ssl",
    title: "E-commerce Site Without SSL",
    description: "Payment pages are not secured with HTTPS.",
    severity: "critical",
    category: "ecommerce",
    recommendation:
      "Immediately secure your checkout process with HTTPS. This is required by payment processors and essential for customer trust.",
    impact: "Customers will not enter payment information on insecure pages. Major browsers block insecure payment forms.",
    effort: "medium",
  },

  no_product_schema: {
    id: "no_product_schema",
    title: "Missing Product Schema",
    description: "Product pages lack structured data markup.",
    severity: "warning",
    category: "ecommerce",
    recommendation:
      "Add Product schema markup (JSON-LD) with price, availability, reviews, and images. This enables rich snippets in search results.",
    learnMoreUrl: "https://developers.google.com/search/docs/data-types/product",
    impact: "Product schema can significantly improve click-through rates with rich search result displays.",
    effort: "medium",
  },
};

export function createIssue(templateId: string, overrides?: Partial<AuditIssue>): AuditIssue {
  const template = ISSUE_TEMPLATES[templateId];
  if (!template) {
    return {
      id: templateId,
      title: overrides?.title || "Unknown Issue",
      description: overrides?.description || "",
      severity: overrides?.severity || "warning",
      category: overrides?.category || "seo",
      recommendation: overrides?.recommendation,
      impact: overrides?.impact,
      effort: overrides?.effort,
    };
  }

  return {
    ...template,
    ...overrides,
  };
}

export function getIssueTemplate(templateId: string): IssueTemplate | undefined {
  return ISSUE_TEMPLATES[templateId];
}

export function getAllTemplates(): Record<string, IssueTemplate> {
  return ISSUE_TEMPLATES;
}

export function categorizeIssues(issues: AuditIssue[]): Record<string, AuditIssue[]> {
  const categorized: Record<string, AuditIssue[]> = {};

  for (const issue of issues) {
    if (!categorized[issue.category]) {
      categorized[issue.category] = [];
    }
    categorized[issue.category]!.push(issue);
  }

  return categorized;
}

export function sortIssuesBySeverity(issues: AuditIssue[]): AuditIssue[] {
  const severityOrder: Record<IssueSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return [...issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

export function getTopIssues(issues: AuditIssue[], limit = 5): AuditIssue[] {
  return sortIssuesBySeverity(issues).slice(0, limit);
}

export function countBySeverity(issues: AuditIssue[]): Record<IssueSeverity, number> {
  const counts: Record<IssueSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    success: 0,
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return counts;
}
