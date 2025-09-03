"use client";

import {useEffect, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useSearchParams} from "next/navigation";
import dynamic from "next/dynamic";
import {Calendar, FileText, Map, MessageSquare, Vote} from "lucide-react";
import {AddressSearch} from "./AddressSearch";
import {VotingInfo} from "./VotingInfo";
import {PublicHearings} from "./PublicHearings";
import {BallotInformation} from "./BallotInformation";
import {MessageGenerator} from "./MessageGenerator";
import {RepresentativesResults} from "./RepresentativesResults";
import {ApiResponse, Representative} from "@/types/representative";
import {AddressSuggestion, STATE_COORDINATES, STATE_MAP} from "@/types/geo";
import {getStateAbbrFromString, getStateAbbreviation} from "@/lib/locationUtils";

// Dynamically import the map component to avoid SSR issues
const RepresentativesMap = dynamic(() => import('./RepresentativesMap').then(mod => ({default: mod.RepresentativesMap})), {
    ssr: false,
    loading: () => <div
        className="w-full h-80 bg-muted animate-pulse rounded-lg flex items-center justify-center">Loading map...</div>
});


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

// Helper to generate a user-friendly error message
function getErrorMessage(error: unknown): string {
    const defaultMessage = 'Unable to find representatives for this address.';
    if (!(error instanceof Error)) {
        return defaultMessage;
    }

    const msg = error.message.toLowerCase();
    if (msg.includes('fetch failed') || msg.includes('enotfound') || msg.includes('networkerror') || msg.includes('getaddrinfo')) {
        return 'The representative lookup service is currently unavailable due to a third-party outage. Please try again later or contact support if the issue persists.';
    }
    if (msg.includes('service temporarily unavailable')) {
        return 'The representative lookup service is temporarily unavailable. Please try again later or contact support if the issue persists.';
    }
    if (msg.includes('configuration')) {
        return 'Service configuration issue. Please contact support.';
    }
    if (msg.includes('unable to determine state')) {
        return 'Please enter a complete address including the state (e.g., "123 Main St, New York, NY").';
    }
    if (msg.includes('no representative data found') || msg.includes('api rate limits')) {
        return error.message;
    }
    return error.message || defaultMessage;
}

// Helper to handle non-OK API responses
async function handleApiResponseError(response: Response, context: string): Promise<never> {
    let errorMessage = `Failed to fetch representatives for ${context}`;
    try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;

        if (response.status === 503) {
            errorMessage = 'Service temporarily unavailable. This may be due to missing API configuration or database connection issues.';
        } else if (response.status === 500) {
            errorMessage = `Unable to fetch representative data for ${context}. This might be due to API rate limits or configuration issues. Please try again in a few minutes.`;
        } else if (response.status === 404) {
            errorMessage = `No representative data found for ${context}. This state may not be available in our data source.`;
        } else if (response.status === 400) {
            errorMessage = `Invalid request for ${context}. Please try a different location.`;
        }
    } catch (parseError) {
        console.error('Error parsing error response:', parseError);
    }
    throw new Error(errorMessage);
}


