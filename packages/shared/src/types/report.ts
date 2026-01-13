// Severity levels for issues
export type IssueSeverity = "critical" | "warning" | "info" | "success";

// Base issue type with recommendations
export interface AuditIssue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: string;
  recommendation?: string;
  learnMoreUrl?: string;
  impact?: string;
  effort?: "low" | "medium" | "high";
}

// ============================================
// SCORES
// ============================================

export interface AuditScores {
  overall: number; // Weighted average
  performance: number;
  seo: number;
  social: number;
  accessibility: number;
  localPresence: number;
  reviews: number;
  advertising: number;
  ecommerce: number;
  security: number;
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  weight: number;
  issues: AuditIssue[];
}

export interface ScoreDeduction {
  points: number;
  reason: string;
  explanation: string;
  howToFix?: string;
  learnMoreUrl?: string;
}

export interface ScoreBonus {
  points: number;
  reason: string;
  explanation: string;
}

export interface ScoreBreakdown {
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  score: number;
  maxScore: number;
  weight: number;
  weightExplanation: string;
  baseScore: number;
  deductions: ScoreDeduction[];
  bonuses: ScoreBonus[];
  tips: string[];
  grade: "A" | "B" | "C" | "D" | "F";
  gradeExplanation: string;
}

export interface DetailedScores {
  overall: number;
  overallExplanation: string;
  breakdown: ScoreBreakdown[];
}

// ============================================
// PERFORMANCE / FUNDAMENTALS
// ============================================

export interface PerformanceMetrics {
  tti?: number; // Time to Interactive (ms)
  lcp?: number; // Largest Contentful Paint (ms)
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint (ms)
  si?: number; // Speed Index
  tbt?: number; // Total Blocking Time (ms)
  ttfb?: number; // Time to First Byte (ms)
}

export interface SpeedOpportunity {
  id: string;
  title: string;
  description: string;
  savings: number; // Estimated savings in ms
  details?: string;
}

export interface FundamentalsData {
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: PerformanceMetrics;
  mobile: {
    isMobileFriendly: boolean;
    viewportConfigured: boolean;
    fontSizeOk: boolean;
    tapTargetsOk: boolean;
  };
  opportunities: SpeedOpportunity[];
  issues: AuditIssue[];
}

// ============================================
// SEO
// ============================================

export interface MetaData {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  titleLength: number;
  descriptionLength: number;
  titleLengthOk: boolean;
  descriptionLengthOk: boolean;
  hasHreflang: boolean;
  language: string | null;
}

export interface HeadingData {
  h1Count: number;
  structure: Array<{ level: number; text: string }>;
  structureOk: boolean;
  issues: string[];
}

export interface ContentData {
  wordCount: number;
  isThinContent: boolean;
  readingLevel: number; // Flesch-Kincaid grade level
  readingEase: number; // Flesch Reading Ease score (0-100)
  readingEaseLabel: string; // "Easy", "Standard", "Difficult"
  spellingErrors: SpellingError[];
  paragraphCount: number;
  avgSentenceLength: number;
}

export interface SpellingError {
  word: string;
  suggestions: string[];
  context: string;
  pageUrl?: string;
}

export interface ImageData {
  total: number;
  missingAlt: number;
  images: Array<{ src: string; alt: string | null; hasMissingAlt: boolean }>;
  oversizedImages: Array<{ src: string; size: number; suggestedSize: number }>;
  unoptimizedCount: number;
}

export interface LinkData {
  internal: string[];
  external: string[];
  broken: BrokenLink[];
  total: number;
  nofollow: string[];
}

export interface BrokenLink {
  url: string;
  statusCode: number;
  statusText: string;
  foundOn: string;
  anchorText?: string;
}

export interface KeywordData {
  targetKeywords: string[];
  rankings: KeywordRanking[];
  opportunities: KeywordOpportunity[];
}

export interface KeywordRanking {
  keyword: string;
  position: number | null;
  searchVolume?: number;
  difficulty?: number;
}

export interface KeywordOpportunity {
  keyword: string;
  currentPosition: number | null;
  searchVolume: number;
  reason: string;
}

export interface SeoData {
  meta: MetaData;
  headings: HeadingData;
  content: ContentData;
  images: ImageData;
  links: LinkData;
  keywords?: KeywordData;
  structuredData: StructuredDataInfo[];
  sitemap: SitemapInfo;
  robots: RobotsInfo;
  issues: AuditIssue[];
}

export interface StructuredDataInfo {
  type: string;
  isValid: boolean;
  errors?: string[];
}

export interface SitemapInfo {
  exists: boolean;
  url: string | null;
  urlCount?: number;
  lastModified?: string;
  issues: string[];
}

