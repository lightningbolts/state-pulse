const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type EmbedPipeline = (
  text: string | string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

let extractorPromise: Promise<EmbedPipeline> | null = null;

async function getExtractor(): Promise<EmbedPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('feature-extraction', EMBEDDING_MODEL) as Promise<EmbedPipeline>;
    })();
  }
  return extractorPromise;
}

export async function embedLegislationText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const extractor = await getExtractor();
    const out = await extractor(trimmed, { pooling: 'mean', normalize: true });
    return Array.from(out.data);
  } catch (error) {
    console.error('Failed to embed text server-side:', error);
    return null;
  }
}

export function getEmbeddingModelName(): string {
  return EMBEDDING_MODEL;
}
