interface FacebookPixelParams {
  value?: number;
  currency?: string;
  content_name?: string;
  content_type?: string;
  contents?: Array<{ id: string; quantity: number }>;
  [key: string]: unknown;
}

interface FacebookPixel {
  (command: "init", pixelId: string): void;
  (command: "track", event: string, params?: FacebookPixelParams, options?: { eventID?: string }): void;
  (command: "trackCustom", event: string, params?: FacebookPixelParams): void;
  (command: "set", ...args: unknown[]): void;
  queue?: unknown[];
  callMethod?: (...args: unknown[]) => void;
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
}

declare global {
  interface Window {
    fbq: FacebookPixel;
    _fbq: FacebookPixel;
  }
}

export {};