export interface RobotsInfo {
  exists: boolean;
  content: string | null;
  allowsIndexing: boolean;
  sitemapUrls: string[];
  issues: string[];
}

// ============================================
// SOCIAL
// ============================================

export interface OpenGraphData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
  siteName: string | null;
}

export interface TwitterCardData {
  card: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
}

export interface SocialProfile {
  platform: string;
  url: string;
  handle?: string;
  verified?: boolean;
  followers?: number;
  lastPost?: string;
}

export interface SocialProfiles {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
  pinterest?: string;
  yelp?: string;
}

export interface SocialData {
  openGraph: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasImage: boolean;
    isComplete: boolean;
    data: OpenGraphData;
    imageValid?: boolean;
    imageDimensions?: { width: number; height: number };
  };
  twitter: {
    hasCard: boolean;
    data: TwitterCardData;
  };
  profiles: SocialProfiles;
  profileDetails: SocialProfile[];
  issues: AuditIssue[];
}

// ============================================
// LOCAL PRESENCE
// ============================================

export interface LocalPresenceData {
  businessName: string | null;
  googleBusinessProfile: {
    exists: boolean;
    url: string | null;
    verified: boolean;
    complete: boolean;
    category?: string;
    rating?: number;
    reviewCount?: number;
    photos?: number;
    issues: string[];
  };
  googleMaps: {
    listed: boolean;
    accurate: boolean;
    issues: string[];
  };
  bingPlaces: {
    listed: boolean;
    accurate: boolean;
    issues: string[];
  };
  appleBusinessConnect: {
    listed: boolean;
    issues: string[];
  };
  directories: DirectoryListing[];
  napConsistency: {
    consistent: boolean;
    name: NapConsistencyItem;
    address: NapConsistencyItem;
    phone: NapConsistencyItem;
    issues: string[];
  };
  phones: string[];
  addresses: string[];
  emails: string[];
  issues: AuditIssue[];
}

export interface DirectoryListing {
  name: string;
  url: string | null;
  listed: boolean;
  accurate: boolean;
  issues: string[];
}

export interface NapConsistencyItem {
  value: string | null;
  variations: string[];
  isConsistent: boolean;
}

// ============================================
// REVIEWS & REPUTATION
// ============================================

export interface ReviewsData {
  overall: {
    averageRating: number;
    totalReviews: number;
    recentReviews: number; // Last 30 days
  };
  platforms: ReviewPlatform[];
  websiteShowsReviews: boolean;
  testimonialPage: string | null;
  sentimentAnalysis?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  issues: AuditIssue[];
}

export interface ReviewPlatform {
  name: string;
  url: string | null;
  rating: number | null;
  reviewCount: number;
  lastReviewDate?: string;
}

// ============================================
// ADVERTISING
// ============================================

export interface AdvertisingData {
  paidSearch: {
    googleAds: boolean;
    bingAds: boolean;
    detected: boolean;
    issues: string[];
  };
  socialAds: {
    facebookAds: boolean;
    instagramAds: boolean;
    linkedinAds: boolean;
    twitterAds: boolean;
    detected: boolean;
  };
  retargeting: {
    googleRemarketing: boolean;
    facebookPixel: boolean;
    otherPixels: string[];
    detected: boolean;
  };
  displayAds: {
    googleDisplayNetwork: boolean;
    otherNetworks: string[];
    detected: boolean;
  };
  issues: AuditIssue[];
}

// ============================================
// ECOMMERCE
// ============================================

export interface EcommerceData {
  hasEcommerce: boolean;
  platform: {
    name: string | null;
    detected: boolean;
    version?: string;
  };
  paymentProcessors: PaymentProcessor[];
  cartFunctionality: boolean;
  sslOnCheckout: boolean;
  productSchema: boolean;
  issues: AuditIssue[];
}

export interface PaymentProcessor {
  name: string;
  detected: boolean;
  secure: boolean;
}

// ============================================
// SECURITY
// ============================================

export interface SecurityData {
  isHTTPS: boolean;
  hasHSTS: boolean;
  protocol?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  mixedContent: boolean;
  securityHeaders: SecurityHeader[];
  gdprCompliance: {
    hasPrivacyPolicy: boolean;
    hasCookieBanner: boolean;
    hasCookiePolicy: boolean;
    issues: string[];
  };
  issues: AuditIssue[];
}

export interface SecurityHeader {
  name: string;
  present: boolean;
  value?: string;
  recommendation?: string;
}

// ============================================
// ACCESSIBILITY
// ============================================

