# Sitelens

Open-source website auditing CLI. Analyze performance, SEO, security, accessibility, and more.

## Installation

```bash
# Coming soon to npm
npx sitelens https://example.com

# Or install globally
npm install -g sitelens
sitelens https://example.com
```

## Usage

```bash
# Basic audit
sitelens https://example.com

# With options
sitelens https://example.com --output ./my-reports --format json,html

# Using the audit subcommand
sitelens audit https://example.com --deep --timeout 120000
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory | `./reports` |
| `-f, --format <formats>` | Output formats (json, html, pdf) | `json` |
| `-d, --device <device>` | Device emulation (mobile, desktop, both) | `both` |
| `--deep` | Enable deep link checking | `false` |
| `--timeout <ms>` | Timeout in milliseconds | `60000` |

## What's Analyzed

### Performance
- Core Web Vitals (LCP, FCP, CLS, TBT)
- Lighthouse performance score
- Speed optimization opportunities

### SEO (Findability)
- Meta tags (title, description)
- Heading structure (H1-H6)
- Image alt text
- Structured data (JSON-LD, Schema.org)
- Sitemap and robots.txt

### Security
- HTTPS status
- Security headers (CSP, HSTS, X-Frame-Options)
- Mixed content detection

### Accessibility
- WCAG compliance checks
- Color contrast
- ARIA attributes
- Keyboard navigation

### Trust & Credibility
- Social media presence
- Open Graph / Twitter Cards
- Contact information
- Review platform links

## Packages

| Package | Description |
|---------|-------------|
| `sitelens` | CLI tool |
| `@sitelens/core` | Audit engine (use programmatically) |
| `@sitelens/shared` | Shared TypeScript types |

### Programmatic Usage

```typescript
import { runAudit, validateConfig } from "@sitelens/core";

const config = validateConfig({
  url: "https://example.com",
  device: "both",
  deep: false,
  timeout: 60000,
});

const result = await runAudit(config, (progress, message) => {
  console.log(`${progress}% - ${message}`);
});

console.log(result.newScores);
console.log(result.facts);
console.log(result.suggestions);
```

## Requirements

- Node.js 18+ or Bun
- Chromium (installed automatically via Playwright)

```bash
# Install Chromium for Lighthouse
npx playwright install chromium
```

## Development

```bash
# Clone
git clone https://github.com/youhaowei/sitelens.git
cd sitelens

# Install dependencies
bun install

# Run CLI locally
bun packages/cli/bin/sitelens.ts https://example.com
```

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT
