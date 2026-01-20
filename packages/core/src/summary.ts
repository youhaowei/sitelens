import type {
  AuditReport,
  AuditIssue,
  ReportSummary,
  ImprovementSuggestion,
  AuditScores,
  DetailedScores,
  ScoreBreakdown,
  ScoreDeduction,
  ScoreBonus,
  CoreWebVitalsData,
  MetricData,
  MetricStatus,
  PerformanceMetricKey,
  PerformanceRecommendation,
  DiagnosticSummary,
} from "@sitelens/shared/types";
import { CWV_THRESHOLDS } from "@sitelens/shared/types";
import { sortIssuesBySeverity, countBySeverity } from "./recommendations";

const SCORE_WEIGHTS = {
  performance: 0.25,
  seo: 0.20,
  accessibility: 0.15,
  social: 0.10,
  security: 0.15,
  localPresence: 0.05,
  reviews: 0.05,
  advertising: 0.025,
  ecommerce: 0.025,
};

export function calculateOverallScore(scores: Partial<AuditScores>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  const scoreMap: Record<string, number | undefined> = {
    performance: scores.performance,
    seo: scores.seo,
    accessibility: scores.accessibility,
    social: scores.social,
    security: scores.security,
    localPresence: scores.localPresence,
    reviews: scores.reviews,
    advertising: scores.advertising,
    ecommerce: scores.ecommerce,
  };

  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const score = scoreMap[key];
    if (score !== undefined) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

export function generateSummary(report: AuditReport): ReportSummary {
  const allIssues = collectAllIssues(report);
  const severityCounts = countBySeverity(allIssues);
  const topIssues = sortIssuesBySeverity(allIssues).slice(0, 10);
  const strengths = identifyStrengths(report);
  const improvements = generateImprovementSuggestions(report, allIssues);
  const detailedScores = generateDetailedScores(report);

  return {
    totalIssues: allIssues.length,
    criticalIssues: severityCounts.critical,
    warningIssues: severityCounts.warning,
    topIssues,
    strengths,
    improvements: improvements.slice(0, 10),
    detailedScores,
  };
}

function collectAllIssues(report: AuditReport): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!report.details) return issues;

  if (report.details.fundamentals?.issues) {
    issues.push(...report.details.fundamentals.issues);
  }
  if (report.details.seo?.issues) {
    issues.push(...report.details.seo.issues);
  }
  if (report.details.social?.issues) {
    issues.push(...report.details.social.issues);
  }
  if (report.details.tech?.issues) {
    issues.push(...report.details.tech.issues);
  }
  if (report.details.tech?.security?.issues) {
    issues.push(...report.details.tech.security.issues);
  }
  if (report.details.advertising?.issues) {
    issues.push(...report.details.advertising.issues);
  }
  if (report.details.ecommerce?.issues) {
    issues.push(...report.details.ecommerce.issues);
  }
  if (report.details.accessibility?.issues) {
    issues.push(...report.details.accessibility.issues);
  }
  if (report.details.localPresence?.issues) {
    issues.push(...report.details.localPresence.issues);
  }
  if (report.details.reviews?.issues) {
    issues.push(...report.details.reviews.issues);
  }

  return issues;
}

function identifyStrengths(report: AuditReport): string[] {
  const strengths: string[] = [];

  if (!report.details || !report.scores) return strengths;

  if (report.scores.performance >= 90) {
    strengths.push("Excellent page performance and load times");
  }

  if (report.scores.accessibility >= 90) {
    strengths.push("Strong accessibility compliance");
  }

  if (report.scores.seo >= 90) {
    strengths.push("Well-optimized for search engines");
  }

  if (report.scores.social >= 90) {
    strengths.push("Complete social media presence and sharing optimization");
  }

  if (report.details.tech?.security?.isHTTPS) {
    strengths.push("Site secured with HTTPS encryption");
  }

  if (
    report.details.tech?.analytics?.googleAnalytics ||
    report.details.tech?.analytics?.googleAnalytics4
  ) {
    strengths.push("Analytics tracking properly configured");
  }

  if (report.details.seo?.sitemap?.exists) {
    strengths.push("XML sitemap in place for search engine crawling");
  }

  if (report.details.seo?.robots?.exists) {
    strengths.push("Robots.txt properly configured");
  }

  if (report.details.seo?.meta?.titleLengthOk) {
    strengths.push("Title tag optimized for search");
  }

  if (report.details.seo?.meta?.descriptionLengthOk) {
    strengths.push("Meta description well-crafted");
  }

  if (report.details.seo?.headings?.h1Count === 1) {
    strengths.push("Proper heading hierarchy with single H1");
  }

  if (!report.details.seo?.content?.isThinContent) {
    strengths.push("Adequate content depth for SEO");
  }

  const socialProfiles = Object.keys(report.details.social?.profiles || {});
  if (socialProfiles.length >= 3) {
    strengths.push(
      `Active on ${socialProfiles.length} social platforms: ${socialProfiles.join(", ")}`
    );
  }

  if (report.details.social?.openGraph?.isComplete) {
    strengths.push("Open Graph tags fully configured for social sharing");
  }

  if (report.details.tech?.security?.gdprCompliance?.hasCookieBanner) {
    strengths.push("Cookie consent mechanism in place");
  }

  if (report.details.tech?.security?.gdprCompliance?.hasPrivacyPolicy) {
    strengths.push("Privacy policy present");
  }

  return strengths.slice(0, 8);
}