export interface AccessibilityData {
  score: number;
  wcagLevel: "A" | "AA" | "AAA" | "None";
  violations: AccessibilityViolation[];
  levelA: AccessibilityLevelSummary;
  levelAA: AccessibilityLevelSummary;
  levelAAA: AccessibilityLevelSummary;
  issues: AuditIssue[];
}

export interface AccessibilityViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  helpUrl: string;
  wcagLevel: "A" | "AA" | "AAA";
  nodes: number;
  recommendation: string;
}

export interface AccessibilityLevelSummary {
  passed: number;
  failed: number;
  violations: string[];
}

// ============================================
// TECHNOLOGY
// ============================================

export interface AnalyticsData {
  googleAnalytics: boolean;
  googleAnalytics4: boolean;
  googleTagManager: boolean;
  facebookPixel: boolean;
  hotjar: boolean;
  mixpanel: boolean;
  segment: boolean;
  otherTrackers: string[];
}

export interface TechData {
  security: SecurityData;
  analytics: AnalyticsData;
  advertising: AdvertisingData;
  technologies: TechnologyItem[];
  cms?: string;
  framework?: string;
  server?: string;
  cdns: string[];
  issues: AuditIssue[];
}

export interface TechnologyItem {
  name: string;
  category: string;
  version?: string;
  confidence: number;
}

// ============================================
// LOCAL DATA (legacy, merged into LocalPresence)
// ============================================

export interface LocalData {
  phones: string[];
  addresses: string[];
  emails: string[];
}

// ============================================
// SCREENSHOTS (Legacy - base64 encoded)
// ============================================

export interface Screenshots {
  mobile: string;
  desktop: string;
}

// ============================================
// NEW ARCHITECTURE: Facts / Scores / Suggestions
// ============================================

// Score category type for the new 5-category system
export type ScoreCategory =
  | "performance"
  | "visibility"
  | "security"
  | "accessibility"
  | "trust";

// ============================================
// FACTS - Raw scanner findings (no judgment)
// ============================================

export interface SiteFacts {
  url: string;
  cms?: string;
  server?: string;
  isHTTPS: boolean;
  hasHSTS: boolean;
  mixedContent: boolean;
  technologies: TechnologyItem[];
  cdns: string[];
  securityHeaders: SecurityHeader[];
  gdprCompliance: {
    hasPrivacyPolicy: boolean;
    hasCookieBanner: boolean;
    hasCookiePolicy: boolean;
  };
  analytics: {
    googleAnalytics: boolean;
    googleAnalytics4: boolean;
    googleTagManager: boolean;
    facebookPixel: boolean;
    hotjar: boolean;
    otherTrackers: string[];
  };
  advertising: {
    googleAds: boolean;
    bingAds: boolean;
    facebookAds: boolean;
    linkedinAds: boolean;
    retargeting: string[];
  };
  ecommerce: {
    detected: boolean;
    platform?: string;
    paymentProcessors: string[];
    hasCart: boolean;
    hasProductSchema: boolean;
  };
}

export interface SpeedFacts {
  lcp?: number; // Largest Contentful Paint (ms)
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint (ms)
  tbt?: number; // Total Blocking Time (ms)
  ttfb?: number; // Time to First Byte (ms)
  si?: number; // Speed Index
  tti?: number; // Time to Interactive (ms)
  lighthouseScore?: number; // Raw Lighthouse performance score
  mobile: {
    isMobileFriendly: boolean;
    viewportConfigured: boolean;
    fontSizeOk: boolean;
    tapTargetsOk: boolean;
  };
  opportunities: SpeedOpportunity[];
}

export interface ContentFacts {
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  canonical: string | null;
  language: string | null;
  h1Count: number;
  headingStructure: Array<{ level: number; text: string }>;
  wordCount: number;
  readingEase: number;
  readingLevel: number;
  paragraphCount: number;
  avgSentenceLength: number;
  images: {
    total: number;
    missingAlt: number;
    list: Array<{ src: string; alt: string | null }>;
    oversized: Array<{ src: string; size: number; suggestedSize: number }>;
  };
  links: {
    internal: number;
    external: number;
    broken: BrokenLink[];
    nofollow: number;
  };
  sitemap: {
    exists: boolean;
    url: string | null;
    urlCount?: number;
  };
  robots: {
    exists: boolean;
    allowsIndexing: boolean;
    sitemapUrls: string[];
  };
  structuredData: Array<{ type: string; isValid: boolean }>;
  spellingErrors: SpellingError[];
}

export interface PresenceFacts {
  // Local Business Info
  businessName: string | null;
  phones: string[];
  addresses: string[];
  emails: string[];
  googleBusiness: {
    exists: boolean;
    url: string | null;
    verified?: boolean;
    rating?: number;
    reviewCount?: number;
    category?: string;
  };
  googleMaps: {
    listed: boolean;
  };
  directories: Array<{
    name: string;
    listed: boolean;
    url: string | null;
  }>;
  napConsistency: {
    name: { value: string | null; variations: string[] };
    address: { value: string | null; variations: string[] };
    phone: { value: string | null; variations: string[] };
  };

