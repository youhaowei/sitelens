import type { Page } from "playwright";

export interface ScannerContext {
  url: string;
  page: Page;
  html: string;
  browserPort: number;
  onProgress?: (message: string) => void;
}

export interface Scanner<T = unknown> {
  id: string;
  name: string;
  run(context: ScannerContext): Promise<T>;
}
