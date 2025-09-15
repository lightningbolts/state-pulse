import { NextRequest, NextResponse } from 'next/server';
import { stateVotingPowerData, calculateVotingPowerMetrics } from '@/data/statePopulations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chamber = searchParams.get('chamber') as 'house' | 'senate' || 'house';
    
    // Validate chamber parameter
    if (chamber !== 'house' && chamber !== 'senate') {
      return NextResponse.json(
        { success: false, error: 'Invalid chamber parameter. Must be "house" or "senate".' },
        { status: 400 }
      );
    }

    // Calculate voting power data for all states
    const votingPowerByState: Record<string, {
      name: string;
      abbreviation: string;
      population: number;
      seats: number;
      votingPower: number; // Population per seat
      normalizedPower: number; // Normalized 0-1 for visualization
      relativeToMaryland: number; // Relative power compared to Maryland
    }> = {};

    // Use Maryland as the baseline reference (1.0x)
    const marylandData = stateVotingPowerData['MD'];
    const marylandVotingPower = chamber === 'house' ? marylandData.houseVotingPower : marylandData.senateVotingPower;
    
    // First pass: Calculate all relative powers to find the actual range
    const relativeToMarylandValues: Record<string, number> = {};
    Object.entries(stateVotingPowerData).forEach(([abbr, stateData]) => {
      const votingPower = chamber === 'house' ? stateData.houseVotingPower : stateData.senateVotingPower;
      // Calculate relative power compared to Maryland
      // Higher votingPower value = more people per seat = less power per person
      // Lower votingPower value = fewer people per seat = more power per person
      relativeToMarylandValues[abbr] = marylandVotingPower / votingPower;
    });

    // Find the actual min and max relative power values
    const allRelativeValues = Object.values(relativeToMarylandValues);
    const sortedRelatives = allRelativeValues.sort((a, b) => a - b);
    
    // Use percentile-based normalization for better color distribution
    // This ensures colors are spread more evenly across states rather than clustered
    const getPercentileNormalization = (value: number): number => {
      // Find where this value ranks among all values
      let rank = 0;
      for (const v of sortedRelatives) {
        if (v < value) rank++;
        else break;
      }
      
      // Convert rank to 0-1 scale
      return rank / Math.max(sortedRelatives.length - 1, 1);
    };

    // Second pass: Process each state with percentile-based normalization
    Object.entries(stateVotingPowerData).forEach(([abbr, stateData]) => {
      const votingPower = chamber === 'house' ? stateData.houseVotingPower : stateData.senateVotingPower;
      const seats = chamber === 'house' ? stateData.houseSeats : stateData.senateSeats;
      const relativeToMaryland = relativeToMarylandValues[abbr];
      
      // Use percentile-based normalization for better color distribution
      // This spreads colors evenly across states regardless of value clustering
      const normalizedPower = getPercentileNormalization(relativeToMaryland);
      
      votingPowerByState[abbr] = {
        name: stateData.name,
        abbreviation: abbr,
        population: stateData.population,
        seats: seats,
        votingPower: Math.round(votingPower),
        normalizedPower: normalizedPower,
        relativeToMaryland: relativeToMaryland // Add this for reference
      };
    });

    // Calculate summary statistics
    const allVotingPowers = Object.values(votingPowerByState).map(s => s.votingPower);
    const summary = {
      chamber,
      totalStates: Object.keys(votingPowerByState).length,
      metrics: {
        minVotingPower: Math.min(...allVotingPowers),
        maxVotingPower: Math.max(...allVotingPowers),
        avgVotingPower: Math.round(allVotingPowers.reduce((sum, power) => sum + power, 0) / allVotingPowers.length),
        medianVotingPower: Math.round(allVotingPowers.sort((a, b) => a - b)[Math.floor(allVotingPowers.length / 2)])
      }
    };

    // Find states with highest and lowest voting power per person
    const sortedStates = Object.values(votingPowerByState).sort((a, b) => a.votingPower - b.votingPower);
    const highlights = {
      mostPowerPerPerson: sortedStates.slice(0, 5).map(s => ({
        state: s.name,
        abbreviation: s.abbreviation,
        peoplePerSeat: s.votingPower
      })),
      leastPowerPerPerson: sortedStates.slice(-5).reverse().map(s => ({
        state: s.name,
        abbreviation: s.abbreviation,
        peoplePerSeat: s.votingPower
      }))
    };

    const response = {
      success: true,
      data: votingPowerByState,
      summary,
      highlights,
      metadata: {
        chamber,
        description: chamber === 'house' 
          ? 'House of Representatives voting power (population per representative)'
          : 'Senate voting power (population per senator)',
        lastUpdated: '2024-12-01T00:00:00.000Z',
        source: 'U.S. Census Bureau 2024 Population Estimates & World Population Review'
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error in voting power API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate voting power data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}