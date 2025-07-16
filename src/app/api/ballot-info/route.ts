import { NextRequest, NextResponse } from 'next/server';
import { BallotMeasure, Candidate } from '@/types/ballot';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const county = searchParams.get('county');

    // In a real implementation, this would fetch from election officials' APIs
    // For now, we'll return mock data with realistic ballot information
    const { measures, candidates } = generateMockBallotData(state, city, county);

    return NextResponse.json({
      measures,
      candidates,
      source: 'mock',
      location: { state, city, county }
    });

  } catch (error) {
    console.error('Error fetching ballot information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ballot information' },
      { status: 500 }
    );
  }
}

function generateMockBallotData(state?: string | null, city?: string | null, county?: string | null) {
  const measures: BallotMeasure[] = [
    {
      id: '1',
      title: 'School Infrastructure Bond',
      type: 'bond',
      number: 'Measure A',
      description: 'Bond measure to fund new school construction and facility improvements',
      summary: 'This measure would authorize $50 million in bonds to build new elementary schools and upgrade existing facilities across the district.',
      supportingArgument: 'Our schools are overcrowded and aging. This investment will provide modern learning environments for our children and create local jobs.',
      opposingArgument: 'The proposed tax increase will burden homeowners during difficult economic times. The district should find ways to prioritize existing resources.',
      fiscalImpact: 'Estimated tax increase of $45 per year per $100,000 of assessed property value for 20 years',
      jurisdiction: `${city || 'Local'} School District`,
      electionDate: '2025-11-04',
      status: 'upcoming'
    },
    {
      id: '2',
      title: 'Transportation Infrastructure Initiative',
      type: 'initiative',
      number: 'Proposition B',
      description: 'Initiative to improve public transportation and road infrastructure',
      summary: 'This measure would fund improvements to bus routes, bike lanes, and road maintenance through a dedicated transportation tax.',
      supportingArgument: 'Better transportation infrastructure will reduce traffic congestion, improve air quality, and boost economic development.',
      opposingArgument: 'This is another tax increase that will disproportionately affect working families. Private solutions should be explored first.',
      fiscalImpact: 'Half-cent sales tax increase, generating approximately $15 million annually',
      jurisdiction: `${county || 'County'} Transportation Authority`,
      electionDate: '2025-11-04',
      status: 'upcoming'
    },
    {
      id: '3',
      title: 'Environmental Protection Ordinance',
      type: 'referendum',
      number: 'Measure C',
      description: 'Referendum on new environmental protection regulations for local businesses',
      summary: 'This measure would implement stricter environmental standards for manufacturing and require environmental impact assessments for new developments.',
      supportingArgument: 'Protecting our environment is crucial for public health and preserving our community for future generations.',
      opposingArgument: 'These regulations could drive businesses away and harm the local economy. Current environmental protections are adequate.',
      fiscalImpact: 'Implementation costs estimated at $2 million annually, funded through permit fees',
      jurisdiction: `${city || 'City'} Council`,
      electionDate: '2025-11-04',
      status: 'upcoming'
    },
    {
      id: '4',
      title: 'Parks and Recreation Funding',
      type: 'proposition',
      number: 'Proposition D',
      description: 'Proposition to increase funding for parks and recreational facilities',
      summary: 'This measure would provide dedicated funding for park maintenance, new playground equipment, and recreational programs.',
      supportingArgument: 'Quality parks and recreation programs improve community health, property values, and quality of life for all residents.',
      opposingArgument: 'Parks funding should come from the general budget, not through additional taxes. Current facilities are adequate.',
      fiscalImpact: 'Property tax increase of $25 per year per $100,000 of assessed value',
      jurisdiction: `${city || 'City'} Parks Department`,
      electionDate: '2025-11-04',
      status: 'upcoming'
    }
  ];

  const candidates: Candidate[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      party: 'Democratic',
      office: `${state || 'State'} Senate District 15`,
      incumbent: false,
      website: 'https://sarahjohnsonforsenate.com',
      bio: 'Former city council member with 8 years of experience in local government. Focused on education funding and healthcare access.'
    },
    {
      id: '2',
      name: 'Michael Chen',
      party: 'Republican',
      office: `${state || 'State'} Senate District 15`,
      incumbent: true,
      website: 'https://michaelchensenate.com',
      bio: 'Incumbent senator serving his second term. Business owner with focus on economic development and fiscal responsibility.'
    },
    {
      id: '3',
      name: 'Maria Rodriguez',
      party: 'Democratic',
      office: `${state || 'State'} Assembly District 42`,
      incumbent: false,
      website: 'https://mariarodriguezforassembly.com',
      bio: 'Community organizer and former school board member. Advocate for affordable housing and environmental protection.'
    },
    {
      id: '4',
      name: 'David Thompson',
      party: 'Republican',
      office: `${state || 'State'} Assembly District 42`,
      incumbent: true,
      website: 'https://davidthompsonassembly.com',
      bio: 'Incumbent assembly member in his third term. Former police officer focused on public safety and infrastructure.'
    },
    {
      id: '5',
      name: 'Jennifer Park',
      party: 'Independent',
      office: `${city || 'City'} Council District 3`,
      incumbent: false,
      website: 'https://jenniferparkforcitycouncil.com',
      bio: 'Small business owner and environmental attorney. Running on a platform of sustainable development and government transparency.'
    },
    {
      id: '6',
      name: 'Robert Williams',
      party: 'Non-partisan',
      office: `${city || 'City'} Council District 3`,
      incumbent: true,
      website: 'https://robertwilliamscitycouncil.com',
      bio: 'Incumbent council member serving his second term. Former teacher focused on education partnerships and neighborhood development.'
    },
    {
      id: '7',
      name: 'Lisa Anderson',
      party: 'Non-partisan',
      office: `${county || 'County'} Board of Education`,
      incumbent: false,
      bio: 'Parent of three public school students and former PTA president. Advocate for special education services and teacher support.'
    },
    {
      id: '8',
      name: 'James Wilson',
      party: 'Non-partisan',
      office: `${county || 'County'} Board of Education`,
      incumbent: true,
      bio: 'Incumbent board member and retired principal. Focused on curriculum standards and educational technology initiatives.'
    }
  ];

  return { measures, candidates };
}
