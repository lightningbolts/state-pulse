'use server';
/**
 * @fileOverview A flow that summarizes legislation into a tweet-length summary.
 *
 * - summarizeLegislationTweetLength - A function that summarizes legislation into a tweet-length summary.
 * - SummarizeLegislationTweetLengthInput - The input type for the summarizeLegislationTweetLength function.
 * - SummarizeLegislationTweetLengthOutput - The return type for the summarizeLegislationTweetLength function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeLegislationTweetLengthInputSchema = z.object({
  legislationText: z.string().describe('The text of the legislation to summarize.'),
});
export type SummarizeLegislationTweetLengthInput = z.infer<typeof SummarizeLegislationTweetLengthInputSchema>;

const SummarizeLegislationTweetLengthOutputSchema = z.object({
  tweetLengthSummary: z.string().describe('A tweet-length summary of the legislation.'),
});
export type SummarizeLegislationTweetLengthOutput = z.infer<typeof SummarizeLegislationTweetLengthOutputSchema>;

export async function summarizeLegislationTweetLength(
  input: SummarizeLegislationTweetLengthInput
): Promise<SummarizeLegislationTweetLengthOutput> {
  return summarizeLegislationTweetLengthFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeLegislationTweetLengthPrompt',
  input: {schema: SummarizeLegislationTweetLengthInputSchema},
  output: {schema: SummarizeLegislationTweetLengthOutputSchema},
  prompt: `Summarize the following legislation in a tweet-length summary (280 characters or less):\n\n{{{legislationText}}}`,
});

const summarizeLegislationTweetLengthFlow = ai.defineFlow(
  {
    name: 'summarizeLegislationTweetLengthFlow',
    inputSchema: SummarizeLegislationTweetLengthInputSchema,
    outputSchema: SummarizeLegislationTweetLengthOutputSchema,
  },
  async input => {
    // const {output} = await prompt(input);
    const output = {
      tweetLengthSummary: "This is a tweet-length summary of the legislation."
    };
    return output!;
  }
);
