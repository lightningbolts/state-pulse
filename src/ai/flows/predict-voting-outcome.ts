// Predict voting outcomes for legislation based on various factors.

'use server';

/**
 * @fileOverview Predicts voting outcomes for legislation using AI analysis.
 *
 * - predictVotingOutcome - A function that predicts voting outcomes for legislation
 * - PredictVotingOutcomeInput - The input type for the predictVotingOutcome function
 * - PredictVotingOutcomeOutput - The return type for the predictVotingOutcome function
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictVotingOutcomeInputSchema = z.object({
  legislationTitle: z.string().describe('The title of the legislation'),
  legislationText: z.string().optional().describe('The full text of the legislation'),
  summary: z.string().optional().describe('A summary of the legislation'),
  subjects: z.array(z.string()).optional().describe('Subject areas/topics of the legislation'),
  chamber: z.string().optional().describe('The legislative chamber (house, senate, etc.)'),
  jurisdictionName: z.string().optional().describe('The state or jurisdiction name'),
  sponsors: z.array(z.object({
    name: z.string().optional(),
    party: z.string().optional(),
    classification: z.string().optional()
  })).optional().describe('Bill sponsors with their party affiliations'),
  classification: z.array(z.string()).optional().describe('Bill classification types'),
  statusText: z.string().optional().describe('Current status of the bill'),
  history: z.array(z.object({
    date: z.string().optional(),
    description: z.string().optional(),
    action: z.string().optional()
  })).optional().describe('Legislative history and actions taken'),
  politicalContext: z.object({
    controllingParty: z.string().optional().describe('Party controlling the chamber'),
    partisanBalance: z.string().optional().describe('Partisan balance in the chamber'),
    recentElections: z.string().optional().describe('Recent election results context')
  }).optional().describe('Political context information')
});

export type PredictVotingOutcomeInput = z.infer<typeof PredictVotingOutcomeInputSchema>;

const PredictVotingOutcomeOutputSchema = z.object({
  prediction: z.object({
    outcome: z.enum(['pass', 'fail', 'uncertain']).describe('Predicted outcome'),
    confidence: z.number().min(0).max(100).describe('Confidence percentage (0-100)'),
    probabilityPass: z.number().min(0).max(100).describe('Probability of passage (0-100)'),
  }),
  factors: z.object({
    supportingFactors: z.array(z.string()).describe('Factors that support passage'),
    opposingFactors: z.array(z.string()).describe('Factors that oppose passage'),
    neutralFactors: z.array(z.string()).describe('Neutral or uncertain factors')
  }),
  analysis: z.object({
    partisanAnalysis: z.string().describe('Analysis of partisan implications'),
    publicSentiment: z.string().describe('Likely public sentiment analysis'),
    stakeholderImpact: z.string().describe('Impact on key stakeholders'),
    historicalPrecedent: z.string().describe('Historical precedent for similar bills'),
    keyRisks: z.array(z.string()).describe('Key risks that could affect the outcome')
  }),
  timeline: z.object({
    estimatedVoteDate: z.string().optional().describe('Estimated date for key votes'),
    nextMilestones: z.array(z.string()).describe('Next expected legislative milestones')
  }),
  reasoning: z.string().describe('Detailed explanation of the prediction reasoning')
});

export type PredictVotingOutcomeOutput = z.infer<typeof PredictVotingOutcomeOutputSchema>;

export const predictVotingOutcome = ai.defineFlow(
  {
    name: 'predictVotingOutcome',
    inputSchema: PredictVotingOutcomeInputSchema,
    outputSchema: PredictVotingOutcomeOutputSchema,
  },
  async (input) => {
    const prompt = `
    As a legislative analyst AI, predict the voting outcome for the following legislation. Consider all available information including political context, bill content, sponsor information, and historical patterns.

    LEGISLATION DETAILS:
    Title: ${input.legislationTitle}
    ${input.summary ? `Summary: ${input.summary}` : ''}
    ${input.chamber ? `Chamber: ${input.chamber}` : ''}
    ${input.jurisdictionName ? `Jurisdiction: ${input.jurisdictionName}` : ''}
    ${input.subjects?.length ? `Subjects: ${input.subjects.join(', ')}` : ''}
    ${input.classification?.length ? `Classification: ${input.classification.join(', ')}` : ''}
    ${input.statusText ? `Current Status: ${input.statusText}` : ''}

    SPONSORS:
    ${input.sponsors?.map(s => `- ${s.name || 'Unknown'} (${s.party || 'Unknown party'}) - ${s.classification || 'Unknown role'}`).join('\n') || 'No sponsor information available'}

    LEGISLATIVE HISTORY:
    ${input.history?.map(h => `- ${h.date}: ${h.description || h.action}`).join('\n') || 'No history available'}

    POLITICAL CONTEXT:
    ${input.politicalContext?.controllingParty ? `Controlling Party: ${input.politicalContext.controllingParty}` : ''}
    ${input.politicalContext?.partisanBalance ? `Partisan Balance: ${input.politicalContext.partisanBalance}` : ''}
    ${input.politicalContext?.recentElections ? `Recent Elections: ${input.politicalContext.recentElections}` : ''}

    ${input.legislationText ? `\nFULL TEXT:\n${input.legislationText.substring(0, 8000)}` : ''}

    ANALYSIS REQUIREMENTS:
    1. Predict the most likely outcome (pass, fail, or uncertain)
    2. Provide a confidence percentage based on available information
    3. Calculate probability of passage
    4. Identify supporting and opposing factors
    5. Analyze partisan implications and public sentiment
    6. Consider historical precedent for similar legislation
    7. Estimate timeline and key milestones
    8. Provide detailed reasoning

    Consider factors like:
    - Bipartisan vs partisan nature of sponsors
    - Controversial vs routine nature of the subject matter
    - Current political climate and priorities
    - Chamber composition and voting patterns
    - Similar bills' historical outcomes
    - Stakeholder interests and lobbying pressure
    - Public opinion and media attention
    - Economic and social impact

    Provide a comprehensive analysis with specific, actionable insights.
    `;

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt,
      output: {
        schema: PredictVotingOutcomeOutputSchema,
      },
    });

    return response.output!;
  }
);
