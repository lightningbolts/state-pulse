/**
 * Service to fetch detailed sponsor information for voting predictions
 */

import { getCollection } from '@/lib/mongodb';

export interface DetailedSponsor {
  id?: string;
  name?: string;
  party?: string;
  classification?: string;
  // Enhanced fields from detailed lookup
  district?: string | number;
  state?: string;
  chamber?: string;
  role?: string;
  office?: string;
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
  image?: string;
  jurisdiction?: string | { id?: string; name?: string; classification?: string };
  birthYear?: string | number;
  birth_date?: string;
  gender?: string;
  given_name?: string;
  family_name?: string;
  leadership?: Array<{
    congress?: number;
    type?: string;
  }>;
  sponsoredLegislation?: {
    count?: number;
    url?: string;
  };
  cosponsoredLegislation?: {
    count?: number;
    url?: string;
  };
  terms?: Array<{
    chamber?: string;
    congress?: number;
    district?: string | number;
    endYear?: number;
    startYear?: number;
    memberType?: string;
    stateCode?: string;
    stateName?: string;
  }>;
  partyHistory?: Array<{
    partyAbbreviation?: string;
    partyName?: string;
    startYear?: number;
  }>;
  extras?: {
    title?: string;
    [key: string]: any;
  };
  map_boundary?: {
    district?: string;
    name?: string;
    geoidfq?: string;
    type?: string;
  };
  division_id?: string;
  voting_record?: {
    liberal_score?: number;
    conservative_score?: number;
    partisanship_score?: number;
  };
}

/**
 * Fetch detailed information for a sponsor by their ID
 */
export async function fetchSponsorDetails(sponsorId: string): Promise<DetailedSponsor | null> {
  try {
    const representativesCollection = await getCollection('representatives');

    // Try to find the sponsor in the representatives collection
    const sponsor = await representativesCollection.findOne({ id: sponsorId });

    if (!sponsor) {
      console.warn(`Sponsor not found: ${sponsorId}`);
      return null;
    }

    return mapSponsorData(sponsor);
  } catch (error) {
    console.error(`Error fetching sponsor details for ${sponsorId}:`, error);
    return null;
  }
}

/**
 * Fetch detailed information for multiple sponsors
 */
export async function fetchMultipleSponsorDetails(sponsorIds: string[]): Promise<DetailedSponsor[]> {
  if (!sponsorIds || sponsorIds.length === 0) {
    return [];
  }

  try {
    const representativesCollection = await getCollection('representatives');

    // Batch fetch all sponsors
    const sponsors = await representativesCollection.find({
      id: { $in: sponsorIds }
    }).toArray();

    return sponsors.map(sponsor => mapSponsorData(sponsor));
  } catch (error) {
    console.error(`Error fetching multiple sponsor details:`, error);
    return [];
  }
}

/**
 * Map raw sponsor data from MongoDB to our DetailedSponsor interface
 */
function mapSponsorData(sponsor: any): DetailedSponsor {
  // Determine chamber from various possible fields
  let chamber = sponsor.chamber;
  if (!chamber && sponsor.jurisdiction) {
    if (typeof sponsor.jurisdiction === 'string') {
      if (sponsor.jurisdiction.includes('House')) chamber = 'House';
      else if (sponsor.jurisdiction.includes('Senate')) chamber = 'Senate';
    } else if (sponsor.jurisdiction.name) {
      if (sponsor.jurisdiction.name.includes('House')) chamber = 'House';
      else if (sponsor.jurisdiction.name.includes('Senate')) chamber = 'Senate';
    }
  }

  // Get the most recent term for additional context
  const mostRecentTerm = sponsor.terms && sponsor.terms.length > 0
    ? sponsor.terms[sponsor.terms.length - 1]
    : null;

  // Construct full name from given_name and family_name if name is not available
  let fullName = sponsor.name;
  if (!fullName && sponsor.given_name && sponsor.family_name) {
    fullName = `${sponsor.family_name}, ${sponsor.given_name}`;
  }

  return {
    id: sponsor.id,
    name: fullName,
    given_name: sponsor.given_name,
    family_name: sponsor.family_name,
    party: sponsor.party,
    classification: sponsor.classification,
    district: sponsor.district,
    state: sponsor.state,
    chamber,
    role: sponsor.extras?.title || mostRecentTerm?.memberType,
    office: sponsor.address,
    website: sponsor.website,
    address: sponsor.address,
    phone: sponsor.phone,
    email: sponsor.email,
    image: sponsor.image,
    jurisdiction: sponsor.jurisdiction,
    birthYear: sponsor.birthYear,
    birth_date: sponsor.birth_date,
    gender: sponsor.gender,
    leadership: sponsor.leadership,
    sponsoredLegislation: sponsor.sponsoredLegislation,
    cosponsoredLegislation: sponsor.cosponsoredLegislation,
    terms: sponsor.terms,
    partyHistory: sponsor.partyHistory,
    extras: sponsor.extras,
    map_boundary: sponsor.map_boundary,
    division_id: sponsor.division_id,
    voting_record: sponsor.voting_record
  };
}

/**
 * Enhance basic sponsor information with detailed data
 */
export async function enhanceSponsorsWithDetails(basicSponsors: Array<{
  id?: string;
  name?: string;
  party?: string;
  classification?: string;
}>): Promise<DetailedSponsor[]> {
  if (!basicSponsors || basicSponsors.length === 0) {
    return [];
  }

  // Extract sponsor IDs, filtering out any without IDs
  const sponsorIds = basicSponsors
    .map(sponsor => sponsor.id)
    .filter((id): id is string => !!id);

  if (sponsorIds.length === 0) {
    // If no IDs available, return the basic sponsor info
    return basicSponsors.map(sponsor => ({
      ...sponsor
    }));
  }

  // Fetch detailed information
  const detailedSponsors = await fetchMultipleSponsorDetails(sponsorIds);

  // Create a map for quick lookup
  const detailsMap = new Map(detailedSponsors.map(sponsor => [sponsor.id, sponsor]));

  // Merge basic info with detailed info
  return basicSponsors.map(basicSponsor => {
    const detailed = basicSponsor.id ? detailsMap.get(basicSponsor.id) : null;

    return {
      ...detailed,
      // Ensure basic info takes precedence if it exists and is more specific
      id: basicSponsor.id || detailed?.id,
      name: basicSponsor.name || detailed?.name,
      party: basicSponsor.party || detailed?.party,
      classification: basicSponsor.classification || detailed?.classification
    };
  });
}
