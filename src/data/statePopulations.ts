export interface StateVotingPowerData {
  name: string;
  abbreviation: string;
  population: number;
  houseSeats: number;
  senateSeats: number;
  houseVotingPower: number;
  senateVotingPower: number;
}

// 2024 U.S. State Population and Congressional Representation Data
export const stateVotingPowerData: Record<string, StateVotingPowerData> = {
  'AL': { name: 'Alabama', abbreviation: 'AL', population: 5210397, houseSeats: 7, senateSeats: 2, houseVotingPower: 744342.4, senateVotingPower: 2605198.5 },
  'AK': { name: 'Alaska', abbreviation: 'AK', population: 757142, houseSeats: 1, senateSeats: 2, houseVotingPower: 757142, senateVotingPower: 378571 },
  'AZ': { name: 'Arizona', abbreviation: 'AZ', population: 7689153, houseSeats: 9, senateSeats: 2, houseVotingPower: 854350.3, senateVotingPower: 3844576.5 },
  'AR': { name: 'Arkansas', abbreviation: 'AR', population: 3095333, houseSeats: 4, senateSeats: 2, houseVotingPower: 773833.3, senateVotingPower: 1547666.5 },
  'CA': { name: 'California', abbreviation: 'CA', population: 39643911, houseSeats: 52, senateSeats: 2, houseVotingPower: 762383.3, senateVotingPower: 19821955.5 },
  'CO': { name: 'Colorado', abbreviation: 'CO', population: 6080968, houseSeats: 8, senateSeats: 2, houseVotingPower: 760121, senateVotingPower: 3040484 },
  'CT': { name: 'Connecticut', abbreviation: 'CT', population: 3677204, houseSeats: 5, senateSeats: 2, houseVotingPower: 735440.8, senateVotingPower: 1838602 },
  'DE': { name: 'Delaware', abbreviation: 'DE', population: 1059409, houseSeats: 1, senateSeats: 2, houseVotingPower: 1059409, senateVotingPower: 529704.5 },
  'FL': { name: 'Florida', abbreviation: 'FL', population: 23787709, houseSeats: 28, senateSeats: 2, houseVotingPower: 849561.8, senateVotingPower: 11893854.5 },
  'GA': { name: 'Georgia', abbreviation: 'GA', population: 11301044, houseSeats: 14, senateSeats: 2, houseVotingPower: 807217.4, senateVotingPower: 5650522 },
  'HI': { name: 'Hawaii', abbreviation: 'HI', population: 1455519, houseSeats: 2, senateSeats: 2, houseVotingPower: 727759.5, senateVotingPower: 727759.5 },
  'ID': { name: 'Idaho', abbreviation: 'ID', population: 2026499, houseSeats: 2, senateSeats: 2, houseVotingPower: 1013249.5, senateVotingPower: 1013249.5 },
  'IL': { name: 'Illinois', abbreviation: 'IL', population: 12691254, houseSeats: 17, senateSeats: 2, houseVotingPower: 746542.6, senateVotingPower: 6345627 },
  'IN': { name: 'Indiana', abbreviation: 'IN', population: 6993183, houseSeats: 9, senateSeats: 2, houseVotingPower: 777020.3, senateVotingPower: 3496591.5 },
  'IA': { name: 'Iowa', abbreviation: 'IA', population: 3240567, houseSeats: 4, senateSeats: 2, houseVotingPower: 810141.8, senateVotingPower: 1620283.5 },
  'KS': { name: 'Kansas', abbreviation: 'KS', population: 2983975, houseSeats: 4, senateSeats: 2, houseVotingPower: 745993.8, senateVotingPower: 1491987.5 },
  'KY': { name: 'Kentucky', abbreviation: 'KY', population: 4610881, houseSeats: 6, senateSeats: 2, houseVotingPower: 768480.2, senateVotingPower: 2305440.5 },
  'LA': { name: 'Louisiana', abbreviation: 'LA', population: 4625919, houseSeats: 6, senateSeats: 2, houseVotingPower: 770986.5, senateVotingPower: 2312959.5 },
  'ME': { name: 'Maine', abbreviation: 'ME', population: 1417274, houseSeats: 2, senateSeats: 2, houseVotingPower: 708637, senateVotingPower: 708637 },
  'MD': { name: 'Maryland', abbreviation: 'MD', population: 6284534, houseSeats: 8, senateSeats: 2, houseVotingPower: 785566.8, senateVotingPower: 3142267 },
  'MA': { name: 'Massachusetts', abbreviation: 'MA', population: 7170960, houseSeats: 9, senateSeats: 2, houseVotingPower: 796773.3, senateVotingPower: 3585480 },
  'MI': { name: 'Michigan', abbreviation: 'MI', population: 10151522, houseSeats: 13, senateSeats: 2, houseVotingPower: 780885.5, senateVotingPower: 5075761 },
  'MN': { name: 'Minnesota', abbreviation: 'MN', population: 5805357, houseSeats: 8, senateSeats: 2, houseVotingPower: 725669.6, senateVotingPower: 2902678.5 },
  'MS': { name: 'Mississippi', abbreviation: 'MS', population: 2934533, houseSeats: 4, senateSeats: 2, houseVotingPower: 733633.3, senateVotingPower: 1467266.5 },
  'MO': { name: 'Missouri', abbreviation: 'MO', population: 6249472, houseSeats: 8, senateSeats: 2, houseVotingPower: 781184, senateVotingPower: 3124736 },
  'MT': { name: 'Montana', abbreviation: 'MT', population: 1146659, houseSeats: 2, senateSeats: 2, houseVotingPower: 573329.5, senateVotingPower: 573329.5 },
  'NE': { name: 'Nebraska', abbreviation: 'NE', population: 2011409, houseSeats: 3, senateSeats: 2, houseVotingPower: 670469.7, senateVotingPower: 1005704.5 },
  'NV': { name: 'Nevada', abbreviation: 'NV', population: 3323578, houseSeats: 4, senateSeats: 2, houseVotingPower: 830894.5, senateVotingPower: 1661789 },
  'NH': { name: 'New Hampshire', abbreviation: 'NH', population: 1416045, houseSeats: 2, senateSeats: 2, houseVotingPower: 708022.5, senateVotingPower: 708022.5 },
  'NJ': { name: 'New Jersey', abbreviation: 'NJ', population: 9506817, houseSeats: 12, senateSeats: 2, houseVotingPower: 792234.8, senateVotingPower: 4753408.5 },
  'NM': { name: 'New Mexico', abbreviation: 'NM', population: 2139301, houseSeats: 3, senateSeats: 2, houseVotingPower: 713100.3, senateVotingPower: 1069650.5 },
  'NY': { name: 'New York', abbreviation: 'NY', population: 19951753, houseSeats: 26, senateSeats: 2, houseVotingPower: 767374.3, senateVotingPower: 9975876.5 },
  'NC': { name: 'North Carolina', abbreviation: 'NC', population: 11183982, houseSeats: 14, senateSeats: 2, houseVotingPower: 798856.6, senateVotingPower: 5591991 },
  'ND': { name: 'North Dakota', abbreviation: 'ND', population: 807111, houseSeats: 1, senateSeats: 2, houseVotingPower: 807111, senateVotingPower: 403555.5 },
  'OH': { name: 'Ohio', abbreviation: 'OH', population: 11861942, houseSeats: 15, senateSeats: 2, houseVotingPower: 790796.1, senateVotingPower: 5930971 },
  'OK': { name: 'Oklahoma', abbreviation: 'OK', population: 4126776, houseSeats: 5, senateSeats: 2, houseVotingPower: 825355.2, senateVotingPower: 2063388 },
  'OR': { name: 'Oregon', abbreviation: 'OR', population: 4292148, houseSeats: 6, senateSeats: 2, houseVotingPower: 715358, senateVotingPower: 2146074 },
  'PA': { name: 'Pennsylvania', abbreviation: 'PA', population: 13097488, houseSeats: 17, senateSeats: 2, houseVotingPower: 770441.6, senateVotingPower: 6548744 },
  'RI': { name: 'Rhode Island', abbreviation: 'RI', population: 1112920, houseSeats: 2, senateSeats: 2, houseVotingPower: 556460, senateVotingPower: 556460 },
  'SC': { name: 'South Carolina', abbreviation: 'SC', population: 5596200, houseSeats: 7, senateSeats: 2, houseVotingPower: 799457.1, senateVotingPower: 2798100 },
  'SD': { name: 'South Dakota', abbreviation: 'SD', population: 931814, houseSeats: 1, senateSeats: 2, houseVotingPower: 931814, senateVotingPower: 465907 },
  'TN': { name: 'Tennessee', abbreviation: 'TN', population: 7292739, houseSeats: 9, senateSeats: 2, houseVotingPower: 810304.3, senateVotingPower: 3646369.5 },
  'TX': { name: 'Texas', abbreviation: 'TX', population: 31892028, houseSeats: 38, senateSeats: 2, houseVotingPower: 839263.4, senateVotingPower: 15946014 },
  'UT': { name: 'Utah', abbreviation: 'UT', population: 3551870, houseSeats: 4, senateSeats: 2, houseVotingPower: 887967.5, senateVotingPower: 1775935 },
  'VT': { name: 'Vermont', abbreviation: 'VT', population: 649759, houseSeats: 1, senateSeats: 2, houseVotingPower: 649759, senateVotingPower: 324879.5 },
  'VA': { name: 'Virginia', abbreviation: 'VA', population: 8829506, houseSeats: 11, senateSeats: 2, houseVotingPower: 802682.4, senateVotingPower: 4414753 },
  'WA': { name: 'Washington', abbreviation: 'WA', population: 8057087, houseSeats: 10, senateSeats: 2, houseVotingPower: 805708.7, senateVotingPower: 4028543.5 },
  'WV': { name: 'West Virginia', abbreviation: 'WV', population: 1766830, houseSeats: 2, senateSeats: 2, houseVotingPower: 883415, senateVotingPower: 883415 },
  'WI': { name: 'Wisconsin', abbreviation: 'WI', population: 5956835, houseSeats: 8, senateSeats: 2, houseVotingPower: 744604.4, senateVotingPower: 2978417.5 },
  'WY': { name: 'Wyoming', abbreviation: 'WY', population: 594584, houseSeats: 1, senateSeats: 2, houseVotingPower: 594584, senateVotingPower: 297292 }
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