import type { HttpClient } from '@/types/voteRecord';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'StatePulse/1.0 (+https://statepulse.org; legislative data aggregator)',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FetchHttpClient implements HttpClient {
  constructor(
    private readonly maxRetries = 3,
    private readonly timeoutMs = 30000
  ) {}

  async get(url: string, options: RequestInit = {}): Promise<string> {
    const buffer = await this.fetchWithRetry(url, options);
    return buffer.toString('utf-8');
  }

  async getBuffer(url: string, options: RequestInit = {}): Promise<Buffer> {
    return this.fetchWithRetry(url, options);
  }

  async post(url: string, body: string, options: RequestInit = {}): Promise<string> {
    const buffer = await this.fetchWithRetry(url, {
      ...options,
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(options.headers as Record<string, string>),
      },
    });
    return buffer.toString('utf-8');
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Buffer> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'User-Agent': randomUserAgent(),
            Accept: 'text/html,application/json,*/*',
            ...(options.headers as Record<string, string>),
          },
        });
        clearTimeout(timer);
        if (response.status === 429) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        lastError = error;
        await sleep(500 * (attempt + 1));
      }
    }
    throw lastError;
  }
}

export class MockHttpClient implements HttpClient {
  constructor(private readonly responses: Map<string, string>) {}

  async get(url: string): Promise<string> {
    const body = this.responses.get(url);
    if (body === undefined) {
      throw new Error(`No mock response for ${url}`);
    }
    return body;
  }

  async getBuffer(url: string): Promise<Buffer> {
    return Buffer.from(await this.get(url));
  }
}

export class SimpleRateLimiter {
  constructor(private readonly minDelayMs = 500) {}

  private lastCall = 0;

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed + Math.random() * 200);
    }
    this.lastCall = Date.now();
  }
}
