export interface StateVotingPowerData {
  name: string;
  abbreviation: string;
  population: number;
  houseSeats: number;
  senateSeats: number;
  houseVotingPower: number; // Population per House seat
  senateVotingPower: number; // Population per Senate seat
}

// 2024 U.S. State Population and Congressional Representation Data
export const stateVotingPowerData: Record<string, StateVotingPowerData> = {
  'AL': {
    name: 'Alabama',
    abbreviation: 'AL',
    population: 5197720,
    houseSeats: 7,
    senateSeats: 2,
    houseVotingPower: 742531.4,
    senateVotingPower: 2598860
  },
  'AK': {
    name: 'Alaska',
    abbreviation: 'AK',
    population: 743756,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 743756,
    senateVotingPower: 371878
  },
  'AZ': {
    name: 'Arizona',
    abbreviation: 'AZ',
    population: 7691740,
    houseSeats: 9,
    senateSeats: 2,
    houseVotingPower: 854637.8,
    senateVotingPower: 3845870
  },
  'AR': {
    name: 'Arkansas',
    abbreviation: 'AR',
    population: 3107240,
    houseSeats: 4,
    senateSeats: 2,
    houseVotingPower: 776810,
    senateVotingPower: 1553620
  },
  'CA': {
    name: 'California',
    abbreviation: 'CA',
    population: 39663800,
    houseSeats: 53,
    senateSeats: 2,
    houseVotingPower: 748562.3,
    senateVotingPower: 19831900
  },
  'CO': {
    name: 'Colorado',
    abbreviation: 'CO',
    population: 6013650,
    houseSeats: 7,
    senateSeats: 2,
    houseVotingPower: 859092.9,
    senateVotingPower: 3006825
  },
  'CT': {
    name: 'Connecticut',
    abbreviation: 'CT',
    population: 3707120,
    houseSeats: 5,
    senateSeats: 2,
    houseVotingPower: 741424,
    senateVotingPower: 1853560
  },
  'DE': {
    name: 'Delaware',
    abbreviation: 'DE',
    population: 1067410,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 1067410,
    senateVotingPower: 533705
  },
  'FL': {
    name: 'Florida',
    abbreviation: 'FL',
    population: 23839600,
    houseSeats: 27,
    senateSeats: 2,
    houseVotingPower: 882948.1,
    senateVotingPower: 11919800
  },
  'GA': {
    name: 'Georgia',
    abbreviation: 'GA',
    population: 11297300,
    houseSeats: 14,
    senateSeats: 2,
    houseVotingPower: 806950,
    senateVotingPower: 5648650
  },
  'HI': {
    name: 'Hawaii',
    abbreviation: 'HI',
    population: 1450900,
    houseSeats: 2,
    senateSeats: 2,
    houseVotingPower: 725450,
    senateVotingPower: 725450
  },
  'ID': {
    name: 'Idaho',
    abbreviation: 'ID',
    population: 2032120,
    houseSeats: 2,
    senateSeats: 2,
    houseVotingPower: 1016060,
    senateVotingPower: 1016060
  },
  'IL': {
    name: 'Illinois',
    abbreviation: 'IL',
    population: 12778100,
    houseSeats: 18,
    senateSeats: 2,
    houseVotingPower: 709894.4,
    senateVotingPower: 6389050
  },
  'IN': {
    name: 'Indiana',
    abbreviation: 'IN',
    population: 6968420,
    houseSeats: 9,
    senateSeats: 2,
    houseVotingPower: 774268.9,
    senateVotingPower: 3484210
  },
  'IA': {
    name: 'Iowa',
    abbreviation: 'IA',
    population: 3264560,
    houseSeats: 4,
    senateSeats: 2,
    houseVotingPower: 816140,
    senateVotingPower: 1632280
  },
  'KS': {
    name: 'Kansas',
    abbreviation: 'KS',
    population: 2989710,
    houseSeats: 4,
    senateSeats: 2,
    houseVotingPower: 747427.5,
    senateVotingPower: 1494855
  },
  'KY': {
    name: 'Kentucky',
    abbreviation: 'KY',
    population: 4626150,
    houseSeats: 6,
    senateSeats: 2,
    houseVotingPower: 771025,
    senateVotingPower: 2313075
  },
  'LA': {
    name: 'Louisiana',
    abbreviation: 'LA',
    population: 4607410,
    houseSeats: 6,
    senateSeats: 2,
    houseVotingPower: 767901.7,
    senateVotingPower: 2303705
  },
  'ME': {
    name: 'Maine',
    abbreviation: 'ME',
    population: 1410380,
    houseSeats: 2,
    senateSeats: 2,
    houseVotingPower: 705190,
    senateVotingPower: 705190
  },
  'MD': {
    name: 'Maryland',
    abbreviation: 'MD',
    population: 6309380,
    houseSeats: 8,
    senateSeats: 2,
    houseVotingPower: 788672.5,
    senateVotingPower: 3154690
  },
  'MA': {
    name: 'Massachusetts',
    abbreviation: 'MA',
    population: 7205770,
    houseSeats: 9,
    senateSeats: 2,
    houseVotingPower: 800641.1,
    senateVotingPower: 3602885
  },
  'MI': {
    name: 'Michigan',
    abbreviation: 'MI',
    population: 10197600,
    houseSeats: 14,
    senateSeats: 2,
    houseVotingPower: 728400,
    senateVotingPower: 5098800
  },
  'MN': {
    name: 'Minnesota',
    abbreviation: 'MN',
    population: 5833250,
    houseSeats: 8,
    senateSeats: 2,
    houseVotingPower: 729156.3,
    senateVotingPower: 2916625
  },
  'MS': {
    name: 'Mississippi',
    abbreviation: 'MS',
    population: 2942920,
    houseSeats: 4,
    senateSeats: 2,
    houseVotingPower: 735730,
    senateVotingPower: 1471460
  },
  'MO': {
    name: 'Missouri',
    abbreviation: 'MO',
    population: 6282890,
    houseSeats: 8,
    senateSeats: 2,
    houseVotingPower: 785361.3,
    senateVotingPower: 3141445
  },
  'MT': {
    name: 'Montana',
    abbreviation: 'MT',
    population: 1143160,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 1143160,
    senateVotingPower: 571580
  },
  'NE': {
    name: 'Nebraska',
    abbreviation: 'NE',
    population: 2023070,
    houseSeats: 3,
    senateSeats: 2,
    houseVotingPower: 674356.7,
    senateVotingPower: 1011535
  },
  'NV': {
    name: 'Nevada',
    abbreviation: 'NV',
    population: 3320570,
    houseSeats: 4,
    senateSeats: 2,
    houseVotingPower: 830142.5,
    senateVotingPower: 1660285
  },
  'NH': {
    name: 'New Hampshire',
    abbreviation: 'NH',
    population: 1415860,
    houseSeats: 2,
    senateSeats: 2,
    houseVotingPower: 707930,
    senateVotingPower: 707930
  },
  'NJ': {
    name: 'New Jersey',
    abbreviation: 'NJ',
    population: 9622060,
    houseSeats: 12,
    senateSeats: 2,
    houseVotingPower: 801838.3,
    senateVotingPower: 4811030
  },
  'NM': {
    name: 'New Mexico',
    abbreviation: 'NM',
    population: 2139350,
    houseSeats: 3,
    senateSeats: 2,
    houseVotingPower: 713116.7,
    senateVotingPower: 1069675
  },
  'NY': {
    name: 'New York',
    abbreviation: 'NY',
    population: 19997100,
    houseSeats: 27,
    senateSeats: 2,
    houseVotingPower: 740633.3,
    senateVotingPower: 9998550
  },
  'NC': {
    name: 'North Carolina',
    abbreviation: 'NC',
    population: 11210900,
    houseSeats: 13,
    senateSeats: 2,
    houseVotingPower: 862376.9,
    senateVotingPower: 5605450
  },
  'ND': {
    name: 'North Dakota',
    abbreviation: 'ND',
    population: 804089,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 804089,
    senateVotingPower: 402044.5
  },
  'OH': {
    name: 'Ohio',
    abbreviation: 'OH',
    population: 11942600,
    houseSeats: 16,
    senateSeats: 2,
    houseVotingPower: 746412.5,
    senateVotingPower: 5971300
  },
  'OK': {
    name: 'Oklahoma',
    abbreviation: 'OK',
    population: 4126900,
    houseSeats: 5,
    senateSeats: 2,
    houseVotingPower: 825380,
    senateVotingPower: 2063450
  },
  'OR': {
    name: 'Oregon',
    abbreviation: 'OR',
    population: 4291090,
    houseSeats: 5,
    senateSeats: 2,
    houseVotingPower: 858218,
    senateVotingPower: 2145545
  },
  'PA': {
    name: 'Pennsylvania',
    abbreviation: 'PA',
    population: 13139800,
    houseSeats: 18,
    senateSeats: 2,
    houseVotingPower: 730544.4,
    senateVotingPower: 6569900
  },
  'RI': {
    name: 'Rhode Island',
    abbreviation: 'RI',
    population: 1121190,
    houseSeats: 2,
    senateSeats: 2,
    houseVotingPower: 560595,
    senateVotingPower: 560595
  },
  'SC': {
    name: 'South Carolina',
    abbreviation: 'SC',
    population: 5569830,
    houseSeats: 7,
    senateSeats: 2,
    houseVotingPower: 795690,
    senateVotingPower: 2784915
  },
  'SD': {
    name: 'South Dakota',
    abbreviation: 'SD',
    population: 931033,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 931033,
    senateVotingPower: 465516.5
  },
  'TN': {
    name: 'Tennessee',
    abbreviation: 'TN',
    population: 7307200,
    houseSeats: 9,
    senateSeats: 2,
    houseVotingPower: 811911.1,
    senateVotingPower: 3653600
  },
  'TX': {
    name: 'Texas',
    abbreviation: 'TX',
    population: 31853800,
    houseSeats: 36,
    senateSeats: 2,
    houseVotingPower: 884827.8,
    senateVotingPower: 15926900
  },
  'UT': {
    name: 'Utah',
    abbreviation: 'UT',
    population: 3564000,
    houseSeats: 4,
    senateSeats: 2,
    houseVotingPower: 891000,
    senateVotingPower: 1782000
  },
  'VT': {
    name: 'Vermont',
    abbreviation: 'VT',
    population: 648278,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 648278,
    senateVotingPower: 324139
  },
  'VA': {
    name: 'Virginia',
    abbreviation: 'VA',
    population: 8887700,
    houseSeats: 11,
    senateSeats: 2,
    houseVotingPower: 808063.6,
    senateVotingPower: 4443850
  },
  'WA': {
    name: 'Washington',
    abbreviation: 'WA',
    population: 8059040,
    houseSeats: 10,
    senateSeats: 2,
    houseVotingPower: 805904,
    senateVotingPower: 4029520
  },
  'WV': {
    name: 'West Virginia',
    abbreviation: 'WV',
    population: 1769460,
    houseSeats: 3,
    senateSeats: 2,
    houseVotingPower: 589820,
    senateVotingPower: 884730
  },
  'WI': {
    name: 'Wisconsin',
    abbreviation: 'WI',
    population: 5991540,
    houseSeats: 8,
    senateSeats: 2,
    houseVotingPower: 748942.5,
    senateVotingPower: 2995770
  },
  'WY': {
    name: 'Wyoming',
    abbreviation: 'WY',
    population: 590169,
    houseSeats: 1,
    senateSeats: 2,
    houseVotingPower: 590169,
    senateVotingPower: 295084.5
  }
};

// Helper function to calculate voting power metrics
export const calculateVotingPowerMetrics = (chamber: 'house' | 'senate') => {
  const votingPowers = Object.values(stateVotingPowerData).map(state => 
    chamber === 'house' ? state.houseVotingPower : state.senateVotingPower
  );
  
  return {
    min: Math.min(...votingPowers),
    max: Math.max(...votingPowers),
    avg: votingPowers.reduce((sum, power) => sum + power, 0) / votingPowers.length,
    median: votingPowers.sort((a, b) => a - b)[Math.floor(votingPowers.length / 2)]
  };
};

// Helper function to get voting power by state abbreviation
export const getStateVotingPower = (stateAbbr: string, chamber: 'house' | 'senate') => {
  const stateData = stateVotingPowerData[stateAbbr];
  if (!stateData) return null;
  
  return {
    state: stateData.name,
    abbreviation: stateData.abbreviation,
    population: stateData.population,
    seats: chamber === 'house' ? stateData.houseSeats : stateData.senateSeats,
    votingPower: chamber === 'house' ? stateData.houseVotingPower : stateData.senateVotingPower,
    powerPerPerson: 1 / (chamber === 'house' ? stateData.houseVotingPower : stateData.senateVotingPower)
  };
};