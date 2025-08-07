// State abbreviation to name mapping
export const STATE_NAMES: Record<string, string> = {
    'AL': 'Alabama',
    'AK': 'Alaska',
    'AZ': 'Arizona',
    'AR': 'Arkansas',
    'CA': 'California',
    'CO': 'Colorado',
    'CT': 'Connecticut',
    'DE': 'Delaware',
    'DC': 'District of Columbia',
    'FL': 'Florida',
    'GA': 'Georgia',
    'HI': 'Hawaii',
    'ID': 'Idaho',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'KY': 'Kentucky',
    'LA': 'Louisiana',
    'ME': 'Maine',
    'MD': 'Maryland',
    'MA': 'Massachusetts',
    'MI': 'Michigan',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'NE': 'Nebraska',
    'NV': 'Nevada',
    'NH': 'New Hampshire',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NY': 'New York',
    'NC': 'North Carolina',
    'ND': 'North Dakota',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'PA': 'Pennsylvania',
    'RI': 'Rhode Island',
    'SC': 'South Carolina',
    'SD': 'South Dakota',
    'TN': 'Tennessee',
    'TX': 'Texas',
    'UT': 'Utah',
    'VT': 'Vermont',
    'VA': 'Virginia',
    'WA': 'Washington',
    'WV': 'West Virginia',
    'WI': 'Wisconsin',
    'WY': 'Wyoming',
    'US': 'United States Congress'
};

export const STATE_MAP: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
};

// State coordinates for map visualization - using state capitals
export const STATE_COORDINATES: Record<string, [number, number]> = {
    'AL': [32.3617, -86.2792], // Montgomery
    'AK': [58.3019, -134.4197], // Juneau
    'AZ': [33.4484, -112.0740], // Phoenix
    'AR': [34.7465, -92.2896], // Little Rock
    'CA': [38.5816, -121.4944], // Sacramento
    'CO': [39.7392, -104.9903], // Denver
    'CT': [41.7658, -72.6734], // Hartford
    'DE': [39.1612, -75.5264], // Dover
    'DC': [38.9072, -77.0369], // Washington DC
    'FL': [30.4518, -84.27277], // Tallahassee
    'GA': [33.7490, -84.3880], // Atlanta
    'HI': [21.3099, -157.8581], // Honolulu
    'ID': [43.6150, -116.2023], // Boise
    'IL': [39.7817, -89.6501], // Springfield
    'IN': [39.7904, -86.1477], // Indianapolis
    'IA': [41.5868, -93.6250], // Des Moines
    'KS': [39.0473, -95.6890], // Topeka
    'KY': [38.2009, -84.8733], // Frankfort
    'LA': [30.4515, -91.1871], // Baton Rouge
    'ME': [44.3106, -69.7795], // Augusta
    'MD': [38.9729, -76.5012], // Annapolis
    'MA': [42.2352, -71.0275], // Boston
    'MI': [42.3540, -84.9555], // Lansing
    'MN': [44.9537, -93.0900], // Saint Paul
    'MS': [32.3617, -90.2070], // Jackson
    'MO': [38.5767, -92.1735], // Jefferson City
    'MT': [46.5958, -112.0270], // Helena
    'NE': [40.8136, -96.7026], // Lincoln
    'NV': [39.1638, -119.7674], // Carson City
    'NH': [43.2081, -71.5376], // Concord
    'NJ': [40.2206, -74.7563], // Trenton
    'NM': [35.6870, -105.9378], // Santa Fe
    'NY': [42.6526, -73.7562], // Albany
    'NC': [35.7796, -78.6382], // Raleigh
    'ND': [46.8083, -100.7837], // Bismarck
    'OH': [39.9612, -82.9988], // Columbus
    'OK': [35.4676, -97.5164], // Oklahoma City
    'OR': [44.9778, -123.0351], // Salem
    'PA': [40.2737, -76.8844], // Harrisburg
    'RI': [41.8240, -71.4128], // Providence
    'SC': [34.0000, -81.0348], // Columbia
    'SD': [44.2998, -100.3510], // Pierre
    'TN': [36.1627, -86.7816], // Nashville
    'TX': [30.2672, -97.7431], // Austin
    'UT': [40.7608, -111.8910], // Salt Lake City
    'VT': [44.2601, -72.5806], // Montpelier
    'VA': [37.5407, -77.4360], // Richmond
    'WA': [47.0379, -122.9015], // Olympia
    'WV': [38.3498, -81.6326], // Charleston
    'WI': [43.0642, -89.4012], // Madison
    'WY': [41.1400, -104.8197], // Cheyenne
    'US': [38.8899, -77.0091] // Capitol Hill, Washington DC
};

export const validStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC'
    ];

export interface MapProps {
    center: [number, number];
    zoom: number;
    representatives: Array<{
        id: string;
        name: string;
        office: string;
        party: string;
        lat?: number;
        lon?: number;
        distance?: number;
    }>;
    userLocation?: [number, number];
}

export interface AddressSuggestion {
    id: string;
    display_name: string;
    address: {
        house_number?: string;
        road?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
    };
    lat: number;
    lon: number;
    importance: number;
    type: string;
    class: string;
}

export interface AddressSearchProps {
    onAddressSelect: (suggestion: AddressSuggestion) => void;
    onSearch: (query: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export interface MapMode {
    id: string;
    label: string;
    description: string;
    icon: any;
}