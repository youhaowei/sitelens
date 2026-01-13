import * as cheerio from "cheerio";
import type { Scanner, ScannerContext } from "./types";
import type { EcommerceData, PaymentProcessor, AuditIssue } from "@sitelens/shared/types";
import { createIssue } from "../recommendations";

export class EcommerceScanner implements Scanner<EcommerceData> {
  id = "ecommerce";
  name = "E-commerce Detection";

  async run(context: ScannerContext): Promise<EcommerceData> {
    context.onProgress?.("Detecting e-commerce platforms...");

    const $ = cheerio.load(context.html);
    const html = context.html.toLowerCase();
    const issues: AuditIssue[] = [];

    const platform = this.detectPlatform(html, $);
    const paymentProcessors = this.detectPaymentProcessors(html, $);
    const cartFunctionality = this.detectCartFunctionality(html, $);
    const productSchema = this.hasProductSchema($);

    const hasEcommerce =
      platform.detected ||
      paymentProcessors.some((p) => p.detected) ||
      cartFunctionality;

    const isHTTPS = context.url.startsWith("https://");
    if (hasEcommerce && !isHTTPS) {
      issues.push(createIssue("ecommerce_no_ssl"));
    }

    if (hasEcommerce && !productSchema) {
      issues.push(createIssue("no_product_schema"));
    }

    return {
      hasEcommerce,
      platform,
      paymentProcessors,
      cartFunctionality,
      sslOnCheckout: isHTTPS,
      productSchema,
      issues,
    };
  }

  private detectPlatform(
    html: string,
    $: cheerio.CheerioAPI
  ): EcommerceData["platform"] {
    const platforms: Array<{
      name: string;
      patterns: string[];
      selectors?: string[];
    }> = [
      {
        name: "Shopify",
        patterns: ["shopify.com", "cdn.shopify.com", "myshopify.com"],
        selectors: ['link[href*="cdn.shopify.com"]'],
      },
      {
        name: "WooCommerce",
        patterns: ["woocommerce", "wc-cart", "wc-checkout"],
        selectors: ["body.woocommerce", ".woocommerce-cart"],
      },
      {
        name: "Magento",
        patterns: ["mage-cache-sessid", "magento", "/pub/static/version"],
        selectors: ['input[name="form_key"]'],
      },
      {
        name: "BigCommerce",
        patterns: ["bigcommerce.com", "bigcommerce"],
        selectors: ['script[src*="bigcommerce"]'],
      },
      {
        name: "PrestaShop",
        patterns: ["prestashop", "modules/ps_"],
      },
      {
        name: "OpenCart",
        patterns: ["opencart", "catalog/view/theme"],
      },
      {
        name: "Squarespace Commerce",
        patterns: ["squarespace.com"],
        selectors: [".squarespace-commerce"],
      },
      {
        name: "Wix Stores",
        patterns: ["wix.com", "wixstores"],
        selectors: ['script[src*="wixstatic.com"]'],
      },
      {
        name: "Square Online",
        patterns: ["squareup.com", "square.site"],
      },
      {
        name: "Ecwid",
        patterns: ["ecwid.com", "ecwidcdn.com"],
      },
      {
        name: "Volusion",
        patterns: ["volusion.com", "a]VOLESSION"],
      },
      {
        name: "3dcart",
        patterns: ["3dcart.com", "3dcartstores.com"],
      },
    ];

    for (const p of platforms) {
      const patternMatch = p.patterns.some((pattern) => html.includes(pattern));
      const selectorMatch = p.selectors?.some(
        (selector) => $(selector).length > 0
      );

      if (patternMatch || selectorMatch) {
        return {
          name: p.name,
          detected: true,
        };
      }
    }

    return {
      name: null,
      detected: false,
    };
  }

  private detectPaymentProcessors(
    html: string,
    $: cheerio.CheerioAPI
  ): PaymentProcessor[] {
    const processors: PaymentProcessor[] = [];

    const paymentPatterns: Array<{
      name: string;
      patterns: string[];
      selectors?: string[];
    }> = [
      {
        name: "Stripe",
        patterns: ["stripe.com", "js.stripe.com", "stripecdn"],
        selectors: ['script[src*="stripe.com"]'],
      },
      {
        name: "PayPal",
        patterns: ["paypal.com", "paypalobjects.com"],
        selectors: ['script[src*="paypal.com"]', 'a[href*="paypal.com"]'],
      },
      {
        name: "Square",
        patterns: ["squareup.com", "squareupsandbox.com"],
        selectors: ['script[src*="squareup.com"]'],
      },
      {
        name: "Braintree",
        patterns: ["braintreegateway.com", "braintree-api.com"],
        selectors: ['script[src*="braintree"]'],
      },
      {
        name: "Authorize.net",
        patterns: ["authorize.net", "authorizenet"],
      },
      {
        name: "Apple Pay",
        patterns: ["apple-pay", "applepay"],
        selectors: ['meta[name="apple-pay-enabled"]'],
      },
      {
        name: "Google Pay",
        patterns: ["google.com/pay", "googlepay"],
      },
      {
        name: "Klarna",
        patterns: ["klarna.com", "klarnacdn.net"],
      },
      {
        name: "Afterpay",
        patterns: ["afterpay.com", "afterpay-frontend"],
      },
      {
        name: "Affirm",
        patterns: ["affirm.com", "affirm-js"],
      },
      {
        name: "Shop Pay",
        patterns: ["shop.app", "shop-pay"],
      },
      {
        name: "Amazon Pay",
        patterns: ["amazonpay", "amazon-pay", "amazonservices.com"],
      },
    ];

    for (const p of paymentPatterns) {
      const patternMatch = p.patterns.some((pattern) => html.includes(pattern));
      const selectorMatch = p.selectors?.some(
        (selector) => $(selector).length > 0
      );

      const detected = patternMatch || selectorMatch || false;

      processors.push({
        name: p.name,
        detected,
        secure: true,
      });
    }

    return processors.filter((p) => p.detected);
  }

  private detectCartFunctionality(
    html: string,
    $: cheerio.CheerioAPI
  ): boolean {
    const cartIndicators = [
      html.includes("add-to-cart") || html.includes("addtocart"),
      html.includes("shopping-cart") || html.includes("shoppingcart"),
      html.includes("cart-icon") || html.includes("cart_icon"),
      html.includes("checkout") && html.includes("cart"),
      $('[class*="cart"]').length > 0,
      $('[id*="cart"]').length > 0,
      $('a[href*="/cart"]').length > 0,
      $('button[data-add-to-cart]').length > 0,
      $('form[action*="cart"]').length > 0,
    ];

    return cartIndicators.some((indicator) => indicator);
  }

  private hasProductSchema($: cheerio.CheerioAPI): boolean {
    let hasProduct = false;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const parsed = JSON.parse(content);
          const type = parsed["@type"];

          if (
            type === "Product" ||
            (Array.isArray(type) && type.includes("Product"))
          ) {
            hasProduct = true;
          }

          if (parsed["@graph"]) {
            for (const item of parsed["@graph"]) {
              if (item["@type"] === "Product") {
                hasProduct = true;
              }
            }
          }
        }
      } catch {
      }
    });

    return hasProduct;
  }
}
