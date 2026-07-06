'use client';

import { useCallback, useState } from 'react';

export type ModelState = 'idle' | 'loading' | 'ready' | 'error';

type FeaturePipeline = Awaited<
  ReturnType<typeof import('@huggingface/transformers')['pipeline']>
>;

let extractorPromise: Promise<FeaturePipeline> | null = null;

async function getExtractor(): Promise<FeaturePipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    })();
  }
  return extractorPromise;
}

export function useSemanticSearch() {
  const [modelState, setModelState] = useState<ModelState>('idle');

  const embedQuery = useCallback(async (text: string): Promise<Float32Array | null> => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
      setModelState('loading');
      const extractor = await getExtractor();
      const out = await extractor(trimmed, { pooling: 'mean', normalize: true });
      setModelState('ready');
      return out.data as Float32Array;
    } catch (error) {
      console.error('Failed to embed query:', error);
      setModelState('error');
      return null;
    }
  }, []);

  const warmModel = useCallback(async () => {
    try {
      setModelState('loading');
      await getExtractor();
      setModelState('ready');
    } catch {
      setModelState('error');
    }
  }, []);

  return { embedQuery, warmModel, modelState };
}
