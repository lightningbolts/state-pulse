import type { Buffer } from 'buffer';

type PdfParseFn = (data: Buffer) => Promise<{ text: string }>;

let pdfParseFn: PdfParseFn | null = null;

/**
 * Lazy-load pdf-parse from its core module to avoid the package entrypoint's
 * debug harness that reads ./test/data/05-versions-space.pdf at import time.
 */
export async function parsePdfBuffer(data: Buffer): Promise<{ text: string }> {
  if (!pdfParseFn) {
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    pdfParseFn = (mod.default ?? mod) as PdfParseFn;
  }
  return pdfParseFn(data);
}
