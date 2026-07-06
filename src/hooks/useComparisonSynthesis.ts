'use client';

import { useCallback, useState } from 'react';
import type { StateComparisonRow } from '@/lib/comparisonScoring';

export type SynthState = 'idle' | 'loading' | 'ready' | 'error';

type Text2TextPipeline = Awaited<
  ReturnType<typeof import('@huggingface/transformers')['pipeline']>
>;

let generatorPromise: Promise<Text2TextPipeline> | null = null;

async function getGenerator(): Promise<Text2TextPipeline> {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
    })();
  }
  return generatorPromise;
}

export function useComparisonSynthesis() {
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [synthState, setSynthState] = useState<SynthState>('idle');

  const generateComparison = useCallback(
    async (query: string, stateResults: StateComparisonRow[], userState?: string) => {
      const withBills = stateResults.filter((r) => r.topBill);
      if (withBills.length < 2) {
        setSynthesis('Not enough matching bills across states to generate a comparison.');
        setSynthState('ready');
        return;
      }

      try {
        setSynthState('loading');
        setSynthesis(null);

        const generator = await getGenerator();
        const context = withBills
          .slice(0, 5)
          .map(
            (row) =>
              `[${row.jurisdictionName}, ${row.topBill?.identifier || 'bill'}]: ${
                row.topBill?.geminiSummary || row.topBill?.title || ''
              }`,
          )
          .join('\n\n');

        const prompt = `Based only on these state bills about "${query}", write a brief comparison paragraph. Mention how ${
          userState || 'different states'
        } compare. Be factual and cite bill identifiers.

Bills:
${context}

Comparison:`;

        const out = await generator(prompt, { max_new_tokens: 150, temperature: 0.2 });
        const text = (out as Array<{ generated_text?: string }>)?.[0]?.generated_text?.trim();

        setSynthesis(text || 'Could not generate a comparison summary.');
        setSynthState('ready');
      } catch (error) {
        console.error('Synthesis failed:', error);
        setSynthesis(null);
        setSynthState('error');
      }
    },
    [],
  );

  const resetSynthesis = useCallback(() => {
    setSynthesis(null);
    setSynthState('idle');
  }, []);

  return { synthesis, synthState, generateComparison, resetSynthesis };
}
