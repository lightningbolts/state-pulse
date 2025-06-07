'use server';
/**
 * @fileOverview Summarizes a bill in a legally dense style.
 *
 * - summarizeLegislationLegallyDense - A function that handles the bill summarization process.
 * - SummarizeLegislationLegallyDenseInput - The input type for the summarizeLegislationLegallyDense function.
 * - SummarizeLegislationLegallyDenseOutput - The return type for the summarizeLegislationLegallyDense function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeLegislationLegallyDenseInputSchema = z.object({
  billText: z.string().describe('The full text of the bill to be summarized.'),
});
export type SummarizeLegislationLegallyDenseInput = z.infer<typeof SummarizeLegislationLegallyDenseInputSchema>;

const SummarizeLegislationLegallyDenseOutputSchema = z.object({
  summary: z.string().describe('A legally dense summary of the bill.'),
});
export type SummarizeLegislationLegallyDenseOutput = z.infer<typeof SummarizeLegislationLegallyDenseOutputSchema>;

export async function summarizeLegislationLegallyDense(input: SummarizeLegislationLegallyDenseInput): Promise<SummarizeLegislationLegallyDenseOutput> {
  return summarizeLegislationLegallyDenseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeLegislationLegallyDensePrompt',
  input: {schema: SummarizeLegislationLegallyDenseInputSchema},
  output: {schema: SummarizeLegislationLegallyDenseOutputSchema},
  prompt: `You are an expert legal analyst.

  You are tasked with summarizing the following bill in a legally dense style, suitable for use in legal research. Be very specific and technical.

  Bill Text: {{{billText}}}`,
});

const summarizeLegislationLegallyDenseFlow = ai.defineFlow(
  {
    name: 'summarizeLegislationLegallyDenseFlow',
    inputSchema: SummarizeLegislationLegallyDenseInputSchema,
    outputSchema: SummarizeLegislationLegallyDenseOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