function generateImprovementSuggestions(
  report: AuditReport,
  issues: AuditIssue[]
): ImprovementSuggestion[] {
  const suggestions: ImprovementSuggestion[] = [];

  if (!report.details || !report.scores) return suggestions;

  if (report.scores.performance < 50) {
    suggestions.push({
      category: "Performance",
      title: "Improve Page Load Speed",
      description:
        "Your page performance score is below 50. Focus on optimizing images, reducing JavaScript, and enabling caching to improve user experience and SEO rankings.",
      impact: "high",
      effort: "high",
      priority: 1,
    });
  } else if (report.scores.performance < 75) {
    suggestions.push({
      category: "Performance",
      title: "Optimize Core Web Vitals",
      description:
        "Your performance score is moderate. Review the speed opportunities identified to boost your Core Web Vitals scores.",
      impact: "medium",
      effort: "medium",
      priority: 3,
    });
  }

  if (!report.details.tech?.security?.isHTTPS) {
    suggestions.push({
      category: "Security",
      title: "Enable HTTPS",
      description:
        "Your site is not using HTTPS. Install an SSL certificate to secure user data and improve SEO rankings.",
      impact: "high",
      effort: "medium",
      priority: 1,
    });
  }

  const criticalSeoIssues = issues.filter(
    (i) => i.category === "seo" && i.severity === "critical"
  );
  if (criticalSeoIssues.length > 0) {
    suggestions.push({
      category: "SEO",
      title: "Fix Critical SEO Issues",
      description: `You have ${criticalSeoIssues.length} critical SEO issues including: ${criticalSeoIssues.map((i) => i.title).join(", ")}`,
      impact: "high",
      effort: "low",
      priority: 2,
    });
  }

  if (report.details.seo?.links?.broken?.length > 0) {
    const brokenCount = report.details.seo.links.broken.length;
    suggestions.push({
      category: "SEO",
      title: "Fix Broken Links",
      description: `Found ${brokenCount} broken links on your site. These hurt user experience and waste crawl budget. Update or remove broken links.`,
      impact: "medium",
      effort: "low",
      priority: 4,
    });
  }

  if (report.scores.accessibility < 70) {
    suggestions.push({
      category: "Accessibility",
      title: "Improve Accessibility Compliance",
      description:
        "Your accessibility score indicates significant issues. Focus on WCAG Level A violations first, then address Level AA issues.",
      impact: "high",
      effort: "high",
      priority: 2,
    });
  }

  if (!report.details.social?.openGraph?.isComplete) {
    suggestions.push({
      category: "Social",
      title: "Complete Open Graph Setup",
      description:
        "Your Open Graph tags are incomplete. Add og:title, og:description, and og:image to improve how your content appears when shared on social media.",
      impact: "medium",
      effort: "low",
      priority: 5,
    });
  }

  if (
    !report.details.tech?.analytics?.googleAnalytics &&
    !report.details.tech?.analytics?.googleAnalytics4
  ) {
    suggestions.push({
      category: "Marketing",
      title: "Install Analytics Tracking",
      description:
        "No analytics tracking detected. Install Google Analytics 4 to measure traffic, user behavior, and marketing effectiveness.",
      impact: "high",
      effort: "low",
      priority: 3,
    });
  }

  if (report.details.seo?.content?.isThinContent) {
    suggestions.push({
      category: "Content",
      title: "Add More Content",
      description: `Your page has only ${report.details.seo.content.wordCount} words. Add more substantive content (target 500+ words) to improve SEO and provide value to visitors.`,
      impact: "medium",
      effort: "medium",
      priority: 4,
    });
  }

  if (
    report.details.seo?.content?.readingEase &&
    report.details.seo.content.readingEase < 50
  ) {
    suggestions.push({
      category: "Content",
      title: "Improve Content Readability",
      description:
        "Your content is difficult to read. Use shorter sentences, simpler words, and break up long paragraphs to improve engagement.",
      impact: "medium",
      effort: "medium",
      priority: 6,
    });
  }

  if (report.details.seo?.images?.missingAlt > 0) {
    suggestions.push({
      category: "Accessibility",
      title: "Add Alt Text to Images",
      description: `${report.details.seo.images.missingAlt} images are missing alt text. Add descriptive alt text to improve accessibility and image SEO.`,
      impact: "medium",
      effort: "low",
      priority: 5,
    });
  }

  if (!report.details.seo?.sitemap?.exists) {
    suggestions.push({
      category: "SEO",
      title: "Create XML Sitemap",
      description:
        "No XML sitemap found. Create and submit a sitemap to help search engines discover and index your pages more efficiently.",
      impact: "medium",
      effort: "low",
      priority: 5,
    });
  }

  if (
    !report.details.tech?.security?.gdprCompliance?.hasCookieBanner &&
    (report.details.tech?.analytics?.googleAnalytics ||
      report.details.tech?.analytics?.facebookPixel)
  ) {
    suggestions.push({
      category: "Compliance",
      title: "Add Cookie Consent Banner",
      description:
        "You use tracking cookies but have no cookie consent mechanism. Implement a cookie banner to comply with GDPR and CCPA regulations.",
      impact: "high",
      effort: "medium",
      priority: 3,
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}

export function calculateCategoryScores(report: AuditReport): AuditScores {
  const details = report.details;

  return {
    overall: 0,
    performance: details?.fundamentals?.scores?.performance || 0,
    seo: calculateSeoScore(report),
    social: calculateSocialScore(report),
    accessibility: details?.fundamentals?.scores?.accessibility || 0,
    localPresence: calculateLocalPresenceScore(report),
    reviews: calculateReviewsScore(report),
    advertising: calculateAdvertisingScore(report),
    ecommerce: calculateEcommerceScore(report),
    security: calculateSecurityScore(report),
  };
}

function calculateSeoScore(report: AuditReport): number {
  if (!report.details?.seo) return 0;

  const seo = report.details.seo;
  let score = 100;

  if (!seo.meta.title) score -= 15;
  else if (!seo.meta.titleLengthOk) score -= 5;

  if (!seo.meta.description) score -= 10;
  else if (!seo.meta.descriptionLengthOk) score -= 3;

  if (seo.headings.h1Count === 0) score -= 10;
  else if (seo.headings.h1Count > 1) score -= 5;

  if (!seo.headings.structureOk) score -= 5;

  if (seo.content.isThinContent) score -= 10;

  if (seo.images.missingAlt > 0) {
    score -= Math.min(10, seo.images.missingAlt * 2);
  }

  if (seo.links.broken.length > 0) {
    score -= Math.min(15, seo.links.broken.length * 3);
  }

  if (!seo.sitemap.exists) score -= 5;
  if (!seo.robots.exists) score -= 3;

  return Math.max(0, Math.min(100, score));
}

function calculateSocialScore(report: AuditReport): number {
  if (!report.details?.social) return 0;

  const social = report.details.social;
  let score = 0;

  if (social.openGraph.hasTitle) score += 15;
  if (social.openGraph.hasDescription) score += 15;
  if (social.openGraph.hasImage) score += 20;

  if (social.twitter.hasCard) score += 15;

  const profileCount = Object.keys(social.profiles).length;
  score += Math.min(35, profileCount * 7);

  return Math.min(100, score);
}

function calculateSecurityScore(report: AuditReport): number {
  if (!report.details?.tech?.security) return 0;

  const security = report.details.tech.security;
  let score = 0;

  if (security.isHTTPS) score += 40;
  if (security.hasHSTS) score += 10;
  if (!security.mixedContent) score += 10;

  const presentHeaders = security.securityHeaders?.filter((h) => h.present).length || 0;
  score += Math.min(20, presentHeaders * 4);

  if (security.gdprCompliance?.hasPrivacyPolicy) score += 10;
  if (security.gdprCompliance?.hasCookieBanner) score += 10;

  return Math.min(100, score);
}

function calculateLocalPresenceScore(report: AuditReport): number {
  const localPresence = report.details?.localPresence;
  const local = report.details?.local;

  if (!localPresence && !local) return 0;

  let score = 0;

  if (localPresence) {
    if (localPresence.googleBusinessProfile?.exists) score += 25;
    if (localPresence.googleMaps?.listed) score += 15;
    if (localPresence.napConsistency?.consistent) score += 20;

    const listedDirs = localPresence.directories?.filter((d) => d.listed).length || 0;
    score += Math.min(20, listedDirs * 4);

    if (localPresence.phones?.length > 0) score += 10;
    if (localPresence.addresses?.length > 0) score += 10;
  } else if (local) {
    if (local.phones.length > 0) score += 30;
    if (local.emails.length > 0) score += 30;
    if (local.addresses.length > 0) score += 40;
  }

  return Math.min(100, score);
}

function calculateReviewsScore(report: AuditReport): number {
  const reviews = report.details?.reviews;
  if (!reviews) return 0;

  let score = 0;

  const platformsLinked = reviews.platforms?.filter((p) => p.url !== null).length || 0;
  score += Math.min(40, platformsLinked * 10);

  if (reviews.websiteShowsReviews) score += 25;
  if (reviews.testimonialPage) score += 15;

  if (reviews.overall?.averageRating > 0) {
    score += Math.min(20, reviews.overall.averageRating * 4);
  }

  return Math.min(100, score);
}

function calculateAdvertisingScore(report: AuditReport): number {
  const advertising = report.details?.advertising;
  if (!advertising) return 0;

  let score = 0;

  if (advertising.retargeting?.detected) score += 40;
  if (advertising.paidSearch?.detected) score += 30;
  if (advertising.socialAds?.detected) score += 30;

  return Math.min(100, score);
}

function calculateEcommerceScore(report: AuditReport): number {
  const ecommerce = report.details?.ecommerce;
  if (!ecommerce || !ecommerce.hasEcommerce) return 0;

  let score = 0;

  if (ecommerce.platform.detected) score += 20;
  if (ecommerce.paymentProcessors.length > 0) score += 30;
  if (ecommerce.sslOnCheckout) score += 30;
  if (ecommerce.productSchema) score += 20;

  return Math.min(100, score);
}

function generateDetailedScores(report: AuditReport): DetailedScores {
  const breakdown: ScoreBreakdown[] = [];

  breakdown.push(generatePerformanceBreakdown(report));
  breakdown.push(generateSeoBreakdown(report));
  breakdown.push(generateAccessibilityBreakdown(report));
  breakdown.push(generateSecurityBreakdown(report));
  breakdown.push(generateSocialBreakdown(report));
  breakdown.push(generateLocalPresenceBreakdown(report));
  breakdown.push(generateReviewsBreakdown(report));

  const overall = report.scores?.overall || 0;

  return {
    overall,
    overallExplanation: `Your overall score is calculated by combining all category scores. Performance (25%), SEO (20%), Security (15%), Accessibility (15%), Social (10%), Local Presence (5%), and Reviews (5%) are weighted based on their impact on your online success.`,
    breakdown,
  };
}

function getMetricStatus(metric: PerformanceMetricKey, value: number): MetricStatus {
  const threshold = CWV_THRESHOLDS[metric];
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

function formatMetricValue(metric: PerformanceMetricKey, value: number): string {
  if (metric === "cls") return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

const LIGHTHOUSE_WEIGHTS: Record<PerformanceMetricKey, number> = {
  tbt: 0.30,
  lcp: 0.25,
  cls: 0.25,
  fcp: 0.10,
  si: 0.10,
  ttfb: 0,
  tti: 0,
};

function calculateMetricScore(metric: PerformanceMetricKey, value: number): number {
  const threshold = CWV_THRESHOLDS[metric];
  if (value <= threshold.good) {
    const ratio = value / threshold.good;
    return Math.round(90 + (1 - ratio) * 10);
  }
  if (value >= threshold.poor) {
    const overage = (value - threshold.poor) / threshold.poor;
    return Math.max(0, Math.round(49 - overage * 49));
  }
  const range = threshold.poor - threshold.good;
  const position = (value - threshold.good) / range;
  return Math.round(90 - position * 40);
}

function createMetricData(
  metric: PerformanceMetricKey,
  value: number | undefined,
  label: string,
  description: string
): MetricData | null {
  if (value === undefined) return null;
  
  const status = getMetricStatus(metric, value);
  const score = calculateMetricScore(metric, value);
  const weight = LIGHTHOUSE_WEIGHTS[metric];
  const weightedScore = Math.round(score * weight * 100) / 100;
  
  return {
    value,
    score,
    weight,
    weightedScore,
    status,
    threshold: CWV_THRESHOLDS[metric],
    displayValue: formatMetricValue(metric, value),
    label,
    description,
  };
}

function generatePerformanceRecommendations(
  lcp: MetricData | null,
  cls: MetricData | null,
  tbt: MetricData | null
): PerformanceRecommendation[] {
  const recommendations: PerformanceRecommendation[] = [];
  
  if (cls && cls.status !== "good") {
    const ratio = cls.value / cls.threshold.good;
    recommendations.push({
      id: "fix-cls",
      metric: "cls",
      priority: cls.status === "poor" ? 1 : 2,
      impact: cls.status === "poor" ? "high" : "medium",
      title: "Fix Layout Shifts",
      description: `Your CLS of ${cls.displayValue} is ${ratio.toFixed(1)}x the target threshold. Elements shift around as the page loads, frustrating users.`,
      howToFix: "Set explicit width and height on images, videos, and embeds. Avoid inserting content above existing content. Use CSS transform for animations.",
      learnMoreUrl: "https://web.dev/cls/",
      ratio,
    });
  }
  
  if (tbt && tbt.status !== "good") {
    const ratio = tbt.value / tbt.threshold.good;
    recommendations.push({
      id: "fix-tbt",
      metric: "tbt",
      priority: tbt.status === "poor" ? 1 : 3,
      impact: tbt.status === "poor" ? "high" : "medium",
      title: "Reduce Blocking Time",
      description: `Your TBT of ${tbt.displayValue} makes the page feel sluggish. Users can't interact until JavaScript finishes executing.`,
      howToFix: "Break up long JavaScript tasks, defer non-critical scripts, remove unused code, and consider using a web worker for heavy computations.",
      learnMoreUrl: "https://web.dev/tbt/",
      ratio,
    });
  }
  
  if (lcp && lcp.status !== "good") {
    const ratio = lcp.value / lcp.threshold.good;
    recommendations.push({
      id: "fix-lcp",
      metric: "lcp",
      priority: lcp.status === "poor" ? 1 : 4,
      impact: lcp.status === "poor" ? "high" : "medium",
      title: "Speed Up Content Loading",
      description: `Your LCP of ${lcp.displayValue} means users wait too long to see the main content. This increases bounce rates.`,
      howToFix: "Optimize and preload your largest image, use a CDN, enable caching, and reduce server response time (TTFB).",
      learnMoreUrl: "https://web.dev/lcp/",
      ratio,
    });
  }
  
  return recommendations.sort((a, b) => a.priority - b.priority);
}

function generatePerformanceBreakdown(report: AuditReport): ScoreBreakdown {
  const score = report.details?.fundamentals?.scores?.performance || 0;
  const metrics = report.details?.fundamentals?.metrics;
  const tips: string[] = [];

  const lcp = createMetricData(
    "lcp",
    metrics?.lcp,
    "Largest Contentful Paint",
    "Time until the main content is visible"
  );
  
  const cls = createMetricData(
    "cls",
    metrics?.cls,
    "Cumulative Layout Shift",
    "How much the page layout shifts during loading"
  );
  
  const tbt = createMetricData(
    "tbt",
    metrics?.tbt,
    "Total Blocking Time",
    "Time the page is unresponsive to user input"
  );
  
  const fcp = createMetricData(
    "fcp",
    metrics?.fcp,
    "First Contentful Paint",
    "Time until first content appears"
  );
  
  const si = createMetricData(
    "si",
    metrics?.si,
    "Speed Index",
    "How quickly content is visually displayed"
  );
  
  const ttfb = createMetricData(
    "ttfb",
    metrics?.ttfb,
    "Time to First Byte",
    "Server response time"
  );

  const tti = createMetricData(
    "tti",
    metrics?.tti,
    "Time to Interactive",
    "Time until the page is fully interactive"
  );

  const coreMetrics = [lcp, cls, tbt].filter((m): m is MetricData => m !== null);
  const passingCount = coreMetrics.filter(m => m.status === "good").length;
  const failingCount = coreMetrics.filter(m => m.status !== "good").length;
  
  const recommendations = generatePerformanceRecommendations(lcp, cls, tbt);
  
  const diag = report.details?.fundamentals?.diagnostics;
  const diagnosticSummaries: DiagnosticSummary[] = [];
  
  if (diag?.totalByteWeight) {
    const mb = diag.totalByteWeight / 1024 / 1024;
    diagnosticSummaries.push({
      label: "Total Page Weight",
      value: mb >= 1 ? `${mb.toFixed(1)} MB` : `${(diag.totalByteWeight / 1024).toFixed(0)} KB`,
      status: mb > 3 ? "poor" : mb > 1.5 ? "needs-improvement" : "good",
    });
  }
  
  if (diag?.mainThreadTotalTime) {
    const sec = diag.mainThreadTotalTime / 1000;
    diagnosticSummaries.push({
      label: "Main Thread Work",
      value: `${sec.toFixed(1)}s`,
      status: sec > 4 ? "poor" : sec > 2 ? "needs-improvement" : "good",
    });
  }
  
  if (diag?.thirdPartyTotalBlockingTime !== undefined && diag.thirdPartyTotalBlockingTime > 0) {
    diagnosticSummaries.push({
      label: "3rd Party Blocking",
      value: `${diag.thirdPartyTotalBlockingTime}ms`,
      status: diag.thirdPartyTotalBlockingTime > 250 ? "poor" : diag.thirdPartyTotalBlockingTime > 150 ? "needs-improvement" : "good",
    });
  }
  
  if (diag?.networkTotalRequests) {
    diagnosticSummaries.push({
      label: "Network Requests",
      value: `${diag.networkTotalRequests}`,
      status: diag.networkTotalRequests > 100 ? "poor" : diag.networkTotalRequests > 50 ? "needs-improvement" : "good",
    });
  }
  
  const coreWebVitals: CoreWebVitalsData = {
    lcp,
    cls,
    tbt,
    fcp,
    si,
    ttfb,
    tti,
    passingCount,
    failingCount,
    recommendations,
    diagnosticSummaries: diagnosticSummaries.length > 0 ? diagnosticSummaries : undefined,
  };

  if (score < 50) {
    tips.push("Consider using a Content Delivery Network (CDN) to serve your content faster worldwide.");
    tips.push("Compress and resize images before uploading them to your website.");
  } else if (score < 80) {
    tips.push("Enable browser caching so returning visitors load your site faster.");
  }

  return {
    category: "performance",
    categoryLabel: "Performance",
    categoryDescription: "How fast your website loads and responds. Fast sites keep visitors happy and rank better in Google.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.performance,
    weightExplanation: "Performance accounts for 25% of your overall score because speed directly impacts visitor satisfaction and search rankings.",
    baseScore: 100,
    deductions: [],
    bonuses: [],
    tips,

    coreWebVitals,
  };
}

function generateSeoBreakdown(report: AuditReport): ScoreBreakdown {
  const seo = report.details?.seo;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 100;

  if (!seo) {
    return createEmptyBreakdown("seo", "SEO", "Search Engine Optimization - how well search engines can find and understand your website.", SCORE_WEIGHTS.seo);
  }

  if (!seo.meta.title) {
    deductions.push({
      points: 15,
      reason: "Missing page title",
      explanation: "Your page has no title tag. This is like a book without a cover - search engines and visitors don't know what your page is about.",
      howToFix: "Add a <title> tag in your page's HTML head section. Make it descriptive and include your main keyword.",
    });
    score -= 15;
  } else if (!seo.meta.titleLengthOk) {
    deductions.push({
      points: 5,
      reason: `Title length not optimal (${seo.meta.titleLength} characters)`,
      explanation: seo.meta.titleLength < 30 
        ? "Your title is too short. You're missing an opportunity to describe your page and include keywords."
        : "Your title is too long and will be cut off in search results, hiding important information.",
      howToFix: "Aim for 50-60 characters. Put the most important words first.",
    });
    score -= 5;
  } else {
    bonuses.push({
      points: 5,
      reason: "Well-optimized title tag",
      explanation: "Your page title is the right length and will display properly in search results.",
    });
  }

  if (!seo.meta.description) {
    deductions.push({
      points: 10,
      reason: "Missing meta description",
      explanation: "No description tells search engines what your page is about. Google may show random text from your page instead.",
      howToFix: "Add a meta description tag with 150-160 characters describing your page content.",
    });
    score -= 10;
  } else if (!seo.meta.descriptionLengthOk) {
    deductions.push({
      points: 3,
      reason: `Description length not optimal (${seo.meta.descriptionLength} characters)`,
      explanation: seo.meta.descriptionLength < 120
        ? "Your description is too short to fully explain what your page offers."
        : "Your description will be cut off in search results.",
      howToFix: "Aim for 150-160 characters with a clear call-to-action.",
    });
    score -= 3;
  }

  if (seo.headings.h1Count === 0) {
    deductions.push({
      points: 10,
      reason: "No main heading (H1) found",
      explanation: "Every page needs one main heading. It tells visitors and search engines what the page is about.",
      howToFix: "Add one H1 heading at the top of your content with your main topic or keyword.",
    });
    score -= 10;
  } else if (seo.headings.h1Count > 1) {
    deductions.push({
      points: 5,
      reason: `Multiple main headings found (${seo.headings.h1Count})`,
      explanation: "Having multiple H1 headings confuses search engines about what your page is mainly about.",
      howToFix: "Keep only one H1 heading. Change others to H2 or H3.",
    });
    score -= 5;
  }

  if (!seo.headings.structureOk) {
    deductions.push({
      points: 5,
      reason: "Heading hierarchy issues",
      explanation: "Your headings skip levels (like going from H1 to H3). This makes your content harder to navigate.",
      howToFix: "Use headings in order: H1, then H2, then H3. Don't skip levels.",
    });
    score -= 5;
  }

  if (seo.content.isThinContent) {
    deductions.push({
      points: 10,
      reason: `Low word count (${seo.content.wordCount} words)`,
      explanation: "Your page has very little text. Search engines prefer pages with substantial, helpful content.",
      howToFix: "Add more valuable content. Aim for at least 300-500 words on important pages.",
    });
    score -= 10;
  }

  if (seo.images.missingAlt > 0) {
    const penalty = Math.min(10, seo.images.missingAlt * 2);
    deductions.push({
      points: penalty,
      reason: `${seo.images.missingAlt} images missing descriptions`,
      explanation: "Images without alt text can't be understood by search engines or screen readers used by visually impaired visitors.",
      howToFix: "Add descriptive alt text to each image explaining what it shows.",
    });
    score -= penalty;
  }

  if (seo.links.broken.length > 0) {
    const penalty = Math.min(15, seo.links.broken.length * 3);
    deductions.push({
      points: penalty,
      reason: `${seo.links.broken.length} broken links found`,
      explanation: "Broken links frustrate visitors and make your site look unmaintained. Search engines may lower your ranking.",
      howToFix: "Fix or remove the broken links. Use a link checker tool regularly.",
    });
    score -= penalty;
  }

  if (!seo.sitemap.exists) {
    deductions.push({
      points: 5,
      reason: "No sitemap found",
      explanation: "A sitemap helps search engines find all your pages. Without one, some pages might not get indexed.",
      howToFix: "Create an XML sitemap and submit it to Google Search Console.",
    });
    score -= 5;
  } else {
    bonuses.push({
      points: 5,
      reason: "Sitemap present",
      explanation: "Your sitemap helps search engines discover and index your pages efficiently.",
    });
  }

  if (!seo.robots.exists) {
    deductions.push({
      points: 3,
      reason: "No robots.txt file",
      explanation: "This file tells search engines which pages to crawl. Without it, you have less control over indexing.",
      howToFix: "Create a robots.txt file in your website's root directory.",
    });
    score -= 3;
  }

  if (seo.content.spellingErrors && seo.content.spellingErrors.length > 0) {
    tips.push(`We found ${seo.content.spellingErrors.length} potential spelling errors. Proofread your content to maintain professionalism.`);
  }

  score = Math.max(0, Math.min(100, score));
  return {
    category: "seo",
    categoryLabel: "SEO",
    categoryDescription: "Search Engine Optimization - how easily people can find your website through Google and other search engines.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.seo,
    weightExplanation: "SEO accounts for 20% of your overall score because being found in search results is crucial for getting visitors.",
    baseScore: 100,
    deductions,
    bonuses,
    tips,

  };
}

function generateAccessibilityBreakdown(report: AuditReport): ScoreBreakdown {
  const score = report.details?.fundamentals?.scores?.accessibility || 0;
  const accessibility = report.details?.accessibility;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];

  if (accessibility?.levelA?.failed && accessibility.levelA.failed > 0) {
    deductions.push({
      points: accessibility.levelA.failed * 5,
      reason: `${accessibility.levelA.failed} basic accessibility issues`,
      explanation: "These are fundamental problems that prevent some people from using your website at all, including those using screen readers.",
      howToFix: "Address these issues first: " + (accessibility.levelA.violations?.slice(0, 3).join(", ") || "Check accessibility audit details."),
    });
  }

  if (accessibility?.levelAA?.failed && accessibility.levelAA.failed > 0) {
    deductions.push({
      points: accessibility.levelAA.failed * 3,
      reason: `${accessibility.levelAA.failed} intermediate accessibility issues`,
      explanation: "These issues make your site harder to use for people with disabilities.",
      howToFix: "Common fixes include improving color contrast and adding proper form labels.",
    });
  }

  if (score >= 90) {
    bonuses.push({
      points: 10,
      reason: "Excellent accessibility",
      explanation: "Your site is usable by people with various disabilities, including those using screen readers.",
    });
  }

  tips.push("Test your site using a screen reader to experience how visually impaired users navigate it.");
  tips.push("Ensure all interactive elements can be used with keyboard only (no mouse required).");

  return {
    category: "accessibility",
    categoryLabel: "Accessibility",
    categoryDescription: "How usable your website is for people with disabilities, including visual, hearing, and motor impairments.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.accessibility,
    weightExplanation: "Accessibility accounts for 15% because an accessible site reaches more people and may be legally required.",
    baseScore: 100,
    deductions,
    bonuses,
    tips,

  };
}

function generateSecurityBreakdown(report: AuditReport): ScoreBreakdown {
  const security = report.details?.tech?.security;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 0;

  if (!security) {
    return createEmptyBreakdown("security", "Security", "How well your website protects visitor data and privacy.", SCORE_WEIGHTS.security);
  }

  if (security.isHTTPS) {
    bonuses.push({
      points: 40,
      reason: "HTTPS encryption enabled",
      explanation: "Your site uses secure encryption. Visitors see a padlock icon and their data is protected.",
    });
    score += 40;
  } else {
    deductions.push({
      points: 40,
      reason: "No HTTPS encryption",
      explanation: "Your site is not secure. Browsers show warnings, visitors don't trust it, and Google ranks it lower.",
      howToFix: "Install an SSL certificate. Many hosts offer free certificates through Let's Encrypt.",
    });
  }

  if (security.hasHSTS) {
    bonuses.push({
      points: 10,
      reason: "HSTS enabled",
      explanation: "Your site forces secure connections, preventing certain types of attacks.",
    });
    score += 10;
  }

  if (!security.mixedContent) {
    bonuses.push({
      points: 10,
      reason: "No mixed content",
      explanation: "All your page resources load securely.",
    });
    score += 10;
  } else {
    deductions.push({
      points: 10,
      reason: "Mixed content detected",
      explanation: "Some images or scripts load over insecure HTTP, which can trigger browser warnings.",
      howToFix: "Update all resource URLs to use https:// instead of http://",
    });
  }

  const presentHeaders = security.securityHeaders?.filter((h) => h.present).length || 0;
  const missingHeaders = security.securityHeaders?.filter((h) => !h.present) || [];
  
  if (presentHeaders > 0) {
    bonuses.push({
      points: Math.min(20, presentHeaders * 4),
      reason: `${presentHeaders} security headers configured`,
      explanation: "Security headers help protect against common web attacks.",
    });
    score += Math.min(20, presentHeaders * 4);
  }

  if (missingHeaders.length > 0) {
    tips.push(`Consider adding these security headers: ${missingHeaders.slice(0, 3).map(h => h.name).join(", ")}`);
  }

  if (security.gdprCompliance?.hasPrivacyPolicy) {
    bonuses.push({
      points: 10,
      reason: "Privacy policy present",
      explanation: "You have a privacy policy, which is required by law in most regions.",
    });
    score += 10;
  } else {
    deductions.push({
      points: 10,
      reason: "No privacy policy found",
      explanation: "A privacy policy is legally required if you collect any user data (including through analytics).",
      howToFix: "Add a privacy policy page explaining what data you collect and how you use it.",
    });
  }

  if (security.gdprCompliance?.hasCookieBanner) {
    bonuses.push({
      points: 10,
      reason: "Cookie consent present",
      explanation: "You ask visitors for consent before setting cookies, as required by privacy laws.",
    });
    score += 10;
  }

  score = Math.min(100, score);
  return {
    category: "security",
    categoryLabel: "Security",
    categoryDescription: "How well your website protects visitors and their data from threats and privacy violations.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.security,
    weightExplanation: "Security accounts for 15% because it affects visitor trust and is required for handling sensitive data.",
    baseScore: 0,
    deductions,
    bonuses,
    tips,

  };
}

function generateSocialBreakdown(report: AuditReport): ScoreBreakdown {
  const social = report.details?.social;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 0;

  if (!social) {
    return createEmptyBreakdown("social", "Social Media", "How well your content appears when shared on social media platforms.", SCORE_WEIGHTS.social);
  }

  if (social.openGraph.hasTitle) {
    bonuses.push({
      points: 15,
      reason: "Social sharing title set",
      explanation: "When someone shares your page on Facebook or LinkedIn, it shows a proper title.",
    });
    score += 15;
  } else {
    deductions.push({
      points: 15,
      reason: "No social sharing title",
      explanation: "Without this, shared links may show incorrect or missing titles on social media.",
      howToFix: "Add an og:title meta tag with an engaging title for social shares.",
    });
  }

  if (social.openGraph.hasDescription) {
    bonuses.push({
      points: 15,
      reason: "Social sharing description set",
      explanation: "Shared links show a compelling description that encourages clicks.",
    });
    score += 15;
  } else {
    deductions.push({
      points: 15,
      reason: "No social sharing description",
      explanation: "Shared links won't have a description, making them less appealing to click.",
      howToFix: "Add an og:description meta tag with a compelling summary.",
    });
  }

  if (social.openGraph.hasImage) {
    bonuses.push({
      points: 20,
      reason: "Social sharing image set",
      explanation: "Your shared links show an eye-catching image, which dramatically increases engagement.",
    });
    score += 20;
  } else {
    deductions.push({
      points: 20,
      reason: "No social sharing image",
      explanation: "Posts without images get far fewer clicks. This is the most important social tag.",
      howToFix: "Add an og:image meta tag with a 1200x630 pixel image.",
    });
  }

  if (social.twitter.hasCard) {
    bonuses.push({
      points: 15,
      reason: "Twitter Card configured",
      explanation: "Your links display beautifully when shared on Twitter/X.",
    });
    score += 15;
  } else {
    tips.push("Add Twitter Card meta tags to improve how your links appear on Twitter/X.");
  }

  const profileCount = Object.keys(social.profiles).length;
  if (profileCount > 0) {
    bonuses.push({
      points: Math.min(35, profileCount * 7),
      reason: `${profileCount} social profiles linked`,
      explanation: `You're connected to ${profileCount} social platform${profileCount > 1 ? 's' : ''}, helping visitors find and follow you.`,
    });
    score += Math.min(35, profileCount * 7);
  } else {
    tips.push("Add links to your social media profiles to help visitors connect with you.");
  }

  score = Math.min(100, score);
  return {
    category: "social",
    categoryLabel: "Social Media",
    categoryDescription: "How well your content appears and performs when shared on social media platforms like Facebook, Twitter, and LinkedIn.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.social,
    weightExplanation: "Social accounts for 10% because social sharing can significantly increase your reach and traffic.",
    baseScore: 0,
    deductions,
    bonuses,
    tips,

  };
}

function generateLocalPresenceBreakdown(report: AuditReport): ScoreBreakdown {
  const localPresence = report.details?.localPresence;
  const local = report.details?.local;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 0;

  if (!localPresence && !local) {
    return createEmptyBreakdown("localPresence", "Local Presence", "How well your business appears in local searches and directories.", SCORE_WEIGHTS.localPresence);
  }

  if (localPresence) {
    if (localPresence.googleBusinessProfile?.exists) {
      bonuses.push({
        points: 25,
        reason: "Google Business Profile linked",
        explanation: "Your Google Business listing is connected, helping you appear in local searches and Google Maps.",
      });
      score += 25;
    } else {
      deductions.push({
        points: 25,
        reason: "No Google Business Profile found",
        explanation: "You're missing the most important local listing. This is free and crucial for appearing in local searches.",
        howToFix: "Claim your business at business.google.com and link to it from your website.",
      });
    }

    if (localPresence.googleMaps?.listed) {
      bonuses.push({
        points: 15,
        reason: "Google Maps presence",
        explanation: "Visitors can find your location on Google Maps.",
      });
      score += 15;
    }

    if (localPresence.napConsistency?.consistent) {
      bonuses.push({
        points: 20,
        reason: "Consistent business information",
        explanation: "Your name, address, and phone number are consistent across your site.",
      });
      score += 20;
    } else if (localPresence.napConsistency && !localPresence.napConsistency.consistent) {
      deductions.push({
        points: 20,
        reason: "Inconsistent business information",
        explanation: "Your business name, address, or phone number varies across your site, which confuses search engines.",
        howToFix: "Ensure your NAP (Name, Address, Phone) is exactly the same everywhere it appears.",
      });
    }

    const listedDirs = localPresence.directories?.filter((d) => d.listed).length || 0;
    if (listedDirs > 0) {
      bonuses.push({
        points: Math.min(20, listedDirs * 4),
        reason: `Listed in ${listedDirs} directories`,
        explanation: "You're listed in business directories, which helps with local SEO.",
      });
      score += Math.min(20, listedDirs * 4);
    } else {
      tips.push("Get listed on Yelp, Yellow Pages, and other directories to improve local visibility.");
    }

    if (localPresence.phones?.length > 0) {
      bonuses.push({
        points: 10,
        reason: "Phone number displayed",
        explanation: "Visitors can easily find your phone number to contact you.",
      });
      score += 10;
    }

    if (localPresence.addresses?.length > 0) {
      bonuses.push({
        points: 10,
        reason: "Address displayed",
        explanation: "Your physical location is visible, building trust with local customers.",
      });
      score += 10;
    }
  } else if (local) {
    if (local.phones.length > 0) {
      bonuses.push({ points: 30, reason: "Phone number found", explanation: "Contact information is available." });
      score += 30;
    }
    if (local.addresses.length > 0) {
      bonuses.push({ points: 40, reason: "Address found", explanation: "Physical location is displayed." });
      score += 40;
    }
  }

  score = Math.min(100, score);
  return {
    category: "localPresence",
    categoryLabel: "Local Presence",
    categoryDescription: "How visible your business is in local searches, maps, and business directories.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.localPresence,
    weightExplanation: "Local Presence accounts for 5% and is especially important for businesses serving local customers.",
    baseScore: 0,
    deductions,
    bonuses,
    tips,

  };
}

function generateReviewsBreakdown(report: AuditReport): ScoreBreakdown {
  const reviews = report.details?.reviews;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 0;

  if (!reviews) {
    return createEmptyBreakdown("reviews", "Reviews & Reputation", "How well you showcase customer reviews and testimonials.", SCORE_WEIGHTS.reviews);
  }

  const platformsLinked = reviews.platforms?.filter((p) => p.url !== null).length || 0;
  if (platformsLinked > 0) {
    bonuses.push({
      points: Math.min(40, platformsLinked * 10),
      reason: `${platformsLinked} review platform${platformsLinked > 1 ? 's' : ''} linked`,
      explanation: "You're connected to review platforms where customers can leave feedback.",
    });
    score += Math.min(40, platformsLinked * 10);
  } else {
    deductions.push({
      points: 40,
      reason: "No review platforms linked",
      explanation: "Visitors can't easily find or leave reviews, which reduces trust.",
      howToFix: "Add links to your Google, Yelp, or Facebook review pages.",
    });
  }

  if (reviews.websiteShowsReviews) {
    bonuses.push({
      points: 25,
      reason: "Reviews displayed on site",
      explanation: "Showing reviews builds trust and can increase conversions by up to 270%.",
    });
    score += 25;
  } else {
    tips.push("Display customer reviews or testimonials on your website to build trust.");
  }

  if (reviews.testimonialPage) {
    bonuses.push({
      points: 15,
      reason: "Testimonials page found",
      explanation: "You have a dedicated page for customer testimonials.",
    });
    score += 15;
  }

  if (reviews.overall?.averageRating > 0) {
    bonuses.push({
      points: Math.min(20, reviews.overall.averageRating * 4),
      reason: `${reviews.overall.averageRating.toFixed(1)} star average rating`,
      explanation: `Your reviews show a ${reviews.overall.averageRating.toFixed(1)}/5 rating.`,
    });
    score += Math.min(20, reviews.overall.averageRating * 4);
  }

  tips.push("Encourage satisfied customers to leave reviews - 88% of people trust online reviews as much as personal recommendations.");

  score = Math.min(100, score);
  return {
    category: "reviews",
    categoryLabel: "Reviews & Reputation",
    categoryDescription: "How well you collect and display customer reviews and testimonials to build trust.",
    score,
    maxScore: 100,
    weight: SCORE_WEIGHTS.reviews,
    weightExplanation: "Reviews account for 5% because social proof significantly influences buying decisions.",
    baseScore: 0,
    deductions,
    bonuses,
    tips,

  };
}

function createEmptyBreakdown(
  category: string,
  label: string,
  description: string,
  weight: number
): ScoreBreakdown {
  return {
    category,
    categoryLabel: label,
    categoryDescription: description,
    score: 0,
    maxScore: 100,
    weight,
    weightExplanation: `This category accounts for ${Math.round(weight * 100)}% of your overall score.`,
    baseScore: 0,
    deductions: [],
    bonuses: [],
    tips: ["No data available for this category."],
  };
}

// ============================================
// NEW 5-CATEGORY SCORING SYSTEM
// ============================================

import type {
  NewAuditScores,
  ScoreBreakdowns,
  AuditFacts,
  SiteFacts,
  SpeedFacts,
  ContentFacts,
  PresenceFacts,
  AuditSuggestions,
  Suggestion,
  ScoreCategory,
} from "@sitelens/shared/types";

// New weights for 5-category system
const NEW_SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  performance: 0.25, // Speed & Performance
  visibility: 0.25, // Findability (SEO + Local)
  security: 0.20, // Safety & Privacy
  accessibility: 0.15, // Ease of Use
  trust: 0.15, // Credibility (Social + Reviews)
};

/**
 * Calculate new 5-category scores from legacy report data
 */
export function calculateNewScores(report: AuditReport): NewAuditScores {
  const performance = report.details?.fundamentals?.scores?.performance || 0;
  const accessibility = report.details?.fundamentals?.scores?.accessibility || 0;

  // Visibility = SEO (70%) + Local Presence (30%)
  const seoScore = calculateSeoScore(report);
  const localScore = calculateLocalPresenceScore(report);
  const visibility = Math.round(seoScore * 0.7 + localScore * 0.3);

  // Security score
  const security = calculateSecurityScore(report);

  // Trust = Social (40%) + Reviews (60%)
  const socialScore = calculateSocialScore(report);
  const reviewsScore = calculateReviewsScore(report);
  const trust = Math.round(socialScore * 0.4 + reviewsScore * 0.6);

  // Calculate weighted overall
  const overall = Math.round(
    performance * NEW_SCORE_WEIGHTS.performance +
      visibility * NEW_SCORE_WEIGHTS.visibility +
      security * NEW_SCORE_WEIGHTS.security +
      accessibility * NEW_SCORE_WEIGHTS.accessibility +
      trust * NEW_SCORE_WEIGHTS.trust
  );

  return {
    overall,
    performance,
    visibility,
    security,
    accessibility,
    trust,
  };
}

/**
 * Generate score breakdowns for the new 5-category system
 */
export function generateNewScoreBreakdowns(report: AuditReport): ScoreBreakdowns {
  return {
    performance: generatePerformanceBreakdown(report),
    visibility: generateVisibilityBreakdown(report),
    security: generateSecurityBreakdown(report),
    accessibility: generateAccessibilityBreakdown(report),
    trust: generateTrustBreakdown(report),
  };
}

/**
 * Generate visibility breakdown (SEO + Local combined)
 */
function generateVisibilityBreakdown(report: AuditReport): ScoreBreakdown {
  const seo = report.details?.seo;
  const local = report.details?.localPresence;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 100;

  if (!seo && !local) {
    return createEmptyBreakdown(
      "visibility",
      "Findability",
      "How easily people can find your website through search engines and local directories.",
      NEW_SCORE_WEIGHTS.visibility
    );
  }

  // SEO factors (70% of visibility)
  if (seo) {
    if (!seo.meta.title) {
      deductions.push({
        points: 15,
        reason: "Missing page title",
        explanation:
          "Your page has no title. Search engines and visitors don't know what your page is about.",
        howToFix: "Add a descriptive title tag with your main keyword.",
      });
      score -= 15;
    } else if (!seo.meta.titleLengthOk) {
      deductions.push({
        points: 5,
        reason: "Title length not optimal",
        explanation:
          seo.meta.titleLength < 30
            ? "Your title is too short to describe your page well."
            : "Your title is too long and will be cut off in search results.",
        howToFix: "Aim for 50-60 characters.",
      });
      score -= 5;
    }

    if (!seo.meta.description) {
      deductions.push({
        points: 10,
        reason: "Missing meta description",
        explanation: "No description helps search engines understand your page.",
        howToFix: "Add a 150-160 character meta description.",
      });
      score -= 10;
    }

    if (seo.headings.h1Count === 0) {
      deductions.push({
        points: 10,
        reason: "No main heading",
        explanation: "Every page needs one main H1 heading.",
        howToFix: "Add an H1 heading with your main topic.",
      });
      score -= 10;
    } else if (seo.headings.h1Count > 1) {
      deductions.push({
        points: 5,
        reason: `Multiple H1 headings (${seo.headings.h1Count})`,
        explanation: "Having multiple H1s confuses search engines.",
        howToFix: "Keep only one H1, change others to H2 or H3.",
      });
      score -= 5;
    }

    if (seo.content.isThinContent) {
      deductions.push({
        points: 10,
        reason: `Low word count (${seo.content.wordCount} words)`,
        explanation: "Search engines prefer pages with substantial content.",
        howToFix: "Add more valuable content (300-500+ words).",
      });
      score -= 10;
    }

    if (seo.links.broken.length > 0) {
      const penalty = Math.min(15, seo.links.broken.length * 3);
      deductions.push({
        points: penalty,
        reason: `${seo.links.broken.length} broken links`,
        explanation: "Broken links hurt user experience and SEO.",
        howToFix: "Fix or remove broken links.",
      });
      score -= penalty;
    }

    if (seo.sitemap.exists) {
      bonuses.push({
        points: 5,
        reason: "Sitemap present",
        explanation: "Your sitemap helps search engines find all your pages.",
      });
    } else {
      score -= 5;
    }
  }

  // Local presence factors (30% of visibility)
  if (local) {
    if (local.googleBusinessProfile?.exists) {
      bonuses.push({
        points: 10,
        reason: "Google Business Profile",
        explanation: "You appear in local searches and Google Maps.",
      });
    } else {
      deductions.push({
        points: 10,
        reason: "No Google Business Profile",
        explanation: "You're missing the most important local listing.",
        howToFix: "Claim your business at business.google.com",
      });
      score -= 10;
    }

    if (local.phones.length > 0 || local.addresses.length > 0) {
      bonuses.push({
        points: 5,
        reason: "Contact info visible",
        explanation: "Visitors can easily find how to reach you.",
      });
    }
  }

  score = Math.max(0, Math.min(100, score));
  return {
    category: "visibility",
    categoryLabel: "Findability",
    categoryDescription:
      "How easily people can find your website through search engines and local directories.",
    score,
    maxScore: 100,
    weight: NEW_SCORE_WEIGHTS.visibility,
    weightExplanation:
      "Findability accounts for 25% because being discovered is crucial for getting visitors.",
    baseScore: 100,
    deductions,
    bonuses,
    tips,

  };
}

/**
 * Generate trust breakdown (Social + Reviews combined)
 */
function generateTrustBreakdown(report: AuditReport): ScoreBreakdown {
  const social = report.details?.social;
  const reviews = report.details?.reviews;
  const deductions: ScoreDeduction[] = [];
  const bonuses: ScoreBonus[] = [];
  const tips: string[] = [];
  let score = 0;

  if (!social && !reviews) {
    return createEmptyBreakdown(
      "trust",
      "Credibility",
      "How trustworthy your website appears through social proof and customer reviews.",
      NEW_SCORE_WEIGHTS.trust
    );
  }

  // Social factors (40% of trust)
  if (social) {
    if (social.openGraph.hasTitle) {
      bonuses.push({
        points: 6,
        reason: "Social sharing title set",
        explanation: "Shared links show a proper title on social media.",
      });
      score += 6;
    }

    if (social.openGraph.hasDescription) {
      bonuses.push({
        points: 6,
        reason: "Social sharing description set",
        explanation: "Shared links have a compelling description.",
      });
      score += 6;
    }

    if (social.openGraph.hasImage) {
      bonuses.push({
        points: 8,
        reason: "Social sharing image set",
        explanation: "Shared links show an eye-catching image.",
      });
      score += 8;
    }

    const profileCount = Object.keys(social.profiles).length;
    if (profileCount > 0) {
      const profilePoints = Math.min(20, profileCount * 4);
      bonuses.push({
        points: profilePoints,
        reason: `${profileCount} social profiles linked`,
        explanation: "Visitors can find and follow you on social media.",
      });
      score += profilePoints;
    }
  }

  // Reviews factors (60% of trust)
  if (reviews) {
    const platformsLinked =
      reviews.platforms?.filter((p) => p.url !== null).length || 0;
    if (platformsLinked > 0) {
      const reviewPoints = Math.min(24, platformsLinked * 8);
      bonuses.push({
        points: reviewPoints,
        reason: `${platformsLinked} review platforms linked`,
        explanation: "Customers can find and leave reviews.",
      });
      score += reviewPoints;
    }

    if (reviews.websiteShowsReviews) {
      bonuses.push({
        points: 15,
        reason: "Reviews displayed on site",
        explanation: "Showing reviews builds trust with visitors.",
      });
      score += 15;
    }

    if (reviews.overall?.averageRating > 0) {
      const ratingPoints = Math.min(12, reviews.overall.averageRating * 2.4);
      bonuses.push({
        points: Math.round(ratingPoints),
        reason: `${reviews.overall.averageRating.toFixed(1)}★ average rating`,
        explanation: "Good ratings boost credibility.",
      });
      score += Math.round(ratingPoints);
    }
  }

  if (score < 50) {
    tips.push(
      "Add links to your review profiles to make it easy for customers to leave feedback."
    );
    tips.push(
      "Display testimonials on your website - 88% of people trust reviews as much as personal recommendations."
    );
  }

  score = Math.min(100, score);
  return {
    category: "trust",
    categoryLabel: "Credibility",
    categoryDescription:
      "How trustworthy your website appears through social proof and customer reviews.",
    score,
    maxScore: 100,
    weight: NEW_SCORE_WEIGHTS.trust,
    weightExplanation:
      "Credibility accounts for 15% because trust signals influence visitor decisions.",
    baseScore: 0,
    deductions,
    bonuses,
    tips,

  };
}

// ============================================
// FACTS EXTRACTION
// ============================================

/**
 * Extract clean facts from legacy report data
 */
export function extractFacts(report: AuditReport, url: string): AuditFacts {
  return {
    site: extractSiteFacts(report, url),
    speed: extractSpeedFacts(report),
    content: extractContentFacts(report),
    presence: extractPresenceFacts(report),
  };
}

function extractSiteFacts(report: AuditReport, url: string): SiteFacts {
  const tech = report.details?.tech;
  const security = tech?.security;
  const analytics = tech?.analytics;
  const advertising = report.details?.advertising;
  const ecommerce = report.details?.ecommerce;

  return {
    url,
    cms: tech?.cms,
    server: tech?.server,
    isHTTPS: security?.isHTTPS || false,
    hasHSTS: security?.hasHSTS || false,
    mixedContent: security?.mixedContent || false,
    technologies: tech?.technologies || [],
    cdns: tech?.cdns || [],
    securityHeaders: security?.securityHeaders || [],
    gdprCompliance: {
      hasPrivacyPolicy: security?.gdprCompliance?.hasPrivacyPolicy || false,
      hasCookieBanner: security?.gdprCompliance?.hasCookieBanner || false,
      hasCookiePolicy: security?.gdprCompliance?.hasCookiePolicy || false,
    },
    analytics: {
      googleAnalytics: analytics?.googleAnalytics || false,
      googleAnalytics4: analytics?.googleAnalytics4 || false,
      googleTagManager: analytics?.googleTagManager || false,
      facebookPixel: analytics?.facebookPixel || false,
      hotjar: analytics?.hotjar || false,
      otherTrackers: analytics?.otherTrackers || [],
    },
    advertising: {
      googleAds: advertising?.paidSearch?.googleAds || false,
      bingAds: advertising?.paidSearch?.bingAds || false,
      facebookAds: advertising?.socialAds?.facebookAds || false,
      linkedinAds: advertising?.socialAds?.linkedinAds || false,
      retargeting: advertising?.retargeting?.otherPixels || [],
    },
    ecommerce: {
      detected: ecommerce?.hasEcommerce || false,
      platform: ecommerce?.platform?.name || undefined,
      paymentProcessors:
        ecommerce?.paymentProcessors?.map((p) => p.name) || [],
      hasCart: ecommerce?.cartFunctionality || false,
      hasProductSchema: ecommerce?.productSchema || false,
    },
  };
}

function extractSpeedFacts(report: AuditReport): SpeedFacts {
  const fundamentals = report.details?.fundamentals;
  const metrics = fundamentals?.metrics;
  const mobile = fundamentals?.mobile;

  return {
    lcp: metrics?.lcp,
    cls: metrics?.cls,
    fcp: metrics?.fcp,
    tbt: metrics?.tbt,
    ttfb: metrics?.ttfb,
    si: metrics?.si,
    tti: metrics?.tti,
    lighthouseScore: fundamentals?.scores?.performance,
    mobile: {
      isMobileFriendly: mobile?.isMobileFriendly || false,
      viewportConfigured: mobile?.viewportConfigured || false,
      fontSizeOk: mobile?.fontSizeOk || false,
      tapTargetsOk: mobile?.tapTargetsOk || false,
    },
    opportunities: fundamentals?.opportunities || [],
    diagnostics: fundamentals?.diagnostics,
  };
}

function extractContentFacts(report: AuditReport): ContentFacts {
  const seo = report.details?.seo;
  const meta = seo?.meta;
  const headings = seo?.headings;
  const content = seo?.content;
  const images = seo?.images;
  const links = seo?.links;

  return {
    title: meta?.title || null,
    titleLength: meta?.titleLength || 0,
    description: meta?.description || null,
    descriptionLength: meta?.descriptionLength || 0,
    canonical: meta?.canonical || null,
    language: meta?.language || null,
    h1Count: headings?.h1Count || 0,
    headingStructure: headings?.structure || [],
    wordCount: content?.wordCount || 0,
    readingEase: content?.readingEase || 0,
    readingLevel: content?.readingLevel || 0,
    paragraphCount: content?.paragraphCount || 0,
    avgSentenceLength: content?.avgSentenceLength || 0,
    images: {
      total: images?.total || 0,
      missingAlt: images?.missingAlt || 0,
      list:
        images?.images?.map((img) => ({ src: img.src, alt: img.alt })) || [],
      oversized: images?.oversizedImages || [],
    },
    links: {
      internal: links?.internal?.length || 0,
      external: links?.external?.length || 0,
      broken: links?.broken || [],
      nofollow: links?.nofollow?.length || 0,
    },
    sitemap: {
      exists: seo?.sitemap?.exists || false,
      url: seo?.sitemap?.url || null,
      urlCount: seo?.sitemap?.urlCount,
    },
    robots: {
      exists: seo?.robots?.exists || false,
      allowsIndexing: seo?.robots?.allowsIndexing || false,
      sitemapUrls: seo?.robots?.sitemapUrls || [],
    },
    structuredData:
      seo?.structuredData?.map((sd) => ({
        type: sd.type,
        isValid: sd.isValid,
      })) || [],
    spellingErrors: content?.spellingErrors || [],
  };
}

function extractPresenceFacts(report: AuditReport): PresenceFacts {
  const local = report.details?.localPresence || report.details?.local;
  const social = report.details?.social;
  const reviews = report.details?.reviews;
  const localPresence = report.details?.localPresence;

  return {
    businessName: localPresence?.businessName || null,
    phones: localPresence?.phones || (local as { phones?: string[] })?.phones || [],
    addresses: localPresence?.addresses || (local as { addresses?: string[] })?.addresses || [],
    emails: localPresence?.emails || (local as { emails?: string[] })?.emails || [],
    googleBusiness: {
      exists: localPresence?.googleBusinessProfile?.exists || false,
      url: localPresence?.googleBusinessProfile?.url || null,
      verified: localPresence?.googleBusinessProfile?.verified,
      rating: localPresence?.googleBusinessProfile?.rating,
      reviewCount: localPresence?.googleBusinessProfile?.reviewCount,
      category: localPresence?.googleBusinessProfile?.category,
    },
    googleMaps: {
      listed: localPresence?.googleMaps?.listed || false,
    },
    directories:
      localPresence?.directories?.map((d) => ({
        name: d.name,
        listed: d.listed,
        url: d.url,
      })) || [],
    napConsistency: {
      name: {
        value: localPresence?.napConsistency?.name?.value || null,
        variations: localPresence?.napConsistency?.name?.variations || [],
      },
      address: {
        value: localPresence?.napConsistency?.address?.value || null,
        variations: localPresence?.napConsistency?.address?.variations || [],
      },
      phone: {
        value: localPresence?.napConsistency?.phone?.value || null,
        variations: localPresence?.napConsistency?.phone?.variations || [],
      },
    },
    openGraph: social?.openGraph?.data || {
      title: null,
      description: null,
      image: null,
      url: null,
      type: null,
      siteName: null,
    },
    twitterCard: social?.twitter?.data || {
      card: null,
      title: null,
      description: null,
      image: null,
      site: null,
    },
    socialProfiles: social?.profiles || {},
    reviews: {
      averageRating: reviews?.overall?.averageRating || 0,
      totalCount: reviews?.overall?.totalReviews || 0,
      recentCount: reviews?.overall?.recentReviews || 0,
      platforms:
        reviews?.platforms?.map((p) => ({
          name: p.name,
          url: p.url,
          rating: p.rating,
          count: p.reviewCount,
        })) || [],
    },
    websiteShowsReviews: reviews?.websiteShowsReviews || false,
    testimonialPage: reviews?.testimonialPage || null,
  };
}

// ============================================
// SUGGESTIONS GENERATION
// ============================================

/**
 * Generate categorized suggestions from report data
 */
export function generateNewSuggestions(
  report: AuditReport,
  scores: NewAuditScores
): AuditSuggestions {
  const suggestions: Suggestion[] = [];

  // Performance suggestions
  if (scores.performance < 50) {
    suggestions.push({
      id: "perf-critical",
      title: "Improve page load speed",
      description:
        "Your site loads slowly. Focus on optimizing images, reducing JavaScript, and enabling caching.",
      category: "performance",
      impact: "high",
      effort: "high",
      scoreImprovement: [{ category: "performance", points: 20 }],
      relatedFact: "speed.lcp",
      howToFix:
        "Compress images, enable browser caching, and minify CSS/JavaScript files.",
    });
  }

  // Visibility suggestions
  const seo = report.details?.seo;
  if (seo?.images?.missingAlt && seo.images.missingAlt > 0) {
    suggestions.push({
      id: "seo-alt-text",
      title: "Add descriptions to images",
      description: `${seo.images.missingAlt} images are missing alt text. This helps search engines and screen readers.`,
      category: "visibility",
      impact: "high",
      effort: "low",
      scoreImprovement: [
        { category: "visibility", points: 5 },
        { category: "accessibility", points: 3 },
      ],
      relatedFact: "content.images.missingAlt",
      howToFix: "Add descriptive alt text to each image explaining what it shows.",
    });
  }

  if (!seo?.meta?.title) {
    suggestions.push({
      id: "seo-title",
      title: "Add a page title",
      description:
        "Your page has no title tag. This is essential for search engines and visitors.",
      category: "visibility",
      impact: "high",
      effort: "low",
      scoreImprovement: [{ category: "visibility", points: 15 }],
      relatedFact: "content.title",
      howToFix: "Add a descriptive title with 50-60 characters including your main keyword.",
    });
  }

  if (!seo?.sitemap?.exists) {
    suggestions.push({
      id: "seo-sitemap",
      title: "Create an XML sitemap",
      description:
        "A sitemap helps search engines find and index all your pages.",
      category: "visibility",
      impact: "medium",
      effort: "low",
      scoreImprovement: [{ category: "visibility", points: 5 }],
      relatedFact: "content.sitemap",
      howToFix: "Generate an XML sitemap and submit it to Google Search Console.",
    });
  }

  // Security suggestions
  const security = report.details?.tech?.security;
  if (!security?.isHTTPS) {
    suggestions.push({
      id: "sec-https",
      title: "Enable HTTPS encryption",
      description:
        "Your site is not secure. Visitors see warnings and Google ranks it lower.",
      category: "security",
      impact: "high",
      effort: "medium",
      scoreImprovement: [{ category: "security", points: 40 }],
      relatedFact: "site.isHTTPS",
      howToFix: "Install an SSL certificate. Many hosts offer free certificates.",
    });
  }

  if (!security?.gdprCompliance?.hasPrivacyPolicy) {
    suggestions.push({
      id: "sec-privacy",
      title: "Add a privacy policy",
      description:
        "A privacy policy is legally required if you collect any user data.",
      category: "security",
      impact: "high",
      effort: "medium",
      scoreImprovement: [{ category: "security", points: 10 }],
      relatedFact: "site.gdprCompliance.hasPrivacyPolicy",
      howToFix: "Add a privacy policy page explaining what data you collect.",
    });
  }

  // Trust suggestions
  const social = report.details?.social;
  if (!social?.openGraph?.hasImage) {
    suggestions.push({
      id: "trust-og-image",
      title: "Add a social sharing image",
      description:
        "Posts without images get far fewer clicks on social media.",
      category: "trust",
      impact: "high",
      effort: "low",
      scoreImprovement: [{ category: "trust", points: 8 }],
      relatedFact: "presence.openGraph.image",
      howToFix: "Add an og:image meta tag with a 1200x630 pixel image.",
    });
  }

  const reviews = report.details?.reviews;
  if (!reviews?.websiteShowsReviews) {
    suggestions.push({
      id: "trust-reviews",
      title: "Display customer reviews",
      description:
        "Showing reviews builds trust and can increase conversions significantly.",
      category: "trust",
      impact: "medium",
      effort: "medium",
      scoreImprovement: [{ category: "trust", points: 15 }],
      relatedFact: "presence.websiteShowsReviews",
      howToFix: "Add a testimonials section or embed reviews from Google/Yelp.",
    });
  }

  // Categorize suggestions
  const quickWins = suggestions.filter(
    (s) => s.impact === "high" && s.effort === "low"
  );
  const priorityFixes = suggestions.filter(
    (s) => s.impact === "high" && s.effort !== "low"
  );
  const niceToHave = suggestions.filter((s) => s.impact !== "high");

  return {
    quickWins,
    priorityFixes,
    niceToHave,
  };
}