  // Social Media
  openGraph: OpenGraphData;
  twitterCard: TwitterCardData;
  socialProfiles: SocialProfiles;

  // Reviews
  reviews: {
    averageRating: number;
    totalCount: number;
    recentCount: number; // Last 30 days
    platforms: Array<{
      name: string;
      url: string | null;
      rating: number | null;
      count: number;
    }>;
  };
  websiteShowsReviews: boolean;
  testimonialPage: string | null;
}

export interface AuditFacts {
  site: SiteFacts;
  speed: SpeedFacts;
  content: ContentFacts;
  presence: PresenceFacts;
}

// ============================================
// ASSET REFERENCES (paths, not blobs)
// ============================================

// Screenshot metadata
export interface ScreenshotInfo {
  name: string;
  width: number;
  height: number;
  path: string;
}

export interface AssetReferences {
  screenshots: ScreenshotInfo[];
}

// ============================================
// NEW SCORES - 5 category system
// ============================================

export interface NewAuditScores {
  overall: number;
  performance: number; // Speed & Performance (25%)
  visibility: number; // Findability - SEO + Local (25%)
  security: number; // Safety & Privacy (20%)
  accessibility: number; // Ease of Use (15%)
  trust: number; // Credibility - Social + Reviews (15%)
}

export interface ScoreBreakdowns {
  performance: ScoreBreakdown;
  visibility: ScoreBreakdown;
  security: ScoreBreakdown;
  accessibility: ScoreBreakdown;
  trust: ScoreBreakdown;
}

// ============================================
// SUGGESTIONS - Prioritized recommendations
// ============================================

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: ScoreCategory;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  scoreImprovement?: Array<{ category: ScoreCategory; points: number }>;
  relatedFact?: string; // Key path in facts, e.g., "content.images.missingAlt"
  howToFix?: string;
}

export interface AuditSuggestions {
  quickWins: Suggestion[]; // High impact + low effort
  priorityFixes: Suggestion[]; // High impact + any effort
  niceToHave: Suggestion[]; // Medium/low impact
}

// ============================================
// NEW AUDIT RESULT - Clean separation
// ============================================

export interface NewAuditResult {
  id: string;
  url: string;
  status: AuditStatus;
  createdAt: string;
  completedAt?: string;
  error?: string;

  // Separated concerns
  scores: NewAuditScores;
  scoreBreakdowns: ScoreBreakdowns;
  facts: AuditFacts;
  suggestions: AuditSuggestions;

  // Asset references (paths, not blobs)
  assets: AssetReferences;
}

// ============================================
// MAIN REPORT
// ============================================

export type AuditStatus = "pending" | "running" | "completed" | "failed";

export interface AuditReport {
  id: string;
  url: string;
  status: AuditStatus;
  progress?: number;
  currentStep?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  screenshots?: Screenshots;
  scores?: AuditScores;
  summary?: ReportSummary;
  details?: {
    fundamentals: FundamentalsData;
    seo: SeoData;
    social: SocialData;
    tech: TechData;
    local: LocalData; // Legacy
    localPresence?: LocalPresenceData;
    reviews?: ReviewsData;
    advertising?: AdvertisingData;
    ecommerce?: EcommerceData;
    accessibility?: AccessibilityData;
  };
}

export interface ReportSummary {
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  topIssues: AuditIssue[];
  strengths: string[];
  improvements: ImprovementSuggestion[];
  detailedScores?: DetailedScores;
}

export interface ImprovementSuggestion {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  priority: number;
}

// ============================================
// SCANNER TYPES
// ============================================

export interface ScannerContext {
  url: string;
  html: string;
  browserPort: number;
  onProgress?: (message: string) => void;
}

export interface Scanner<T = unknown> {
  id: string;
  name: string;
  description?: string;
  run(context: ScannerContext): Promise<T>;
}

export interface AuditConfig {
  url: string;
  output?: string;
  format?: ("json" | "html" | "pdf")[];
  device?: "mobile" | "desktop" | "both";
  timeout?: number;
  deep?: boolean;
  checkBrokenLinks?: boolean;
  checkSpelling?: boolean;
  scanners?: {
    lighthouse?: boolean;
    seo?: boolean;
    social?: boolean;
    tech?: boolean;
    local?: boolean;
    localPresence?: boolean;
    reviews?: boolean;
    advertising?: boolean;
    ecommerce?: boolean;
    accessibility?: boolean;
  };
}
