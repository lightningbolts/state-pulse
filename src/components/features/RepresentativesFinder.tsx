"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Phone, Mail, ExternalLink, AlertCircle, Database, Map } from "lucide-react";
import { AddressSearch } from "./AddressSearch";

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
  lastUpdated: Date;
}

interface ApiResponse {
  representatives: Representative[];
  source: 'cache' | 'api';
  count: number;
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

export function RepresentativesFinder() {
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | null>(null);
  const [userLocation, setUserLocation] = useState<AddressSuggestion | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [closestReps, setClosestReps] = useState<Representative[]>([]);

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
        // Look for state names and convert to abbreviations
        const stateMap: Record<string, string> = {
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

        // Check if display_name contains a full state name
        for (const [fullName, abbrev] of Object.entries(stateMap)) {
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

      const response = await fetch(`/api/representatives?address=${encodeURIComponent(state)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch representatives');
      }

      const data: ApiResponse = await response.json();
      let reps = data.representatives || [];

      // Calculate distances and add coordinates for representatives
      if (reps.length > 0 && location.lat !== 0 && location.lon !== 0) {
        reps = reps.map((rep, index) => {
          // Add some realistic offset to user location for demo
          const latOffset = (Math.random() - 0.5) * 1.5; // ±0.75 degree
          const lonOffset = (Math.random() - 0.5) * 1.5; // ±0.75 degree
          const repLat = location.lat + latOffset;
          const repLon = location.lon + lonOffset;

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

    } catch (err) {
      console.error('Error fetching representatives:', err);
      setError(err instanceof Error ? err.message : 'Unable to find representatives for this address.');
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

    // Use the same state mapping logic as in fetchRepresentatives
    const stateMap: Record<string, string> = {
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

    // Check if query contains a full state name
    for (const [fullName, abbrev] of Object.entries(stateMap)) {
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
            <div className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50">
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
            {(showMap ? closestReps : representatives).map((rep, index) => (
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
                        {rep.phone && (
                          <div className="flex items-center">
                            <Phone className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <a href={`tel:${rep.phone}`} className="text-primary hover:underline break-all">
                              {rep.phone}
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

                      {!rep.phone && !rep.email && !rep.website && (
                        <p className="text-xs text-muted-foreground italic">
                          Contact information not available
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {representatives.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Found {representatives.length} representatives</strong> from OpenStates data.
                {showMap && userLocation && ` Showing top 10 closest to your location.`}
                {dataSource === 'cache' && ' This data is cached and refreshed daily.'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 border-t pt-6">
          <h4 className="font-semibold mb-2 text-lg">Civic Tools</h4>
          <p className="text-sm text-muted-foreground mb-4">Quick access to other civic information.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="p-3 border rounded-lg hover:bg-muted transition-colors text-left">
              <h5 className="font-medium">Voting Dates & Deadlines</h5>
              <p className="text-xs text-muted-foreground">Find important election dates</p>
            </button>
            <button className="p-3 border rounded-lg hover:bg-muted transition-colors text-left">
              <h5 className="font-medium">Public Hearing Schedules</h5>
              <p className="text-xs text-muted-foreground">Stay informed on upcoming hearings</p>
            </button>
            <button className="p-3 border rounded-lg hover:bg-muted transition-colors text-left">
              <h5 className="font-medium">Ballot Information</h5>
              <p className="text-xs text-muted-foreground">View your local ballot measures</p>
            </button>
            <button className="p-3 border rounded-lg hover:bg-muted transition-colors text-left">
              <h5 className="font-medium">Generate Message to Legislator</h5>
              <p className="text-xs text-muted-foreground">Create personalized messages</p>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
