declare module 'pdf-parse/lib/pdf-parse.js' {
  import type { Buffer } from 'buffer';

  function pdfParse(data: Buffer): Promise<{ text: string; numpages?: number; info?: unknown }>;
  export default pdfParse;
}
