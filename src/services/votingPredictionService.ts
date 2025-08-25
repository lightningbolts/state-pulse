import { predictVotingOutcome, PredictVotingOutcomeInput, PredictVotingOutcomeOutput } from '@/ai/flows/predict-voting-outcome';
import { Legislation } from '@/types/legislation';
import { getCollection } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { fetchPoliticalContextForLegislation, PoliticalContext } from '@/services/politicalContextService';
import { enhanceSponsorsWithDetails, DetailedSponsor } from '@/services/sponsorService';

export interface VotingPrediction extends PredictVotingOutcomeOutput {
  legislationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VotingPredictionDocument extends Omit<VotingPrediction, 'legislationId'> {
  _id?: ObjectId;
  legislationId: string;
}

/**
 * Generate a voting outcome prediction for a piece of legislation with automatic political context and enhanced sponsor data
 */
export async function generateVotingPrediction(
  legislation: Legislation,
  manualPoliticalContext?: {
    controllingParty?: string;
    partisanBalance?: string;
    recentElections?: string;
  }
): Promise<PredictVotingOutcomeOutput> {
  // Fetch automatic political context from chamber makeup
  const autoPoliticalContext = await fetchPoliticalContextForLegislation(
    legislation.jurisdictionName,
    legislation.chamber
  );

  // Merge manual context with automatic context (manual takes precedence)
  const politicalContext: PoliticalContext = {
    controllingParty: manualPoliticalContext?.controllingParty || autoPoliticalContext.controllingParty,
    partisanBalance: manualPoliticalContext?.partisanBalance || autoPoliticalContext.partisanBalance,
    recentElections: manualPoliticalContext?.recentElections || autoPoliticalContext.recentElections,
  };

  // Enhance sponsors with detailed information - improved extraction logic
  const basicSponsors = legislation.sponsors?.map(sponsor => {
    // Handle various sponsor data structures more robustly
    let sponsorId = sponsor.id || sponsor.person_id || sponsor.personId;
    let sponsorName = sponsor.name;
    let sponsorParty = sponsor.party;
    let sponsorClassification = sponsor.classification || sponsor.primary || sponsor.role;

    // Try to extract from nested person object if available
    if (sponsor.person) {
      sponsorId = sponsorId || sponsor.person.id;
      sponsorName = sponsorName || sponsor.person.name;
      sponsorParty = sponsorParty || sponsor.person.party;
    }

    // Try alternative field names commonly used in legislative data
    sponsorName = sponsorName || sponsor.sponsor_name || sponsor.legislator_name || sponsor.full_name;
    sponsorParty = sponsorParty || sponsor.party_name || sponsor.political_party;

    return {
      id: sponsorId,
      name: sponsorName,
      party: sponsorParty,
      classification: sponsorClassification
    };
  }).filter(sponsor => sponsor.name || sponsor.id) || []; // Filter out sponsors with no name or ID

  // console.log('Basic sponsors extracted:', basicSponsors); // Debug log to see what we're getting

  const enhancedSponsors = await enhanceSponsorsWithDetails(basicSponsors);

  // console.log('Enhanced sponsors:', enhancedSponsors); // Debug log to see enhanced data

  // Convert enhanced sponsors to the format expected by the AI
  const aiSponsors = enhancedSponsors.map(sponsor => ({
    name: sponsor.name,
    given_name: sponsor.given_name,
    family_name: sponsor.family_name,
    party: sponsor.party,
    classification: sponsor.classification,
    district: sponsor.district,
    state: sponsor.state,
    chamber: sponsor.chamber,
    role: sponsor.role,
    office: sponsor.office,
    website: sponsor.website,
    phone: sponsor.phone,
    email: sponsor.email,
    birthYear: sponsor.birthYear,
    gender: sponsor.gender,
    leadership: sponsor.leadership,
    sponsoredLegislation: sponsor.sponsoredLegislation,
    cosponsoredLegislation: sponsor.cosponsoredLegislation,
    terms: sponsor.terms,
    partyHistory: sponsor.partyHistory,
    extras: sponsor.extras,
    voting_record: sponsor.voting_record
  }));

  // console.log('AI Sponsors being sent:', JSON.stringify(aiSponsors, null, 2)); // Debug log to see final AI input

  const input: PredictVotingOutcomeInput = {
    legislationTitle: legislation.title || 'Unknown Bill',
    legislationText: legislation.fullText || undefined,
    summary: legislation.geminiSummary || legislation.summary || undefined,
    subjects: legislation.subjects || [],
    chamber: legislation.chamber || undefined,
    jurisdictionName: legislation.jurisdictionName || undefined,
    sponsors: aiSponsors,
    classification: legislation.classification || [],
    statusText: legislation.statusText || undefined,
    history: legislation.history?.map(action => ({
      date: action.date ? (action.date instanceof Date ? action.date.toISOString() : action.date.toString()) : undefined,
      description: action.description,
      action: action.action
    })) || [],
    politicalContext,
    currentDate: new Date().toISOString() // Add current date for temporal context
  };

  return await predictVotingOutcome(input);
}

/**
 * Save a voting prediction to the database
 */
export async function saveVotingPrediction(
  legislationId: string,
  prediction: PredictVotingOutcomeOutput
): Promise<void> {
  try {
    const predictionsCollection = await getCollection('voting_predictions');

    const predictionDoc: VotingPredictionDocument = {
      ...prediction,
      legislationId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Upsert the prediction (replace if exists, insert if not)
    await predictionsCollection.replaceOne(
      { legislationId },
      predictionDoc,
      { upsert: true }
    );
  } catch (error) {
    console.error('Error saving voting prediction:', error);
    throw new Error('Failed to save voting prediction');
  }
}

/**
 * Get a cached voting prediction from the database
 */
export async function getCachedVotingPrediction(legislationId: string): Promise<VotingPrediction | null> {
  try {
    const predictionsCollection = await getCollection('voting_predictions');
    const prediction = await predictionsCollection.findOne({ legislationId });

    if (!prediction) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...restOfPrediction } = prediction;
    return restOfPrediction as VotingPrediction;
  } catch (error) {
    console.error('Error fetching voting prediction:', error);
    return null;
  }
}

/**
 * Get or generate a voting prediction for legislation
 * Checks cache first, generates new prediction if not found or outdated
 */
export async function getVotingPrediction(
  legislation: Legislation,
  politicalContext?: {
    controllingParty?: string;
    partisanBalance?: string;
    recentElections?: string;
  },
  forceRefresh: boolean = false
): Promise<VotingPrediction> {
  if (!legislation.id) {
    throw new Error('Legislation ID is required for prediction');
  }

  // Check for cached prediction first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = await getCachedVotingPrediction(legislation.id);
    if (cached) {
      // Consider prediction stale if older than 7 days
      const isStale = Date.now() - cached.updatedAt.getTime() > 7 * 24 * 60 * 60 * 1000;
      if (!isStale) {
        return cached;
      }
    }
  }

  // Generate new prediction
  const prediction = await generateVotingPrediction(legislation, politicalContext);

  // Save to cache
  await saveVotingPrediction(legislation.id, prediction);

  return {
    ...prediction,
    legislationId: legislation.id,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Batch generate predictions for multiple pieces of legislation
 */
export async function batchGeneratePredictions(
  legislations: Legislation[],
  politicalContext?: {
    controllingParty?: string;
    partisanBalance?: string;
    recentElections?: string;
  }
): Promise<VotingPrediction[]> {
  const predictions: VotingPrediction[] = [];

  // Process in batches to avoid overwhelming the AI service
  const batchSize = 5;
  for (let i = 0; i < legislations.length; i += batchSize) {
    const batch = legislations.slice(i, i + batchSize);

    const batchPredictions = await Promise.allSettled(
      batch.map(legislation => getVotingPrediction(legislation, politicalContext))
    );

    batchPredictions.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        predictions.push(result.value);
      } else {
        console.error(`Failed to predict outcome for ${batch[index].id}:`, result.reason);
      }
    });

    // Add small delay between batches
    if (i + batchSize < legislations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return predictions;
}
