"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Phone, Mail, ExternalLink, AlertCircle, Database, Map, Info, Calendar, FileText, MessageSquare, Vote } from "lucide-react";
import { AddressSearch } from "./AddressSearch";
import { VotingInfo } from "./VotingInfo";
import { PublicHearings } from "./PublicHearings";
import { BallotInformation } from "./BallotInformation";
import { MessageGenerator } from "./MessageGenerator";

// Dynamically import the map component to avoid SSR issues
const RepresentativesMap = dynamic(() => import('./RepresentativesMap').then(mod => ({ default: mod.RepresentativesMap })), {
  ssr: false,
  loading: () => <div className="w-full h-80 bg-muted animate-pulse rounded-lg flex items-center justify-center">Loading map...</div>
});

interface Representative {
  id: string;
  name: string;
  party: string;
  office: string;
  district?: string;
  jurisdiction: string;
  phone?: string;
  email?: string;
  website?: string;
  photo?: string;
  lat?: number;
  lon?: number;
  distance?: number;
  addresses?: Array<{
    type: string;
    address: string;
    phone?: string;
    fax?: string;
  }>;
  lastUpdated: Date;
}

interface ApiResponse {
  representatives: Representative[];
  source: 'cache' | 'api';
  count?: number;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface AddressSuggestion {
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

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// State name to abbreviation mapping - centralized constant
const STATE_MAP: Record<string, string> = {
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

export function RepresentativesFinder() {
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | null>(null);
  const [userLocation, setUserLocation] = useState<AddressSuggestion | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [closestReps, setClosestReps] = useState<Representative[]>([]);
  // New pagination state
  const [showAllMode, setShowAllMode] = useState(false);
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Civic tools state
  const [activeCivicTool, setActiveCivicTool] = useState<'voting' | 'hearings' | 'ballot' | 'message' | null>(null);

  // Computed value for currently displayed representatives
  const displayedRepresentatives = showAllMode ? representatives : (showMap ? closestReps : representatives);

  const fetchRepresentatives = async (location: AddressSuggestion) => {
    setLoading(true);
    setError(null);
    setRepresentatives([]);
    setClosestReps([]);

    try {
      // Extract state from the selected address - prioritize the structured address data
      let state = location.address.state;

      // If no structured state, try to extract from display_name
      if (!state) {
        // Check if display_name contains a full state name
        for (const [fullName, abbrev] of Object.entries(STATE_MAP)) {
          if (location.display_name.includes(fullName)) {
            state = abbrev;
            break;
          }
        }

        // Last resort: try to find 2-letter state code in display_name
        if (!state) {
          const stateMatch = location.display_name.match(/\b([A-Z]{2})\b/);
          if (stateMatch) {
            state = stateMatch[1];
          }
        }
      }

      if (!state) {
        throw new Error('Unable to determine state from the selected address.');
      }

      // Convert full state name to abbreviation if needed
      const finalState = STATE_MAP[state] || state;

      console.log('Searching for representatives in state:', finalState, 'for location:', location.display_name);

      const response = await fetch(`/api/representatives?address=${encodeURIComponent(finalState)}`);

      if (!response.ok) {
        let errorMessage = 'Failed to fetch representatives';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;

          // Provide more specific error messages based on status
          if (response.status === 503) {
            errorMessage = 'Service temporarily unavailable. This may be due to missing API configuration or database connection issues.';
          } else if (response.status === 500) {
            errorMessage = `Unable to fetch representative data for ${finalState}. This might be due to API rate limits or configuration issues. Please try again in a few minutes.`;
          } else if (response.status === 404) {
            errorMessage = `No representative data found for ${finalState}. This state may not be available in our data source.`;
          } else if (response.status === 400) {
            errorMessage = `Invalid request for ${finalState}. Please try a different location.`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }

        throw new Error(errorMessage);
      }

      const data: ApiResponse = await response.json();
      let reps = data.representatives || [];

      console.log('Received representatives:', reps.length, 'for state:', finalState);
      if (reps.length > 0) {
        console.log('First rep jurisdiction:', reps[0].jurisdiction);
        console.log('Sample reps:', reps.slice(0, 3).map(r => ({ name: r.name, jurisdiction: r.jurisdiction })));
      }

      // Calculate distances and add coordinates for representatives
      if (reps.length > 0 && location.lat !== 0 && location.lon !== 0) {
        reps = reps.map((rep, index) => {
          // Use actual representative office locations when available
          let repLat: number;
          let repLon: number;

          // Get accurate coordinates based on state and office type
          const stateCapitols: Record<string, { lat: number; lon: number }> = {
            'WA': { lat: 47.0379, lon: -122.9015 }, // Olympia, WA
            'CA': { lat: 38.5767, lon: -121.4934 }, // Sacramento, CA
            'NY': { lat: 42.3584, lon: -73.7781 }, // Albany, NY
            'TX': { lat: 30.2672, lon: -97.7431 }, // Austin, TX
            'FL': { lat: 30.4518, lon: -84.27277 }, // Tallahassee, FL
            'OH': { lat: 39.9612, lon: -82.9988 }, // Columbus, OH
            'IL': { lat: 39.7817, lon: -89.6501 }, // Springfield, IL
            'PA': { lat: 40.269789, lon: -76.875613 }, // Harrisburg, PA
            'MI': { lat: 42.354558, lon: -84.955255 }, // Lansing, MI
            'GA': { lat: 33.76, lon: -84.39 }, // Atlanta, GA
            'NC': { lat: 35.771, lon: -78.638 }, // Raleigh, NC
            'NJ': { lat: 40.221, lon: -74.756 }, // Trenton, NJ
            'VA': { lat: 37.54, lon: -77.46 }, // Richmond, VA
            'MA': { lat: 42.2352, lon: -71.0275 }, // Boston, MA
            'IN': { lat: 39.790, lon: -86.147 }, // Indianapolis, IN
            'AZ': { lat: 33.448457, lon: -112.073844 }, // Phoenix, AZ
            'TN': { lat: 36.165, lon: -86.784 }, // Nashville, TN
            'MO': { lat: 38.572954, lon: -92.189283 }, // Jefferson City, MO
            'MD': { lat: 38.972945, lon: -76.501157 }, // Annapolis, MD
            'WI': { lat: 43.074722, lon: -89.384444 }, // Madison, WI
            'MN': { lat: 44.95, lon: -93.094 }, // Saint Paul, MN
            'CO': { lat: 39.739236, lon: -104.990251 }, // Denver, CO
            'AL': { lat: 32.361538, lon: -86.279118 }, // Montgomery, AL
            'SC': { lat: 34.000, lon: -81.035 }, // Columbia, SC
            'LA': { lat: 30.45809, lon: -91.140229 }, // Baton Rouge, LA
            'KY': { lat: 38.197274, lon: -84.86311 }, // Frankfort, KY
            'OR': { lat: 44.931109, lon: -123.029159 }, // Salem, OR
            'OK': { lat: 35.482309, lon: -97.534994 }, // Oklahoma City, OK
            'CT': { lat: 41.767, lon: -72.677 }, // Hartford, CT
            'UT': { lat: 40.777477, lon: -111.888237 }, // Salt Lake City, UT
            'IA': { lat: 41.590939, lon: -93.620866 }, // Des Moines, IA
            'NV': { lat: 39.161921, lon: -119.767409 }, // Carson City, NV
            'AR': { lat: 34.736009, lon: -92.331122 }, // Little Rock, AR
            'MS': { lat: 32.320, lon: -90.207 }, // Jackson, MS
            'KS': { lat: 39.04, lon: -95.69 }, // Topeka, KS
            'NM': { lat: 35.667231, lon: -105.964575 }, // Santa Fe, NM
            'NE': { lat: 40.809868, lon: -96.675345 }, // Lincoln, NE
            'WV': { lat: 38.349497, lon: -81.633294 }, // Charleston, WV
            'ID': { lat: 43.613739, lon: -116.237651 }, // Boise, ID
            'HI': { lat: 21.30895, lon: -157.826182 }, // Honolulu, HI
            'NH': { lat: 43.220093, lon: -71.549896 }, // Concord, NH
            'ME': { lat: 44.323535, lon: -69.765261 }, // Augusta, ME
            'RI': { lat: 41.82355, lon: -71.422132 }, // Providence, RI
            'MT': { lat: 46.595805, lon: -112.027031 }, // Helena, MT
            'DE': { lat: 39.161921, lon: -75.526755 }, // Dover, DE
            'SD': { lat: 44.367966, lon: -100.336378 }, // Pierre, SD
            'ND': { lat: 46.813343, lon: -100.779004 }, // Bismarck, ND
            'AK': { lat: 58.301935, lon: -134.419740 }, // Juneau, AK
            'VT': { lat: 44.26639, lon: -72.580536 }, // Montpelier, VT
            'WY': { lat: 41.145548, lon: -104.802042 }, // Cheyenne, WY
            'DC': { lat: 38.9072, lon: -77.0369 } // Washington, DC
          };

          // Use the state we searched for instead of trying to parse from jurisdiction
          const stateAbbrev = state;

          // Convert full state name to abbreviation if needed
          const finalStateAbbrev = STATE_MAP[stateAbbrev] || stateAbbrev;

          console.log('State for coordinates:', stateAbbrev, '-> Final abbrev:', finalStateAbbrev, 'Available in stateCapitols:', !!stateCapitols[finalStateAbbrev]);

          if (finalStateAbbrev && stateCapitols[finalStateAbbrev]) {
            const capitol = stateCapitols[finalStateAbbrev];
            console.log('Using capitol coordinates for', finalStateAbbrev, ':', capitol);

            // Place all representatives at the state capitol
            repLat = capitol.lat;
            repLon = capitol.lon;
          } else {
            console.log('Fallback: No state found or not in capitol list. State:', stateAbbrev, 'Final:', finalStateAbbrev);
            // Fallback: use user location with small offset if state not found
            const fallbackVariation = 0.1;
            repLat = location.lat + (Math.random() - 0.5) * fallbackVariation;
            repLon = location.lon + (Math.random() - 0.5) * fallbackVariation;
          }

          const distance = calculateDistance(location.lat, location.lon, repLat, repLon);

          return {
            ...rep,
            lat: repLat,
            lon: repLon,
            distance
          };
        });

        // Sort by distance and get top 10
        const sortedByDistance = [...reps].sort((a, b) => (a.distance || 0) - (b.distance || 0));
        setClosestReps(sortedByDistance.slice(0, 10));
        setShowMap(true);
      }

      setRepresentatives(reps);
      setDataSource(data.source);
      setPagination(data.pagination || null);

    } catch (err) {
      console.error('Error fetching representatives:', err);

      // Provide user-friendly error messages
      let userMessage = 'Unable to find representatives for this address.';

      if (err instanceof Error) {
        if (err.message.includes('Service temporarily unavailable')) {
          userMessage = 'The representative lookup service is temporarily unavailable. Please try again later or contact support if the issue persists.';
        } else if (err.message.includes('API rate limits')) {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (err.message.includes('configuration')) {
          userMessage = 'Service configuration issue. Please contact support.';
        } else if (err.message.includes('Unable to determine state')) {
          userMessage = 'Please enter a complete address including the state (e.g., "123 Main St, New York, NY").';
        } else if (err.message.includes('No representative data found')) {
          userMessage = err.message;
        } else {
          userMessage = err.message;
        }
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  // New function to fetch paginated representatives
  const fetchPaginatedRepresentatives = async (location: AddressSuggestion, page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      let state = location.address.state;

      // Extract state logic (same as before)
      if (!state) {
        // Check if display_name contains a full state name
        for (const [fullName, abbrev] of Object.entries(STATE_MAP)) {
          if (location.display_name.includes(fullName)) {
            state = abbrev;
            break;
          }
        }

        // Last resort: try to find 2-letter state code in display_name
        if (!state) {
          const stateMatch = location.display_name.match(/\b([A-Z]{2})\b/);
          if (stateMatch) {
            state = stateMatch[1];
          }
        }
      }

      if (!state) {
        throw new Error('Unable to determine state from the selected address.');
      }

      // Convert full state name to abbreviation if needed
      const finalState = STATE_MAP[state] || state;

      console.log('Fetching paginated representatives for state:', finalState, 'page:', page);

      // Build API URL with pagination parameters - ALWAYS use state abbreviation
      const params = new URLSearchParams({
        address: finalState.toUpperCase(), // Ensure we use the state abbreviation
        showAll: 'true',
        page: page.toString(),
        pageSize: '10'
      });

      const response = await fetch(`/api/representatives?${params}`);

      if (!response.ok) {
        let errorMessage = 'Failed to fetch representatives';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;

          // Provide more specific error messages based on status
          if (response.status === 503) {
            errorMessage = 'Service temporarily unavailable. This may be due to missing API configuration or database connection issues.';
          } else if (response.status === 500) {
            errorMessage = `Unable to fetch representative data for ${finalState}. This might be due to API rate limits or configuration issues. Please try again in a few minutes.`;
          } else if (response.status === 404) {
            errorMessage = `No representative data found for ${finalState}. This state may not be available in our data source.`;
          } else if (response.status === 400) {
            errorMessage = `Invalid request for ${finalState}. Please try a different location.`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }

        throw new Error(errorMessage);
      }

      const data: ApiResponse = await response.json();

      console.log('Received paginated data:', data.representatives?.length, 'representatives, source:', data.source);

      setRepresentatives(data.representatives || []);
      setDataSource(data.source);
      setPagination(data.pagination || null);
      setCurrentPage(page);

    } catch (err) {
      console.error('Error fetching paginated representatives:', err);

      // Provide user-friendly error messages
      let userMessage = 'Unable to find representatives for this address.';

      if (err instanceof Error) {
        if (err.message.includes('Service temporarily unavailable')) {
          userMessage = 'The representative lookup service is temporarily unavailable. Please try again later or contact support if the issue persists.';
        } else if (err.message.includes('API rate limits')) {
          userMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (err.message.includes('configuration')) {
          userMessage = 'Service configuration issue. Please contact support.';
        } else if (err.message.includes('Unable to determine state')) {
          userMessage = 'Please enter a complete address including the state (e.g., "123 Main St, New York, NY").';
        } else if (err.message.includes('No representative data found')) {
          userMessage = err.message;
        } else {
          userMessage = err.message;
        }
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    setUserLocation(suggestion);
    fetchRepresentatives(suggestion);
  };

  const handleManualSearch = (query: string) => {
    // Create a location object for manual search with improved state extraction
    let state: string | undefined;

    // Check if query contains a full state name
    for (const [fullName, abbrev] of Object.entries(STATE_MAP)) {
      if (query.toLowerCase().includes(fullName.toLowerCase())) {
        state = abbrev;
        break;
      }
    }

    // If no full state name found, try to find 2-letter state code
    if (!state) {
      const stateMatch = query.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        state = stateMatch[1];
      }
    }

    const manualLocation: AddressSuggestion = {
      id: 'manual',
      display_name: query,
      address: {
        state: state
      },
      lat: 0,
      lon: 0,
      importance: 0,
      type: 'manual',
      class: 'manual'
    };

    setUserLocation(manualLocation);
    setShowMap(false); // Don't show map for manual searches without coordinates
    fetchRepresentatives(manualLocation);
  };

  // Pagination handlers
  const handleShowAllToggle = async () => {
    if (!userLocation) return;

    if (!showAllMode) {
      // Switch to "Show All" mode
      setShowAllMode(true);

      // First, try to fetch paginated data from cache
      try {
        await fetchPaginatedRepresentatives(userLocation, 1);
      } catch (error) {
        console.log('Error during pagination attempt:', error);

        // If cached data is not available, fetch fresh data first
        if (error instanceof Error &&
            (error.message.includes('No representative data found') ||
             error.message.includes('No cached data available'))) {
          console.log('No cached data for pagination, fetching fresh data first...');

          // Reset error state
          setError(null);

          // Temporarily switch back to non-paginated mode to fetch fresh data
          setShowAllMode(false);

          try {
            // Fetch fresh data (this will cache it)
            await fetchRepresentatives(userLocation);

            // Now switch back to show all mode and try pagination again
            setShowAllMode(true);
            await fetchPaginatedRepresentatives(userLocation, 1);
          } catch (freshDataError) {
            console.error('Failed to fetch fresh data:', freshDataError);
            // Reset to non-paginated mode if fresh data fetch fails
            setShowAllMode(false);
            throw freshDataError;
          }
        } else {
          // For other errors, reset to non-paginated mode
          setShowAllMode(false);
          throw error;
        }
      }
    } else {
      // Switch back to proximity mode
      setShowAllMode(false);
      setPagination(null);
      setCurrentPage(1);
      await fetchRepresentatives(userLocation); // This will show proximity-based results
    }
  };

  const handlePageChange = async (page: number) => {
    if (!userLocation || !pagination) return;

    const newPage = Math.min(Math.max(page, 1), pagination.totalPages);
    if (newPage !== currentPage) {
      await fetchPaginatedRepresentatives(userLocation, newPage);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <Users className="mr-3 h-7 w-7" />
          Find Your Representatives
        </CardTitle>
        <CardDescription>
          Start typing your address for instant suggestions, or enter a zip code to find your closest state representatives with an interactive map.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dynamic Address Search */}
        <div className="max-w-lg mx-auto">
          <AddressSearch
            onAddressSelect={handleAddressSelect}
            onSearch={handleManualSearch}
            disabled={loading}
            placeholder="Start typing your address or zip code..."
          />
        </div>

        {/* Map Section */}
        {showMap && userLocation && userLocation.lat !== 0 && userLocation.lon !== 0 && closestReps.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Map className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Interactive Map - Top 10 Closest Representatives</h4>
            </div>
            <RepresentativesMap
              center={[userLocation.lat, userLocation.lon]}
              zoom={10}
              representatives={closestReps}
              userLocation={[userLocation.lat, userLocation.lon]}
            />
          </div>
        )}

        {/* Results Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold">
              {showMap ? 'Top 10 Closest Representatives:' : 'Your State Representatives:'}
            </h4>
            {dataSource && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Database className="mr-1 h-3 w-3" />
                {dataSource === 'cache' ? 'From cache' : 'Fresh data'}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center p-4 mb-4 text-sm text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="flex-shrink-0 w-4 h-4 mr-2" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-sm text-muted-foreground">Finding your representatives...</p>
            </div>
          )}

          {!loading && !error && representatives.length === 0 && !userLocation && (
            <div className="text-center py-12">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Start by entering your address</h3>
              <p className="text-sm text-muted-foreground">
                Type your address in the search box above to see instant suggestions and find your representatives.
              </p>
            </div>
          )}

          {!loading && !error && representatives.length === 0 && userLocation && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No representatives found for this location. Please try a different address.
            </p>
          )}

          <div className="space-y-4">
            {(showAllMode ? representatives : (showMap ? closestReps : representatives)).map((rep, index) => (
              <Card key={rep.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {rep.photo && (
                      <img
                        src={rep.photo}
                        alt={rep.name}
                        className="w-16 h-16 rounded-full object-cover flex-shrink-0 mx-auto md:mx-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-lg break-words">{rep.name}</h5>
                          {showMap && rep.distance && (
                            <Badge variant="secondary" className="text-xs">
                              #{index + 1} - {rep.distance.toFixed(1)} mi
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="w-fit mt-1 md:mt-0">
                          {rep.party}
                        </Badge>
                      </div>

                      <p className="text-sm font-medium text-primary mb-2">
                        {rep.office}
                        {rep.district && ` - ${rep.district}`}
                      </p>

                      <p className="text-xs text-muted-foreground mb-3">
                        {rep.jurisdiction}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {rep.addresses && rep.addresses.length > 0 && rep.addresses[0].phone && (
                          <div className="flex items-center">
                            <Phone className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`tel:${rep.addresses[0].phone}`} className="text-primary hover:underline break-all">
                              {rep.addresses[0].phone}
                            </a>
                          </div>
                        )}

                        {rep.email && (
                          <div className="flex items-center">
                            <Mail className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`mailto:${rep.email}`} className="text-primary hover:underline break-all">
                              {rep.email}
                            </a>
                          </div>
                        )}

                        {rep.website && (
                          <div className="flex items-center md:col-span-2">
                            <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a
                              href={rep.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline break-all"
                            >
                              Official Website
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Address Information */}
                      {rep.addresses && rep.addresses.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border">
                          <h6 className="text-sm font-medium text-muted-foreground mb-2">Office Addresses</h6>
                          <div className="space-y-3">
                            {rep.addresses.map((office, idx) => (
                              <div key={idx} className="text-sm">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                                      {office.type}
                                    </div>
                                    <div className="text-sm leading-relaxed">
                                      {office.address}
                                    </div>
                                    {(office.phone || office.fax) && (
                                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                        {office.phone && (
                                          <div className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            <a href={`tel:${office.phone}`} className="text-primary hover:underline">
                                              {office.phone}
                                            </a>
                                          </div>
                                        )}
                                        {office.fax && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Fax:</span>
                                            {office.fax}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          </div>

          {representatives.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Found {pagination ? pagination.total : representatives.length} representatives</strong> from OpenStates data.
                  {showMap && userLocation && ` Showing top 10 closest to your location.`}
                  {dataSource === 'cache' && ' This data is cached and refreshed daily.'}
                </p>
              </div>

              {/* Show All Toggle Button - Always visible when we have representatives */}
              {userLocation && (
                <div className="flex justify-center">
                  <button
                    onClick={handleShowAllToggle}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {showAllMode ? 'Show Closest Representatives' : 'Show All State Representatives'}
                  </button>
                </div>
              )}

              {/* Pagination Controls */}
              {pagination && showAllMode && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} representatives
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev || loading}
                      className="px-3 py-1 text-sm rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext || loading}
                      className="px-3 py-1 text-sm rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 border-t pt-6">
          <h4 className="font-semibold mb-2 text-lg">Civic Tools</h4>
          <p className="text-sm text-muted-foreground mb-4">Quick access to other civic information.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              className={`p-3 border rounded-lg transition-colors text-left opacity-60 cursor-not-allowed`}
              disabled
            >
              <h5 className="font-medium flex items-center">
                <Vote className="mr-2 h-5 w-5 text-primary" />
                Voting Dates & Deadlines
                <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
              </h5>
              <p className="text-xs text-muted-foreground">Find important election dates</p>
            </button>
            <button
              className={`p-3 border rounded-lg transition-colors text-left opacity-60 cursor-not-allowed`}
              disabled
            >
              <h5 className="font-medium flex items-center">
                <Calendar className="mr-2 h-5 w-5 text-primary" />
                Public Hearing Schedules
                <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
              </h5>
              <p className="text-xs text-muted-foreground">Stay informed on upcoming hearings</p>
            </button>
            <button
              className={`p-3 border rounded-lg transition-colors text-left opacity-60 cursor-not-allowed`}
              disabled
            >
              <h5 className="font-medium flex items-center">
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Ballot Information
                <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
              </h5>
              <p className="text-xs text-muted-foreground">View your local ballot measures</p>
            </button>
            <button
              className={`p-3 border rounded-lg hover:bg-muted transition-colors text-left ${activeCivicTool === 'message' ? 'bg-muted border-primary' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveCivicTool(activeCivicTool === 'message' ? null : 'message');
              }}
            >
              <h5 className="font-medium flex items-center">
                <MessageSquare className="mr-2 h-5 w-5 text-primary" />
                Generate Message to Legislator
              </h5>
              <p className="text-xs text-muted-foreground">Create personalized messages</p>
            </button>
          </div>
        </div>

        {/* Civic Tools Components */}
        {activeCivicTool === 'voting' && (
          <div className="mt-6">
            <VotingInfo
              userLocation={{
                state: userLocation?.address?.state,
                city: userLocation?.address?.city,
              }}
              onClose={() => setActiveCivicTool(null)}
            />
          </div>
        )}

        {activeCivicTool === 'hearings' && (
          <div className="mt-6">
            <PublicHearings
              userLocation={{
                state: userLocation?.address?.state,
                city: userLocation?.address?.city,
                county: userLocation?.address?.state, // Fallback to state if no county
              }}
              onClose={() => setActiveCivicTool(null)}
            />
          </div>
        )}

        {activeCivicTool === 'ballot' && (
          <div className="mt-6">
            <BallotInformation
              userLocation={{
                state: userLocation?.address?.state,
                city: userLocation?.address?.city,
                county: userLocation?.address?.state, // Fallback to state if no county
              }}
              onClose={() => setActiveCivicTool(null)}
            />
          </div>
        )}

        {activeCivicTool === 'message' && (
          <div className="mt-6">
            <MessageGenerator
              representatives={displayedRepresentatives}
              userLocation={{
                state: userLocation?.address?.state,
                city: userLocation?.address?.city,
              }}
              onClose={() => setActiveCivicTool(null)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