export function RepresentativesFinder() {
    const [representatives, setRepresentatives] = useState<Representative[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dataSource, setDataSource] = useState<'cache' | 'api' | null>(null);
    const [userLocation, setUserLocation] = useState<AddressSuggestion | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [closestReps, setClosestReps] = useState<Representative[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    // New pagination state
    const [showAllMode, setShowAllMode] = useState(false);
    const [pagination, setPagination] = useState<ApiResponse['pagination'] | undefined>(undefined);
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
        setShowAllMode(false);
        setPagination(undefined);
        setCurrentPage(1);


        try {
            let apiUrl;
            let stateName = '';
            for (const fullName of Object.keys(STATE_MAP)) {
                if (location.display_name.includes(fullName)) {
                    stateName = fullName;
                    break;
                }
            }

            if (location.lat && location.lon && location.lat !== 0 && location.lon !== 0) {
                apiUrl = `/api/civic?lat=${location.lat}&lng=${location.lon}`;
                if (stateName) apiUrl += `&stateName=${encodeURIComponent(stateName)}`;
            } else {
                const stateAbbr = getStateAbbreviation(location);
                if (!stateAbbr) {
                    throw new Error('Unable to determine state from the selected address.');
                }
                apiUrl = `/api/civic?address=${encodeURIComponent(stateAbbr)}`;
                if (stateName) apiUrl += `&stateName=${encodeURIComponent(stateName)}`;
            }

            const response = await fetch(apiUrl);

            if (!response.ok) {
                const stateAbbr = getStateAbbreviation(location);
                const context = (location.lat && location.lon) ? `${location.lat},${location.lon}` : stateAbbr || '';
                await handleApiResponseError(response, context);
            }

            const data: ApiResponse = await response.json();
            let reps = data.representatives || [];
            if (data.districts) setDistricts(data.districts);

            if (reps.length > 0) {
                // console.log('First rep jurisdiction:', reps[0].jurisdiction);
                // console.log('Sample reps:', reps.slice(0, 3).map(r => ({ name: r.name, jurisdiction: r.jurisdiction })));
            }

            // Calculate distances and add coordinates for representatives
            if (reps.length > 0 && location.lat !== 0 && location.lon !== 0) {
                reps = reps.map((rep) => {
                    // Use actual representative office locations when available
                    let repLat: number;
                    let repLon: number;

                    const stateAbbrev = getStateAbbreviation(location);

                    if (stateAbbrev && STATE_COORDINATES[stateAbbrev]) {
                        const capitol = STATE_COORDINATES[stateAbbrev];
                        repLat = capitol[0];
                        repLon = capitol[1];
                    } else {
                        const fallbackVariation = 0.1;
                        repLat = location.lat + (Math.random() - 0.5) * fallbackVariation;
                        repLon = location.lon + (Math.random() - 0.5) * fallbackVariation;
                    }

                    const distance = calculateDistance(location.lat, location.lon, repLat, repLon);

                    return {
                        ...rep,
                        office: rep.office ?? '',
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
            setPagination(data.pagination || undefined);

        } catch (err) {
            console.error('Error fetching representatives:', err);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    // New function to fetch paginated representatives
    const fetchPaginatedRepresentatives = async (location: AddressSuggestion, page: number = 1) => {
        setLoading(true);
        setError(null);

        try {
            const stateAbbr = getStateAbbreviation(location);
            if (!stateAbbr) {
                throw new Error("Unable to determine state from the selected address.");
            }

            const params = new URLSearchParams({
                address: stateAbbr.toUpperCase(), // Ensure we use the state abbreviation
                showAll: 'true',
                page: page.toString(),
                pageSize: '10'
            });

            const response = await fetch(`/api/civic?${params}`);

            if (!response.ok) {
                await handleApiResponseError(response, stateAbbr);
            }

            const data: ApiResponse = await response.json();

            setRepresentatives(data.representatives || []);
            setDataSource(data.source);
            setPagination(data.pagination || undefined);
            setCurrentPage(page);

        } catch (err) {
            console.error('Error fetching paginated representatives:', err);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleAddressSelect = (suggestion: AddressSuggestion) => {
        setUserLocation(suggestion);
        void fetchRepresentatives(suggestion);
    };

    const handleManualSearch = (query: string) => {
        const state = getStateAbbrFromString(query);

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
        void fetchRepresentatives(manualLocation);
    };

    // Pagination handlers
    const handleShowAllToggle = async () => {
        if (!userLocation) return;

        if (!showAllMode) {
            // Switch to "Show All" mode
            setShowAllMode(true);

            try {
                await fetchPaginatedRepresentatives(userLocation, 1);
            } catch (error) {
                if (error instanceof Error &&
                    (error.message.includes('No representative data found') ||
                        error.message.includes('No cached data available'))) {
                    setError(null);
                    setShowAllMode(false);
                    try {
                        await fetchRepresentatives(userLocation);
                        setShowAllMode(true);
                        await fetchPaginatedRepresentatives(userLocation, 1);
                    } catch (freshDataError) {
                        console.error('Failed to fetch fresh data:', freshDataError);
                        setShowAllMode(false);
                        throw freshDataError;
                    }
                } else {
                    setShowAllMode(false);
                    throw error;
                }
            }
        } else {
            // Switch back to proximity mode
            setShowAllMode(false);
            setPagination(undefined);
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

    // Handle URL parameter for state selection
    const searchParams = useSearchParams();
    useEffect(() => {
        const addressParam = searchParams.get('address');
        const stateParam = searchParams.get('state');
        const stateAbbrParam = searchParams.get('stateAbbr');

        if (addressParam) {
            // Handle the JSON-encoded address parameter (existing functionality)
            try {
                const parsedAddress = JSON.parse(decodeURIComponent(addressParam));
                setUserLocation(parsedAddress);
                void fetchRepresentatives(parsedAddress);
            } catch (error) {
                console.error('Error parsing address from URL:', error);
            }
        } else if (stateParam || stateAbbrParam) {
            // Handle simple state parameters from InteractiveMap
            const stateName = stateParam ? decodeURIComponent(stateParam) : null;
            const stateAbbr = stateAbbrParam || (stateName ? STATE_MAP[stateName] : null);

            if (stateAbbr) {
                const stateLocation: AddressSuggestion = {
                    id: `state-${stateAbbr}`,
                    display_name: stateName || stateAbbr,
                    address: {
                        state: stateAbbr
                    },
                    lat: 0,
                    lon: 0,
                    importance: 1,
                    type: 'state',
                    class: 'state'
                };

                setUserLocation(stateLocation);
                setShowMap(false); // Don't show map for state-only searches
                void fetchRepresentatives(stateLocation);
            }
        }
    }, [searchParams]);

    return (
        <>
            <div className="max-w-lg mx-auto">
                <AddressSearch
                    onAddressSelect={handleAddressSelect}
                    onSearch={handleManualSearch}
                    disabled={loading}
                    placeholder="Start typing your address or zip code..."
                />
            </div>
            <AnimatePresence>
                {showMap && userLocation && userLocation.lat !== 0 && userLocation.lon !== 0 && closestReps.length > 0 && (
                    <motion.div
                        className="space-y-4 mt-6"
                        initial={{opacity: 0, y: 20}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.5, ease: "easeInOut"}}
                    >
                        <div className="flex items-center gap-2">
                            <Map className="h-5 w-5 text-primary"/>
                            <h4 className="font-semibold">Interactive Map - District Boundaries</h4>
                        </div>
                        <RepresentativesMap
                            center={[userLocation.lat, userLocation.lon]}
                            zoom={10}
                            representatives={userLocation.lat !== 0 && userLocation.lon !== 0 ? closestReps.map(rep => ({
                                ...rep,
                                office: rep.office ?? '',
                                party: rep.party ?? ''
                            })) : []}
                            userLocation={[userLocation.lat, userLocation.lon]}
                            districts={districts}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            <RepresentativesResults
                representatives={representatives}
                closestReps={closestReps}
                loading={loading}
                error={error}
                showMap={showMap}
                userLocation={userLocation}
                dataSource={dataSource}
                pagination={pagination}
                onPageChange={handlePageChange}
            />
            <motion.div
                className="mt-8 border-t pt-6"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.5, delay: 0.2, ease: "easeInOut"}}
            >
                <h4 className="font-semibold mb-2 text-lg">Other</h4>
                <p className="text-sm text-muted-foreground mb-4">Quick access to other civic information.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        className={`p-3 border rounded-lg transition-colors text-left opacity-60 cursor-not-allowed`}
                        disabled
                    >
                        <h5 className="font-medium flex items-center">
                            <Vote className="mr-2 h-5 w-5 text-primary"/>
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
                            <Calendar className="mr-2 h-5 w-5 text-primary"/>
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
                            <FileText className="mr-2 h-5 w-5 text-primary"/>
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
                            <MessageSquare className="mr-2 h-5 w-5 text-primary"/>
                            Generate Message to Legislator
                        </h5>
                        <p className="text-xs text-muted-foreground">Create personalized messages</p>
                    </button>
                </div>
            </motion.div>
            <AnimatePresence mode="wait">
                {activeCivicTool && (
                    <motion.div
                        key={activeCivicTool}
                        className="mt-6 overflow-hidden"
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: "auto"}}
                        exit={{opacity: 0, height: 0}}
                        transition={{duration: 0.4, ease: "easeInOut"}}
                    >
                        {activeCivicTool === 'voting' && (
                            <VotingInfo
                                userLocation={{
                                    state: userLocation?.address?.state,
                                    city: userLocation?.address?.city,
                                }}
                                onClose={() => setActiveCivicTool(null)}
                            />
                        )}
                        {activeCivicTool === 'hearings' && (
                            <PublicHearings
                                userLocation={{
                                    state: userLocation?.address?.state,
                                    city: userLocation?.address?.city,
                                    county: userLocation?.address?.state, // Fallback to state if no county
                                }}
                                onClose={() => setActiveCivicTool(null)}
                            />
                        )}
                        {activeCivicTool === 'ballot' && (
                            <BallotInformation
                                userLocation={{
                                    state: userLocation?.address?.state,
                                    city: userLocation?.address?.city,
                                    county: userLocation?.address?.state, // Fallback to state if no county
                                }}
                                onClose={() => setActiveCivicTool(null)}
                            />
                        )}
                        {activeCivicTool === 'message' && (
                            <MessageGenerator
                                representatives={displayedRepresentatives}
                                userLocation={{
                                    state: userLocation?.address?.state,
                                    city: userLocation?.address?.city,
                                }}
                                onClose={() => setActiveCivicTool(null)}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
