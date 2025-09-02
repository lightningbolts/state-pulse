/**
 * Service to fetch political context from chamber makeup data
 */
import {STATE_MAP} from "@/types/geo";

export interface ChamberMakeup {
  chamber: string;
  totalSeats: number;
  parties: Array<{
    party: string;
    count: number;
    percentage: number;
    representatives: Array<{
      id: string;
      name: string;
      party: string;
      district: string;
      state: string;
    }>;
  }>;
}

export interface PoliticalContext {
  controllingParty?: string;
  partisanBalance?: string;
  recentElections?: string;
}

export interface ChamberMakeupResponse {
  success: boolean;
  state: string;
  chambers: ChamberMakeup[];
  summary: {
    totalRepresentatives: number;
    chambersAvailable: string[];
  };
}

/**
 * Fetch chamber makeup data for a jurisdiction
 */
export async function fetchChamberMakeup(jurisdictionName: string): Promise<ChamberMakeupResponse | null> {
  try {
    // Convert jurisdiction name to state abbreviation or handle special cases
    const stateParam = convertJurisdictionToStateParam(jurisdictionName);

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/chamber-makeup/${stateParam}`);

    if (!response.ok) {
      console.warn(`Failed to fetch chamber makeup for ${jurisdictionName}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error(`Error fetching chamber makeup for ${jurisdictionName}:`, error);
    return null;
  }
}

/**
 * Convert jurisdiction name to API parameter format
 */
function convertJurisdictionToStateParam(jurisdictionName: string): string {
  if (!jurisdictionName) return 'US';

  // Handle federal/congress cases
  if (jurisdictionName.toLowerCase().includes('congress') ||
      jurisdictionName.toLowerCase().includes('united states')) {
    return 'US';
  }

  // State abbreviation mapping

  // Direct state name match
  const stateAbbr = STATE_MAP[jurisdictionName];
  if (stateAbbr) return stateAbbr;

  // Partial match for state names
  for (const [stateName, abbr] of Object.entries(STATE_MAP)) {
    if (jurisdictionName.toLowerCase().includes(stateName.toLowerCase())) {
      return abbr;
    }
  }

  // If it's already an abbreviation, return as-is
  if (jurisdictionName.length === 2) {
    return jurisdictionName.toUpperCase();
  }

  // Fallback to the original name
  return jurisdictionName;
}

/**
 * Generate political context from chamber makeup data
 */
export function generatePoliticalContext(
  chamberMakeup: ChamberMakeupResponse,
  billChamber?: string
): PoliticalContext {
  if (!chamberMakeup?.chambers || chamberMakeup.chambers.length === 0) {
    return {};
  }

  // Find the relevant chamber for the bill
  let targetChamber = chamberMakeup.chambers[0]; // Default to first chamber

  if (billChamber) {
    const normalizedBillChamber = billChamber.toLowerCase();
    const foundChamber = chamberMakeup.chambers.find(chamber => {
      const chamberName = chamber.chamber.toLowerCase();
      return (
        (normalizedBillChamber.includes('house') && chamberName.includes('house')) ||
        (normalizedBillChamber.includes('senate') && chamberName.includes('senate')) ||
        (normalizedBillChamber.includes('upper') && chamberName.includes('senate')) ||
        (normalizedBillChamber.includes('lower') && chamberName.includes('house'))
      );
    });

    if (foundChamber) {
      targetChamber = foundChamber;
    }
  }

  // Calculate party control and balance
  const parties = targetChamber.parties.sort((a, b) => b.count - a.count);
  const majorityParty = parties[0];
  const minorityParty = parties[1];

  const controllingParty = majorityParty ? majorityParty.party : undefined;

  let partisanBalance = '';
  if (majorityParty && minorityParty) {
    partisanBalance = `${majorityParty.count}-${minorityParty.count} ${majorityParty.party} majority`;

    // Add additional context for close margins
    const margin = majorityParty.count - minorityParty.count;
    const totalSeats = targetChamber.totalSeats;
    const marginPercentage = (margin / totalSeats) * 100;

    if (marginPercentage < 10) {
      partisanBalance += ' (narrow margin)';
    } else if (marginPercentage > 30) {
      partisanBalance += ' (strong majority)';
    }
  } else if (majorityParty) {
    partisanBalance = `${majorityParty.party} control (${majorityParty.count}/${targetChamber.totalSeats} seats)`;
  }

  // Generate recent elections context (simplified - could be enhanced with real election data)
  const currentYear = new Date().getFullYear();
  let recentElections = '';

  if (majorityParty) {
    const majorityPercentage = majorityParty.percentage;
    if (majorityPercentage > 60) {
      recentElections = `Strong ${majorityParty.party} performance in recent elections`;
    } else if (majorityPercentage < 55) {
      recentElections = `Competitive recent elections with narrow ${majorityParty.party} advantage`;
    } else {
      recentElections = `Moderate ${majorityParty.party} advantage from recent elections`;
    }
  }

  return {
    controllingParty,
    partisanBalance,
    recentElections
  };
}

/**
 * Fetch political context for legislation
 */
export async function fetchPoliticalContextForLegislation(
  jurisdictionName?: string,
  chamber?: string
): Promise<PoliticalContext> {
  if (!jurisdictionName) {
    return {};
  }

  try {
    const chamberMakeup = await fetchChamberMakeup(jurisdictionName);
    if (!chamberMakeup) {
      return {};
    }

    return generatePoliticalContext(chamberMakeup, chamber);
  } catch (error) {
    console.error('Error fetching political context:', error);
    return {};
  }
}
