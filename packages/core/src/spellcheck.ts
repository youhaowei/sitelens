import type { SpellingError } from "@sitelens/shared/types";

const IGNORE_WORDS = new Set([
  "api", "url", "urls", "html", "css", "javascript", "js", "json", "xml", "php", "sql", "http", "https", "www",
  "npm", "cdn", "cli", "gui", "svg", "png", "jpg", "jpeg", "gif", "pdf", "ai", "ui", "ux", "ios", "android",
  "seo", "saas", "crm", "cms", "erp", "roi", "cta", "faq", "faqs", "ebook", "ebooks", "ecommerce", "blockchain",
  "cryptocurrency", "bitcoin", "ethereum", "wifi", "webinar", "podcast", "podcasts", "linkedin", "facebook",
  "twitter", "instagram", "youtube", "tiktok", "pinterest", "whatsapp", "gmail", "google", "microsoft", "apple",
  "amazon", "wordpress", "shopify", "wix", "squarespace", "hubspot", "salesforce", "mailchimp", "stripe", "paypal",
  "venmo", "uber", "airbnb", "netflix", "spotify", "zoom", "slack", "trello", "asana", "figma", "canva",
  "inc", "llc", "ltd", "corp", "co", "vs", "etc", "eg", "ie", "dr", "mr", "mrs", "ms", "jr", "sr", "st", "ave",
  "blvd", "rd", "ct", "fl", "ca", "ny", "tx", "usa", "uk",
  "1st", "2nd", "3rd", "4th", "5th", "10x", "24x7", "247", "kb", "mb", "gb", "tb", "px", "em", "rem",
]);

const COMMON_MISSPELLINGS: Record<string, string[]> = {
  accomodate: ["accommodate"], acheive: ["achieve"], accross: ["across"], agressive: ["aggressive"],
  apparant: ["apparent"], arguement: ["argument"], begining: ["beginning"], beleive: ["believe"],
  buisness: ["business"], calender: ["calendar"], catagory: ["category"], commited: ["committed"],
  concious: ["conscious"], definately: ["definitely"], dissapoint: ["disappoint"], embarass: ["embarrass"],
  enviroment: ["environment"], existance: ["existence"], foriegn: ["foreign"], fourty: ["forty"],
  goverment: ["government"], grammer: ["grammar"], guarentee: ["guarantee"], harrass: ["harass"],
  immediatly: ["immediately"], independant: ["independent"], knowlege: ["knowledge"], liason: ["liaison"],
  maintainance: ["maintenance"], millenium: ["millennium"], neccessary: ["necessary"], noticable: ["noticeable"],
  occassion: ["occasion"], occured: ["occurred"], occurence: ["occurrence"], persistant: ["persistent"],
  posession: ["possession"], prefered: ["preferred"], priviledge: ["privilege"], publically: ["publicly"],
  recieve: ["receive"], recomend: ["recommend"], refered: ["referred"], relevent: ["relevant"],
  seperate: ["separate"], sieze: ["seize"], sucessful: ["successful"], supercede: ["supersede"],
  suprise: ["surprise"], thier: ["their"], tommorow: ["tomorrow"], truely: ["truly"], untill: ["until"],
  wierd: ["weird"], writting: ["writing"],
  cancle: ["cancel"], submitt: ["submit"], dowload: ["download"], upgrage: ["upgrade"], subscibe: ["subscribe"],
  unsubscibe: ["unsubscribe"], contant: ["contact", "content"], serach: ["search"], prodcut: ["product"],
  shoping: ["shopping"], checkut: ["checkout"], acount: ["account"], pasword: ["password"],
  registeration: ["registration"], avaliable: ["available"], availble: ["available"],
};

const VALID_WORD_PATTERN = /^[a-z]+$/i;
const MIN_WORD_LENGTH = 4;
const MAX_SUGGESTIONS = 3;

export class SpellChecker {
  private ignoreWords: Set<string>;
  private customDictionary: Set<string>;

  constructor(customWords: string[] = []) {
    this.ignoreWords = new Set([...IGNORE_WORDS, ...customWords.map((w) => w.toLowerCase())]);
    this.customDictionary = new Set();
  }

  addToCustomDictionary(words: string[]): void {
    for (const word of words) {
      this.customDictionary.add(word.toLowerCase());
    }
  }

  checkText(text: string, pageUrl?: string): SpellingError[] {
    const errors: SpellingError[] = [];
    const words = this.extractWords(text);

    for (const { word, context } of words) {
      const lowerWord = word.toLowerCase();

      if (this.ignoreWords.has(lowerWord)) continue;
      if (this.customDictionary.has(lowerWord)) continue;

      const suggestions = COMMON_MISSPELLINGS[lowerWord];
      if (suggestions) {
        errors.push({ word, suggestions: suggestions.slice(0, MAX_SUGGESTIONS), context, pageUrl });
        continue;
      }

      const suspiciousResult = this.checkSuspiciousPatterns(word);
      if (suspiciousResult) {
        errors.push({ word, suggestions: suspiciousResult.suggestions, context, pageUrl });
      }
    }

    return errors;
  }

  private extractWords(text: string): Array<{ word: string; context: string }> {
    const results: Array<{ word: string; context: string }> = [];

    const cleanedText = text
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\{[^}]+\}/g, "")
      .replace(/[0-9]+/g, " ");

    const sentences = cleanedText.split(/[.!?]+/).filter(Boolean);

    for (const sentence of sentences) {
      const words = sentence.match(/\b[a-zA-Z]+\b/g) || [];

      for (const word of words) {
        if (word.length < MIN_WORD_LENGTH) continue;
        if (!VALID_WORD_PATTERN.test(word)) continue;

        const contextStart = Math.max(0, sentence.indexOf(word) - 30);
        const contextEnd = Math.min(sentence.length, sentence.indexOf(word) + word.length + 30);
        const context = sentence.slice(contextStart, contextEnd).trim();

        results.push({ word, context });
      }
    }

    return results;
  }

  private checkSuspiciousPatterns(word: string): { suggestions: string[] } | null {
    const lowerWord = word.toLowerCase();

    if (/(.)\1\1/.test(lowerWord)) {
      const fixed = lowerWord.replace(/(.)\1\1/g, "$1$1");
      return { suggestions: [fixed] };
    }

    if (lowerWord.startsWith("unnecc")) {
      return { suggestions: ["unnecessary"] };
    }
    if (lowerWord.startsWith("dissapp")) {
      return { suggestions: ["disappoint", "disappear"] };
    }

    return null;
  }

  extractTextFromHtml(html: string): string {
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

    text = text.replace(/<[^>]+>/g, " ");

    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-z]+;/gi, " ");

    text = text.replace(/\s+/g, " ").trim();

    return text;
  }
}

export function checkSpelling(
  html: string,
  options: { customWords?: string[]; pageUrl?: string } = {}
): SpellingError[] {
  const checker = new SpellChecker(options.customWords);
  const text = checker.extractTextFromHtml(html);
  return checker.checkText(text, options.pageUrl);
}
