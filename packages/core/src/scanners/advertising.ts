import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type { AdvertisingData, AuditIssue } from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

export class AdvertisingScanner implements Scanner<AdvertisingData> {
  id = "advertising";
  name = "Advertising Detection";

  async run(context: ScannerContext): Promise<AdvertisingData> {
    context.onProgress?.("Detecting advertising platforms...");

    const $ = cheerio.load(context.html);
    const html = context.html.toLowerCase();
    const issues: AuditIssue[] = [];

    const paidSearch = this.detectPaidSearch(html, $);
    const socialAds = this.detectSocialAds(html, $);
    const retargeting = this.detectRetargeting(html, $);
    const displayAds = this.detectDisplayAds(html, $);

    if (!retargeting.detected) {
      issues.push(createIssue("no_retargeting"));
    }

    return {
      paidSearch,
      socialAds,
      retargeting,
      displayAds,
      issues,
    };
  }

  private detectPaidSearch(
    html: string,
    $: cheerio.CheerioAPI
  ): AdvertisingData["paidSearch"] {
    const googleAds =
      html.includes("googleads.g.doubleclick.net") ||
      html.includes("google_conversion") ||
      html.includes("google-analytics.com/collect") ||
      html.includes("www.googleadservices.com") ||
      $('script[src*="googleadservices"]').length > 0 ||
      $('script[src*="google_ads"]').length > 0;

    const bingAds =
      html.includes("bat.bing.com") ||
      html.includes("uetag") ||
      $('script[src*="bat.bing.com"]').length > 0;

    const detected = googleAds || bingAds;
    const issues: string[] = [];

    return { googleAds, bingAds, detected, issues };
  }

  private detectSocialAds(
    html: string,
    $: cheerio.CheerioAPI
  ): AdvertisingData["socialAds"] {
    const facebookAds =
      html.includes("facebook.com/tr") ||
      html.includes("connect.facebook.net") ||
      html.includes("fbevents.js") ||
      html.includes("fbq(") ||
      $('script[src*="facebook.net"]').length > 0;

    const instagramAds = facebookAds;

    const linkedinAds =
      html.includes("snap.licdn.com") ||
      html.includes("linkedin.com/px") ||
      html.includes("_linkedin_partner_id") ||
      $('script[src*="snap.licdn.com"]').length > 0;

    const twitterAds =
      html.includes("static.ads-twitter.com") ||
      html.includes("analytics.twitter.com") ||
      html.includes("twq(") ||
      $('script[src*="ads-twitter.com"]').length > 0;

    const detected = facebookAds || linkedinAds || twitterAds;

    return { facebookAds, instagramAds, linkedinAds, twitterAds, detected };
  }

  private detectRetargeting(
    html: string,
    $: cheerio.CheerioAPI
  ): AdvertisingData["retargeting"] {
    const googleRemarketing =
      html.includes("googleads.g.doubleclick.net") ||
      html.includes("google_remarketing_only") ||
      html.includes("www.googleadservices.com/pagead/conversion") ||
      $('script[src*="doubleclick.net"]').length > 0;

    const facebookPixel =
      html.includes("fbq(") ||
      html.includes("facebook.com/tr") ||
      html.includes("fbevents.js") ||
      $('script[src*="connect.facebook.net"]').length > 0;

    const otherPixels: string[] = [];

    if (html.includes("criteo.com") || html.includes("criteo.net")) {
      otherPixels.push("Criteo");
    }
    if (html.includes("adroll.com")) {
      otherPixels.push("AdRoll");
    }
    if (html.includes("taboola.com")) {
      otherPixels.push("Taboola");
    }
    if (html.includes("outbrain.com")) {
      otherPixels.push("Outbrain");
    }
    if (html.includes("pinterest.com/ct.js") || html.includes("pintrk")) {
      otherPixels.push("Pinterest");
    }
    if (html.includes("tiktok.com/i18n") || html.includes("ttq.load")) {
      otherPixels.push("TikTok");
    }
    if (html.includes("quora.com/_lc")) {
      otherPixels.push("Quora");
    }
    if (html.includes("snapchat.com/scevent")) {
      otherPixels.push("Snapchat");
    }

    const detected =
      googleRemarketing || facebookPixel || otherPixels.length > 0;

    return { googleRemarketing, facebookPixel, otherPixels, detected };
  }

  private detectDisplayAds(
    html: string,
    $: cheerio.CheerioAPI
  ): AdvertisingData["displayAds"] {
    const googleDisplayNetwork =
      html.includes("googlesyndication.com") ||
      html.includes("pagead2.googlesyndication.com") ||
      html.includes("adsbygoogle") ||
      $('script[src*="googlesyndication"]').length > 0 ||
      $("ins.adsbygoogle").length > 0;

    const otherNetworks: string[] = [];

    if (html.includes("media.net") || $('script[src*="media.net"]').length > 0) {
      otherNetworks.push("Media.net");
    }
    if (html.includes("amazon-adsystem.com")) {
      otherNetworks.push("Amazon Ads");
    }
    if (html.includes("ads.pubmatic.com")) {
      otherNetworks.push("PubMatic");
    }
    if (html.includes("rubiconproject.com")) {
      otherNetworks.push("Rubicon Project");
    }
    if (html.includes("openx.net")) {
      otherNetworks.push("OpenX");
    }
    if (html.includes("adform.net")) {
      otherNetworks.push("Adform");
    }
    if (html.includes("moatads.com")) {
      otherNetworks.push("Moat");
    }

    const detected = googleDisplayNetwork || otherNetworks.length > 0;

    return { googleDisplayNetwork, otherNetworks, detected };
  }
}
