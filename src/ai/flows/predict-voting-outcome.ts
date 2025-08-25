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
    given_name: z.string().optional().describe('First name'),
    family_name: z.string().optional().describe('Last name'),
    party: z.string().optional(),
    classification: z.string().optional(),
    district: z.union([z.string(), z.number()]).optional().describe('Electoral district or constituency'),
    state: z.string().optional().describe('State the sponsor represents'),
    chamber: z.string().optional().describe('Chamber the sponsor serves in'),
    role: z.string().optional().describe('Current role or title (e.g., Representative, Senator)'),
    office: z.string().optional().describe('Office address'),
    website: z.string().optional().describe('Official website'),
    phone: z.string().optional().describe('Phone number'),
    email: z.string().optional().describe('Email address'),
    birthYear: z.union([z.string(), z.number()]).optional().describe('Birth year'),
    gender: z.string().optional().describe('Gender'),
    leadership: z.array(z.object({
      congress: z.number().optional(),
      type: z.string().optional().describe('Leadership role type')
    })).optional().describe('Leadership positions held'),
    sponsoredLegislation: z.object({
      count: z.number().optional().describe('Number of bills sponsored')
    }).optional().describe('Sponsored legislation statistics'),
    cosponsoredLegislation: z.object({
      count: z.number().optional().describe('Number of bills cosponsored')
    }).optional().describe('Cosponsored legislation statistics'),
    terms: z.array(z.object({
      chamber: z.string().optional(),
      congress: z.number().optional(),
      district: z.union([z.string(), z.number()]).optional(),
      endYear: z.number().optional(),
      startYear: z.number().optional(),
      memberType: z.string().optional(),
      stateCode: z.string().optional(),
      stateName: z.string().optional()
    })).optional().describe('Historical terms of service'),
    partyHistory: z.array(z.object({
      partyAbbreviation: z.string().optional(),
      partyName: z.string().optional(),
      startYear: z.number().optional()
    })).optional().describe('Party affiliation history'),
    extras: z.object({
      title: z.string().optional().describe('Additional title or role')
    }).optional().describe('Extra information'),
    voting_record: z.object({
      liberal_score: z.number().optional().describe('Liberal voting score (0-100)'),
      conservative_score: z.number().optional().describe('Conservative voting score (0-100)'),
      partisanship_score: z.number().optional().describe('Partisanship score')
    }).optional().describe('Historical voting patterns and ideology scores')
  })).optional().describe('Bill sponsors with detailed biographical and political information'),
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
  }).optional().describe('Political context information'),
  currentDate: z.string().describe('Current date in ISO format for temporal context and timeline predictions')
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

    CURRENT DATE: ${input.currentDate} (Use this for timeline estimates and temporal context)

    LEGISLATION DETAILS:
    Title: ${input.legislationTitle}
    ${input.summary ? `Summary: ${input.summary}` : ''}
    ${input.chamber ? `Chamber: ${input.chamber}` : ''}
    ${input.jurisdictionName ? `Jurisdiction: ${input.jurisdictionName}` : ''}
    ${input.subjects?.length ? `Subjects: ${input.subjects.join(', ')}` : ''}
    ${input.classification?.length ? `Classification: ${input.classification.join(', ')}` : ''}
    ${input.statusText ? `Current Status: ${input.statusText}` : ''}

    SPONSORS (Enhanced Information):
    ${input.sponsors?.map(s => {
      let sponsorInfo = `- ${s.name || `${s.given_name} ${s.family_name}`} (${s.party || 'Unknown party'}) - ${s.role || s.classification || 'Unknown role'}`;
      
      if (s.district) sponsorInfo += `\n  District: ${s.district}`;
      if (s.state) sponsorInfo += `\n  State: ${s.state}`;
      if (s.chamber) sponsorInfo += `\n  Chamber: ${s.chamber}`;
      if (s.birthYear) sponsorInfo += `\n  Born: ${s.birthYear}`;
      if (s.gender) sponsorInfo += `\n  Gender: ${s.gender}`;
      
      // Leadership roles
      if (s.leadership?.length) {
        const leadershipRoles = s.leadership.map(l => `${l.type} (Congress ${l.congress})`).join(', ');
        sponsorInfo += `\n  Leadership: ${leadershipRoles}`;
      } else if (s.extras?.title) {
        // For state legislators, use extras.title as leadership role
        sponsorInfo += `\n  Leadership: ${s.extras.title}`;
      }
      
      // Legislative productivity
      if (s.sponsoredLegislation?.count || s.cosponsoredLegislation?.count) {
        sponsorInfo += `\n  Legislative Activity:`;
        if (s.sponsoredLegislation?.count) sponsorInfo += ` Sponsored ${s.sponsoredLegislation.count} bills`;
        if (s.cosponsoredLegislation?.count) sponsorInfo += ` Cosponsored ${s.cosponsoredLegislation.count} bills`;
      }
      
      // Voting record analysis
      if (s.voting_record) {
        sponsorInfo += `\n  Voting Record:`;
        if (s.voting_record.liberal_score) sponsorInfo += ` Liberal Score: ${s.voting_record.liberal_score}`;
        if (s.voting_record.conservative_score) sponsorInfo += ` Conservative Score: ${s.voting_record.conservative_score}`;
        if (s.voting_record.partisanship_score) sponsorInfo += ` Partisanship: ${s.voting_record.partisanship_score}`;
      }
      
      // Service history and experience
      if (s.terms?.length) {
        sponsorInfo += `\n  Service History: ${s.terms.length} terms`;
        const recentTerm = s.terms[s.terms.length - 1];
        if (recentTerm) {
          if (recentTerm.startYear) {
            const endYear = recentTerm.endYear || 'present';
            sponsorInfo += ` (${recentTerm.startYear}-${endYear})`;
          }
          if (recentTerm.memberType) sponsorInfo += ` as ${recentTerm.memberType}`;
        }
      }
      
      // Party history for switchers or long-term service
      if (s.partyHistory?.length && s.partyHistory.length > 1) {
        const partyChanges = s.partyHistory.map(p => `${p.partyName} (${p.startYear})`).join(', ');
        sponsorInfo += `\n  Party History: ${partyChanges}`;
      } else if (s.partyHistory?.[0]?.startYear) {
        const serviceStart = s.partyHistory[0].startYear;
        const yearsOfService = new Date().getFullYear() - serviceStart;
        if (yearsOfService > 10) {
          sponsorInfo += `\n  Party Tenure: ${yearsOfService} years with ${s.partyHistory[0].partyName}`;
        }
      }
      
      // Special titles or roles
      if (s.extras?.title) {
        sponsorInfo += `\n  Special Role: ${s.extras.title}`;
      }
      
      return sponsorInfo;
    }).join('\n\n') || 'No sponsor information available'}

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
    7. Estimate timeline and key milestones (use the current date: ${input.currentDate})
    8. Provide detailed reasoning

    Consider factors like:
    - Sponsor experience, voting records, and political influence
    - Bipartisan vs partisan nature of sponsors
    - Sponsor districts and constituencies they represent
    - Controversial vs routine nature of the subject matter
    - Current political climate and priorities
    - Chamber composition and voting patterns
    - Similar bills' historical outcomes
    - Stakeholder interests and lobbying pressure
    - Public opinion and media attention
    - Economic and social impact
    - Timing relative to legislative calendar and elections

    When estimating dates and timelines, factor in:
    - Current date: ${input.currentDate}
    - Typical legislative processes and timelines
    - Remaining time in current legislative session
    - Committee schedules and floor calendar
    - Upcoming recess periods and elections

    Provide a comprehensive analysis with specific, actionable insights and realistic timeline estimates.
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
