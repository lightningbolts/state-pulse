export interface StateVotingPowerData {
  name: string;
  abbreviation: string;
  population: number;
  houseSeats: number;
  senateSeats: number;
  // houseVotingPower and senateVotingPower derived dynamically
}

// 2024 U.S. State Population and Congressional Representation Data
export const stateVotingPowerData: Record<string, StateVotingPowerData> = {
  'AL': { name: 'Alabama', abbreviation: 'AL', population: 5210397, houseSeats: 7, senateSeats: 2 },
  'AK': { name: 'Alaska', abbreviation: 'AK', population: 757142, houseSeats: 1, senateSeats: 2 },
  'AZ': { name: 'Arizona', abbreviation: 'AZ', population: 7689153, houseSeats: 9, senateSeats: 2 },
  'AR': { name: 'Arkansas', abbreviation: 'AR', population: 3095333, houseSeats: 4, senateSeats: 2 },
  'CA': { name: 'California', abbreviation: 'CA', population: 39643911, houseSeats: 52, senateSeats: 2 },
  'CO': { name: 'Colorado', abbreviation: 'CO', population: 6080968, houseSeats: 8, senateSeats: 2 },
  'CT': { name: 'Connecticut', abbreviation: 'CT', population: 3677204, houseSeats: 5, senateSeats: 2 },
  'DE': { name: 'Delaware', abbreviation: 'DE', population: 1059409, houseSeats: 1, senateSeats: 2 },
  'FL': { name: 'Florida', abbreviation: 'FL', population: 23787709, houseSeats: 28, senateSeats: 2 },
  'GA': { name: 'Georgia', abbreviation: 'GA', population: 11301044, houseSeats: 14, senateSeats: 2 },
  'HI': { name: 'Hawaii', abbreviation: 'HI', population: 1455519, houseSeats: 2, senateSeats: 2 },
  'ID': { name: 'Idaho', abbreviation: 'ID', population: 2026499, houseSeats: 2, senateSeats: 2 },
  'IL': { name: 'Illinois', abbreviation: 'IL', population: 12691254, houseSeats: 17, senateSeats: 2 },
  'IN': { name: 'Indiana', abbreviation: 'IN', population: 6993183, houseSeats: 9, senateSeats: 2 },
  'IA': { name: 'Iowa', abbreviation: 'IA', population: 3240567, houseSeats: 4, senateSeats: 2 },
  'KS': { name: 'Kansas', abbreviation: 'KS', population: 2983975, houseSeats: 4, senateSeats: 2 },
  'KY': { name: 'Kentucky', abbreviation: 'KY', population: 4610881, houseSeats: 6, senateSeats: 2 },
  'LA': { name: 'Louisiana', abbreviation: 'LA', population: 4625919, houseSeats: 6, senateSeats: 2 },
  'ME': { name: 'Maine', abbreviation: 'ME', population: 1417274, houseSeats: 2, senateSeats: 2 },
  'MD': { name: 'Maryland', abbreviation: 'MD', population: 6284534, houseSeats: 8, senateSeats: 2 },
  'MA': { name: 'Massachusetts', abbreviation: 'MA', population: 7170960, houseSeats: 9, senateSeats: 2 },
  'MI': { name: 'Michigan', abbreviation: 'MI', population: 10151522, houseSeats: 13, senateSeats: 2 },
  'MN': { name: 'Minnesota', abbreviation: 'MN', population: 5805357, houseSeats: 8, senateSeats: 2 },
  'MS': { name: 'Mississippi', abbreviation: 'MS', population: 2934533, houseSeats: 4, senateSeats: 2 },
  'MO': { name: 'Missouri', abbreviation: 'MO', population: 6249472, houseSeats: 8, senateSeats: 2 },
  'MT': { name: 'Montana', abbreviation: 'MT', population: 1146659, houseSeats: 2, senateSeats: 2 },
  'NE': { name: 'Nebraska', abbreviation: 'NE', population: 2011409, houseSeats: 3, senateSeats: 2 },
  'NV': { name: 'Nevada', abbreviation: 'NV', population: 3323578, houseSeats: 4, senateSeats: 2 },
  'NH': { name: 'New Hampshire', abbreviation: 'NH', population: 1416045, houseSeats: 2, senateSeats: 2 },
  'NJ': { name: 'New Jersey', abbreviation: 'NJ', population: 9506817, houseSeats: 12, senateSeats: 2 },
  'NM': { name: 'New Mexico', abbreviation: 'NM', population: 2139301, houseSeats: 3, senateSeats: 2 },
  'NY': { name: 'New York', abbreviation: 'NY', population: 19951753, houseSeats: 26, senateSeats: 2 },
  'NC': { name: 'North Carolina', abbreviation: 'NC', population: 11183982, houseSeats: 14, senateSeats: 2 },
  'ND': { name: 'North Dakota', abbreviation: 'ND', population: 807111, houseSeats: 1, senateSeats: 2 },
  'OH': { name: 'Ohio', abbreviation: 'OH', population: 11861942, houseSeats: 15, senateSeats: 2 },
  'OK': { name: 'Oklahoma', abbreviation: 'OK', population: 4126776, houseSeats: 5, senateSeats: 2 },
  'OR': { name: 'Oregon', abbreviation: 'OR', population: 4292148, houseSeats: 6, senateSeats: 2 },
  'PA': { name: 'Pennsylvania', abbreviation: 'PA', population: 13097488, houseSeats: 17, senateSeats: 2 },
  'RI': { name: 'Rhode Island', abbreviation: 'RI', population: 1112920, houseSeats: 2, senateSeats: 2 },
  'SC': { name: 'South Carolina', abbreviation: 'SC', population: 5596200, houseSeats: 7, senateSeats: 2 },
  'SD': { name: 'South Dakota', abbreviation: 'SD', population: 931814, houseSeats: 1, senateSeats: 2 },
  'TN': { name: 'Tennessee', abbreviation: 'TN', population: 7292739, houseSeats: 9, senateSeats: 2 },
  'TX': { name: 'Texas', abbreviation: 'TX', population: 31892028, houseSeats: 38, senateSeats: 2 },
  'UT': { name: 'Utah', abbreviation: 'UT', population: 3551870, houseSeats: 4, senateSeats: 2 },
  'VT': { name: 'Vermont', abbreviation: 'VT', population: 649759, houseSeats: 1, senateSeats: 2 },
  'VA': { name: 'Virginia', abbreviation: 'VA', population: 8829506, houseSeats: 11, senateSeats: 2 },
  'WA': { name: 'Washington', abbreviation: 'WA', population: 8057087, houseSeats: 10, senateSeats: 2 },
  'WV': { name: 'West Virginia', abbreviation: 'WV', population: 1766830, houseSeats: 2, senateSeats: 2 },
  'WI': { name: 'Wisconsin', abbreviation: 'WI', population: 5956835, houseSeats: 8, senateSeats: 2 },
  'WY': { name: 'Wyoming', abbreviation: 'WY', population: 594584, houseSeats: 1, senateSeats: 2 }
};

// Helper function to calculate voting power metrics
export const calculateVotingPowerMetrics = (chamber: 'house' | 'senate') => {
  const votingPowers = Object.values(stateVotingPowerData).map(state => {
    return chamber === 'house'
      ? state.population / state.houseSeats
      : state.population / state.senateSeats;
  });
  
  const sorted = votingPowers.slice().sort((a, b) => a - b);
  return {
    min: Math.min(...votingPowers),
    max: Math.max(...votingPowers),
    avg: votingPowers.reduce((sum, p) => sum + p, 0) / votingPowers.length,
    median: sorted[Math.floor(sorted.length / 2)]
  };
};

// Helper function to get voting power by state abbreviation
export const getStateVotingPower = (stateAbbr: string, chamber: 'house' | 'senate') => {
  const state = stateVotingPowerData[stateAbbr];
  if (!state) return null;

  const seats = chamber === 'house' ? state.houseSeats : state.senateSeats;
  const vp = chamber === 'house' ? state.population / state.houseSeats : state.population / state.senateSeats;

  return {
    state: state.name,
    abbreviation: state.abbreviation,
    population: state.population,
    seats,
    votingPower: vp,
    powerPerPerson: 1 / vp
  };
};