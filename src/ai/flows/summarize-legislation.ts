// Summarize legislation in plain English.

'use server';

/**
 * @fileOverview Summarizes legislation in plain English.
 *
 * - summarizeLegislationPlainEnglish - A function that summarizes legislation in plain English.
 * - SummarizeLegislationPlainEnglishInput - The input type for the summarizeLegislationPlainEnglish function.
 * - SummarizeLegislationPlainEnglishOutput - The return type for the summarizeLegislationPlainEnglish function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeLegislationPlainEnglishInputSchema = z.object({
  legislationText: z.string().describe('The text of the legislation to summarize.'),
});
export type SummarizeLegislationPlainEnglishInput = z.infer<
  typeof SummarizeLegislationPlainEnglishInputSchema
>;

const SummarizeLegislationPlainEnglishOutputSchema = z.object({
  summary: z.string().describe('A plain English summary of the legislation.'),
});
export type SummarizeLegislationPlainEnglishOutput = z.infer<
  typeof SummarizeLegislationPlainEnglishOutputSchema
>;

export async function summarizeLegislationPlainEnglish(
  input: SummarizeLegislationPlainEnglishInput
): Promise<SummarizeLegislationPlainEnglishOutput> {
  return summarizeLegislationPlainEnglishFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeLegislationPlainEnglishPrompt',
  input: {schema: SummarizeLegislationPlainEnglishInputSchema},
  output: {schema: SummarizeLegislationPlainEnglishOutputSchema},
  prompt: `Summarize the following legislation in plain English:\n\n{{legislationText}}`,
});

const summarizeLegislationPlainEnglishFlow = ai.defineFlow(
  {
    name: 'summarizeLegislationPlainEnglishFlow',
    inputSchema: SummarizeLegislationPlainEnglishInputSchema,
    outputSchema: SummarizeLegislationPlainEnglishOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
