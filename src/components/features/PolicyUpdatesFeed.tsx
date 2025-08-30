"use client";

import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bookmark, MapPin, Plus, Search, X } from "lucide-react";
import { BookmarkButton, BookmarksContext } from "@/components/features/BookmarkButton";
import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { STATE_MAP } from "@/types/geo";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import PolicyUpdateCard from "@/components/features/PolicyUpdateCard";
import { BROAD_TOPIC_KEYWORDS } from "@/types/legislation";

interface PolicyUpdate {
    id: string;
    title?: string;
    jurisdictionName?: string;
    session?: string;
    subjects?: string[];
    createdAt?: string;
    summary?: string;
    geminiSummary?: string; // Add geminiSummary field
    classification?: string[];
    openstatesUrl?: string;
    latestActionDescription?: string;
    sources?: { url: string; note?: string | null }[];
    sponsors?: { name: string }[];
    lastActionAt?: string | null;
    identifier?: string;
    history?: { date: string; action: string }[];
    firstActionAt?: string | null;
    versions?: { date: string; note?: string; classification?: string | null; links?: any[] }[];
}

// Classification tags (no descriptions)
const CLASSIFICATIONS = [
    { label: "All", value: "" },
    { label: "Bill", value: "bill" },
    { label: "Proposed bill", value: "proposed bill" },
    { label: "Resolution", value: "resolution" },
    { label: "Joint Resolution", value: "joint resolution" },
    { label: "Concurrent Resolution", value: "concurrent resolution" },
    { label: "Amendment", value: "amendment" },
    { label: "House Bill", value: "hr" },
    { label: "Senate Bill", value: "sr" },
    { label: "House Resolution", value: "hres" },
    { label: "Senate Resolution", value: "sres" },
    { label: "Memorial", value: "memorial" },
    { label: "Proclamation", value: "proclamation" },
];

let cardNumber = 20;

// Fetch updates with optional filters and sorting
async function fetchUpdatesFeed({
    skip = 0,
    limit = cardNumber,
    search = "",
    subject = "",
    sortField = "createdAt",
    sortDir = "desc",
    classification = "",
    jurisdictionName = "",
    showCongress = false,
    sponsor = "",
    sponsorId = "",
    showOnlyEnacted = false
}: {
    skip?: number;
    limit?: number;
    search?: string;
    subject?: string;
    sortField?: string;
    sortDir?: string;
    classification?: string;
    jurisdictionName?: string;
    showCongress?: boolean;
    sponsor?: string;
    sponsorId?: string;
    showOnlyEnacted?: boolean;
}) {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    if (search) params.append("search", search);
    if (subject) params.append("subject", subject);

    // Handle Congress vs State filtering - they are mutually exclusive
    if (showCongress) {
        // Instead of just "United States", use a special parameter to indicate we want all Congress sessions
        params.append("showCongress", "true");
    } else if (jurisdictionName) {
        params.append("jurisdictionName", jurisdictionName);
    }

    // Map lastAction to the correct field name for the API
    const apiSortField = sortField === "lastAction" ? "lastActionAt" : sortField;
    if (apiSortField) params.append("sortBy", apiSortField);
    if (sortDir) params.append("sortDir", sortDir);
    if (classification) params.append("classification", classification);
    if (sponsor) params.append("sponsor", sponsor);
    if (sponsorId) params.append("sponsorId", sponsorId);

    // Use the enacted endpoint if filtering for enacted legislation
    const endpoint = showOnlyEnacted ? '/api/legislation/enacted' : '/api/legislation';
    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch updates");

    const responseData = await res.json();

    // Handle both response formats: direct array (regular API) and object with data property (enacted API)
    if (Array.isArray(responseData)) {
        return responseData;
    } else if (responseData.data && Array.isArray(responseData.data)) {
        // Log performance metrics if available
        if (responseData.performance) {
            console.log(`[FEED] API performance: ${responseData.performance.queryDuration}ms, cache hit: ${responseData.performance.cacheHit}`);
        }
        return responseData.data;
    } else {
        console.error('[FEED] Unexpected API response format:', responseData);
        throw new Error("Invalid API response format");
    }
}

export function PolicyUpdatesFeed() {
    const [updates, setUpdates] = useState<PolicyUpdate[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [skip, setSkip] = useState(0);
    const [search, setSearch] = useState("");
    const [subject, setSubject] = useState("");
    const [classification, setClassification] = useState("");
    const [jurisdictionName, setJurisdictionName] = useState("");
    const [showCongress, setShowCongress] = useState(false);
    const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'createdAt', dir: 'desc' });
    const [repFilter, setRepFilter] = useState<string>("");
    const [sponsorId, setSponsorId] = useState<string>("");
    const router = useRouter();
    const [showLoadingText, setShowLoadingText] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
    const [customTags, setCustomTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState("");
    const [showCustomTagInput, setShowCustomTagInput] = useState(false);
    const [showOnlyEnacted, setShowOnlyEnacted] = useState(false);
    const loader = useRef<HTMLDivElement | null>(null);
    const skipRef = useRef(0);
    const loadingRef = useRef(false); // Ref to prevent concurrent loads
    const hasRestored = useRef(false);
    const prevDeps = useRef<{
        search: string,
        subject: string,
        classification: string,
        sort: any,
        jurisdictionName: string
    } | null>(null);

    // Add a ref to track if the page was reloaded
    const wasReloaded = useRef(false);

    // On mount, check navigation type to see if it was a reload
    // useEffect(() => {
    //     const navigationEntries = performance.getEntriesByType("navigation");
    //     if (navigationEntries.length > 0 && (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload') {
    //         console.log('[FEED] Page was reloaded');
    //         wasReloaded.current = true;
    //     }
    // }, []);

    // Access bookmark context
    const { bookmarks, loading: bookmarksLoading } = useContext(BookmarksContext);
    const { user } = useUser();

    // URL parameter handling for state filtering, congress, and rep filtering
    const searchParams = useSearchParams();

    // Handle URL parameters for state filtering
    useEffect(() => {
        const stateParam = searchParams.get('state');
        const stateAbbrParam = searchParams.get('stateAbbr');
        const congressParam = searchParams.get('congress');
        const repParam = searchParams.get('rep');
        const sponsorIdParam = searchParams.get('sponsorId');

        if (sponsorIdParam) {
            setSponsorId(sponsorIdParam);
            setRepFilter("");
            setUpdates([]);
            setSkip(0);
            skipRef.current = 0;
            setHasMore(true);
            setLoading(true);
        } else if (repParam) {
            setRepFilter(repParam);
            setSponsorId("");
            setUpdates([]);
            setSkip(0);
            skipRef.current = 0;
            setHasMore(true);
            setLoading(true);
        } else {
            setRepFilter("");
            setSponsorId("");
        }

        // Existing state and congress logic...
        if (congressParam === 'true') {
            setShowCongress(true);
            setJurisdictionName('');
            setUpdates([]);
            setSkip(0);
            skipRef.current = 0;
            setHasMore(true);
            setLoading(true);
            return;
        }
        if (stateParam || stateAbbrParam) {
            let stateName = stateParam ? decodeURIComponent(stateParam) : null;
            if (stateAbbrParam && !stateName) {
                const abbrToStateName = Object.entries(STATE_MAP).reduce((acc, [fullName, abbr]) => {
                    acc[abbr] = fullName;
                    return acc;
                }, {} as Record<string, string>);
                stateName = abbrToStateName[stateAbbrParam.toUpperCase()] || stateAbbrParam;
            }
            if (stateName && stateName.length === 2 && stateName === stateName.toUpperCase()) {
                const abbrToStateName = Object.entries(STATE_MAP).reduce((acc, [fullName, abbr]) => {
                    acc[abbr] = fullName;
                    return acc;
                }, {} as Record<string, string>);
                const originalStateName = stateName;
                stateName = abbrToStateName[stateName] || stateName;
            }
            if (stateName) {
                setJurisdictionName(stateName);
                setShowCongress(false);
                setUpdates([]);
                setSkip(0);
                skipRef.current = 0;
                setHasMore(true);
                setLoading(true);
            }
        }
    }, [searchParams]);

    const getLastName = (name: string) => name.trim().split(' ').slice(-1)[0];
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMore) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            const currentSkip = skipRef.current;
            // Only use sponsorId for filtering by representative
            const newUpdates = await fetchUpdatesFeed({
                skip: currentSkip,
                limit: 20,
                search,
                subject,
                sortField: sort.field,
                sortDir: sort.dir,
                classification,
                jurisdictionName,
                showCongress,
                sponsorId: sponsorId, // Only send sponsorId, not sponsor name
                showOnlyEnacted
            });
            const filteredNewUpdates = showOnlyBookmarked
                ? newUpdates.filter((update: PolicyUpdate) => bookmarks.includes(update.id))
                : newUpdates;
            if (filteredNewUpdates.length > 0) {
                setUpdates((prev) => {
                    const existingIds = new Set(prev.map((u: PolicyUpdate) => u.id));
                    const newUniqueUpdates = filteredNewUpdates.filter((u: PolicyUpdate) => !existingIds.has(u.id));
                    return [...prev, ...newUniqueUpdates];
                });
            }
            skipRef.current = currentSkip + newUpdates.length;
            setSkip(skipRef.current);
            setHasMore(newUpdates.length === 20);
        } catch (e) {
            console.error('[FEED] loadMore error', e);
            setHasMore(false);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [hasMore, search, subject, sort, classification, jurisdictionName, showCongress, showOnlyBookmarked, bookmarks, sponsorId, showOnlyEnacted]);

    // Search handler for button/enter
    const handleSearch = useCallback(() => {
        if (search === searchInput) return;
        setSearch(searchInput);
        setUpdates([]);
        setSkip(0);
        skipRef.current = 0;
        setHasMore(true);
    }, [searchInput, search, setUpdates]);

    // Add refresh handler to re-fetch feed
    const handleRefresh = useCallback(async () => {
        setUpdates([]);
        setSkip(0);
        skipRef.current = 0;
        setHasMore(true);
        setLoading(true);
        try {
            const newUpdates = await fetchUpdatesFeed({
                skip: 0,
                limit: 20,
                search,
                subject,
                sortField: sort.field,
                sortDir: sort.dir,
                classification,
                jurisdictionName,
                showCongress,
                sponsorId,
                showOnlyEnacted
            });
            const filteredUpdates = showOnlyBookmarked
                ? newUpdates.filter((update: PolicyUpdate) => bookmarks.includes(update.id))
                : newUpdates;
            setUpdates(filteredUpdates);
            skipRef.current = filteredUpdates.length;
            setSkip(filteredUpdates.length);
            setHasMore(newUpdates.length === 20 && (!showOnlyBookmarked || filteredUpdates.length === 20));
        } catch (e) {
            console.error('[FEED] refresh error', e);
        } finally {
            setLoading(false);
        }
    }, [search, subject, sort, classification, jurisdictionName, showCongress, showOnlyBookmarked, bookmarks, sponsorId, showOnlyEnacted]);

    // --- Seamless state/scroll restore ---
    // Use a ref to block the initial fetch until state/scroll is restored
    const didRestore = useRef(false);

    useLayoutEffect(() => {
        if (didRestore.current) return;

        // If the page was reloaded, clear the session storage to force a fresh fetch
        if (wasReloaded.current) {
            sessionStorage.removeItem('policyUpdatesFeedState');
            sessionStorage.removeItem('policyUpdatesFeedScrollY');
            sessionStorage.removeItem('policyUpdatesFeedSearch');
            sessionStorage.removeItem('policyUpdatesFeedCustomTags');

            console.log('[FEED] Cleared session storage due to page reload');
        }

        // Check for URL parameters first - these should take precedence
        const stateParam = searchParams.get('state');
        const stateAbbrParam = searchParams.get('stateAbbr');
        const hasUrlParams = stateParam || stateAbbrParam;

        const saved = sessionStorage.getItem('policyUpdatesFeedState');
        if (saved && !hasUrlParams) { // Only restore from sessionStorage if no URL params
            try {
                const state = JSON.parse(saved);
                setSearch(state.search || "");
                setSubject(state.subject || "");
                setClassification(state.classification || "");
                setJurisdictionName(state.jurisdictionName || "");
                setShowCongress(state.showCongress || false);
                setShowOnlyEnacted(state.showOnlyEnacted || false);
                setSort(state.sort || { field: 'createdAt', dir: 'desc' });
                setSkip(state.skip || 0);
                skipRef.current = state.skip || 0;
                setSearchInput(state.searchInput || "");
                if (state.updates && Array.isArray(state.updates)) {
                    setUpdates(state.updates);
                    // Crucial fix: set skipRef to actual length of updates
                    skipRef.current = state.updates.length;
                } else {
                    setUpdates([]);
                }
                setHasMore(state.hasMore !== undefined ? state.hasMore : true);
            } catch (e) {
                console.error('Error parsing feed state:', e);
                setUpdates([]);
                skipRef.current = 0;
                setSkip(0);
            }
        } else if (hasUrlParams) {
            // Clear any existing state when URL params are present
            setUpdates([]);
            skipRef.current = 0;
            setSkip(0);
            // console.log('URL parameters detected, clearing existing state to prioritize URL params');
        }

        // Restore scroll position *before* paint for seamlessness
        const scrollY = sessionStorage.getItem('policyUpdatesFeedScrollY');
        if (scrollY && !hasUrlParams) { // Only restore scroll if not coming from URL navigation
            window.scrollTo(0, parseInt(scrollY, 10));
        }

        didRestore.current = true;
        hasRestored.current = true;
        prevDeps.current = { search, subject, classification, sort, jurisdictionName };
    }, [searchParams]);

    // Block the initial fetch until after restore, and only fetch if updates are empty
    useEffect(() => {
        if (!didRestore.current) return;
        if (updates.length > 0) return; // Don't fetch if updates already restored
        let isMounted = true;
        const fetchAndSet = async () => {
            setLoading(true);
            try {
                // Only use sponsorId for filtering by representative
                const newUpdates = await fetchUpdatesFeed({
                    skip: 0,
                    limit: 20,
                    search,
                    subject,
                    sortField: sort.field,
                    sortDir: sort.dir,
                    classification,
                    jurisdictionName,
                    showCongress,
                    sponsorId: sponsorId, // Only send sponsorId, not sponsor name
                    showOnlyEnacted
                });
                if (!isMounted) return;

                // Filter to only bookmarked items if showOnlyBookmarked is true
                const filteredUpdates = showOnlyBookmarked
                    ? newUpdates.filter((update: PolicyUpdate) => bookmarks.includes(update.id))
                    : newUpdates;

                setUpdates(filteredUpdates);
                skipRef.current = filteredUpdates.length;
                setSkip(filteredUpdates.length);
                setHasMore(newUpdates.length === 20 && (!showOnlyBookmarked || filteredUpdates.length === 20));
            } catch {
                if (!isMounted) return;
                setHasMore(false);
            } finally {
                if (!isMounted) return;
                setLoading(false);
            }
        };
        fetchAndSet();
        return () => {
            isMounted = false;
        };
    }, [search, subject, classification, sort, jurisdictionName, showCongress, showOnlyBookmarked, bookmarks, sponsorId, showOnlyEnacted, didRestore.current]);


    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (!loader.current) return;
        const observer = new window.IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
                    loadMore();
                }
            },
            {
                threshold: 0, // Trigger as soon as any part is visible
                rootMargin: '400px' // Expand margin to trigger earlier (near bottom)
            }
        );
        const currentLoader = loader.current;
        observer.observe(currentLoader);
        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
        };
    }, [loadMore, hasMore]); // Simplified dependencies

    // Hide loading text if no more data and not loading
    useEffect(() => {
        if (!hasMore && !loading) {
            setShowLoadingText(false);
        }
    }, [hasMore, loading]);

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (loading) {
            setShowLoadingText(true);
            timer = setInterval(() => {
                setShowLoadingText(prev => !prev);
            }, 1000);
        } else {
            setShowLoadingText(false);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [loading]);


    // Save state to sessionStorage on change (excluding large updates array)
    useEffect(() => {
        try {
            sessionStorage.setItem('policyUpdatesFeedState', JSON.stringify({
                search,
                subject,
                classification,
                sort,
                skip,
                searchInput,
                hasMore,
                jurisdictionName,
                showCongress,
                showOnlyEnacted,
                updates
            }));
        } catch (error) {
            console.warn('Failed to save state to sessionStorage:', error);
            // If storage fails, try to clear old data and retry with minimal state
            try {
                sessionStorage.removeItem('policyUpdatesFeedState');
                sessionStorage.setItem('policyUpdatesFeedState', JSON.stringify({
                    search, subject, classification, sort, showCongress, showOnlyEnacted
                }));
            } catch (retryError) {
                console.error('Failed to save even minimal state:', retryError);
            }
        }
    }, [search, subject, classification, sort, skip, searchInput, hasMore, jurisdictionName, showCongress, showOnlyEnacted, updates]);

    // Save scroll position
    useEffect(() => {
        const handleScroll = () => {
            sessionStorage.setItem('policyUpdatesFeedScrollY', String(window.scrollY));
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    // Helper function to get sort label
    const getSortLabel = (field: string, dir: string) => {
        switch (`${field}:${dir}`) {
            case "createdAt:desc":
                return "Most Recent";
            case "createdAt:asc":
                return "Oldest";
            case "lastActionAt:desc":
                return "Latest Action";
            case "lastActionAt:asc":
                return "Earliest Action";
            case "title:asc":
                return "Alphabetical (A-Z)";
            case "title:desc":
                return "Alphabetical (Z-A)";
            default:
                return "Custom";
        }
    };

    // Load custom tags from localStorage
    useLayoutEffect(() => {
        const savedCustomTags = localStorage.getItem('policyUpdatesFeedCustomTags');
        if (savedCustomTags) {
            try {
                setCustomTags(JSON.parse(savedCustomTags));
            } catch (e) {
                console.error('Error parsing custom tags:', e);
            }
        }
    }, []);

    // Save custom tags to localStorage
    useEffect(() => {
        localStorage.setItem('policyUpdatesFeedCustomTags', JSON.stringify(customTags));
    }, [customTags]);

    // Add custom tag
    const addCustomTag = () => {
        const tag = newTagInput.trim();
        if (tag && !customTags.includes(tag)) {
            setCustomTags(prev => [...prev, tag]);
            setNewTagInput("");
            setShowCustomTagInput(false);
        }
    };

    // Remove custom tag
    const removeCustomTag = (tagToRemove: string) => {
        setCustomTags(prev => prev.filter(tag => tag !== tagToRemove));
        // If the removed tag was active, clear the subject filter
        if (subject === tagToRemove) {
            setSubject("");
            setUpdates([]);
            setSkip(0);
            skipRef.current = 0;
            setHasMore(true);
            setLoading(true);
        }
    };

    return (
        <>
            {/* Unified Filter Indicator */}
            {(repFilter || sponsorId || showCongress || jurisdictionName || showOnlyEnacted) && (
                <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                            {(repFilter || sponsorId || showCongress || jurisdictionName) && (
                                <Badge variant="default" className="bg-primary">
                                    {repFilter
                                        ? `Filtered by Representative: ${repFilter}`
                                        : sponsorId
                                            ? `Filtered by Representative${sponsorId ? ` (ID: ${sponsorId})` : ''}`
                                            : showCongress
                                                ? "Filtered by U.S. Congress"
                                                : jurisdictionName
                                                    ? `Filtered by State: ${jurisdictionName}`
                                                    : ""
                                    }
                                </Badge>
                            )}
                            {showOnlyEnacted && (
                                <Badge variant="default" className="bg-green-600">
                                    Enacted into Law
                                </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                                {repFilter
                                    ? `Showing bills sponsored by ${repFilter}`
                                    : sponsorId
                                        ? `Showing bills sponsored by this representative${sponsorId ? ` (ID: ${sponsorId})` : ''}`
                                        : showCongress
                                            ? "Showing federal legislation only"
                                            : jurisdictionName
                                                ? `Showing legislation from ${jurisdictionName} only`
                                                : showOnlyEnacted
                                                    ? "Showing only bills that have been enacted into law"
                                                    : ""}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Reset all filter-related state to default
                                setRepFilter("");
                                setSponsorId("");
                                setJurisdictionName("");
                                setShowCongress(false);
                                setShowOnlyEnacted(false);
                                setUpdates([]);
                                setSkip(0);
                                skipRef.current = 0;
                                setHasMore(true);
                                setLoading(true);
                                setSearch("");
                                setSubject("");
                                setClassification("");
                                setSort({ field: 'createdAt', dir: 'desc' });
                                setShowOnlyBookmarked(false);
                                // Remove all filter params from URL
                                const params = new URLSearchParams([...searchParams.entries()]);
                                params.delete('rep');
                                params.delete('sponsorId');
                                params.delete('state');
                                params.delete('stateAbbr');
                                params.delete('congress');
                                router.replace(`/legislation?${params.toString()}`);
                                // Clear sessionStorage so feed resets after reload
                                sessionStorage.removeItem('policyUpdatesFeedState');
                                sessionStorage.removeItem('policyUpdatesFeedScrollY');
                                sessionStorage.removeItem('policyUpdatesFeedSearch');
                                sessionStorage.removeItem('policyUpdatesFeedCustomTags');
                                console.log('[FEED] Cleared all filters and session storage');
                            }}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Clear Filter
                        </Button>
                    </div>
                </div>
            )}

            {/*<AnimatedSection>*/}
            <div className="mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-center justify-center md:justify-start">
                <div className="relative flex-grow w-full sm:w-auto flex">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search updates..."
                        className="pl-10 w-full"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSearch();
                        }}
                    />
                    <Button
                        className="ml-2"
                        variant="default"
                        onClick={handleSearch}
                        aria-label="Search"
                    >
                        Search
                    </Button>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            Sort: {getSortLabel(sort.field, sort.dir)}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuRadioGroup
                            value={`${sort.field}:${sort.dir}`}
                            onValueChange={val => {
                                const [field, dir] = val.split(":");
                                setSort({ field, dir: dir as 'asc' | 'desc' });
                                setUpdates([]);
                                setSkip(0);
                                skipRef.current = 0;
                                setHasMore(true);
                            }}
                        >
                            <DropdownMenuRadioItem value="createdAt:desc">Most Recent</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="createdAt:asc">Oldest</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="lastActionAt:desc">Latest Action</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="lastActionAt:asc">Earliest Action</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="title:asc">Alphabetical (A-Z)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="title:desc">Alphabetical (Z-A)</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            <MapPin className="mr-2 h-4 w-4" />
                            {showCongress ? "U.S. Congress" : jurisdictionName || "All States"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                        <DropdownMenuRadioGroup
                            value={showCongress ? "congress" : jurisdictionName}
                            onValueChange={(value) => {
                                if (value === "congress") {
                                    setShowCongress(true);
                                    setJurisdictionName("");
                                } else if (value === "all") {
                                    setShowCongress(false);
                                    setJurisdictionName("");
                                } else {
                                    setShowCongress(false);
                                    setJurisdictionName(value);
                                }
                                setUpdates([]);
                                setSkip(0);
                                skipRef.current = 0;
                                setHasMore(true);
                                setLoading(true);
                            }}
                        >
                            <DropdownMenuRadioItem value="all">All States</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="congress">U.S. Congress</DropdownMenuRadioItem>
                            {Object.keys(STATE_MAP).sort().map((state) => (
                                <DropdownMenuRadioItem key={state} value={state}>
                                    {state}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    variant={showOnlyBookmarked ? "default" : "outline"}
                    className="w-full sm:w-auto"
                    disabled={bookmarksLoading || !user}
                    onClick={() => {
                        if (!user) return;
                        setShowOnlyBookmarked(!showOnlyBookmarked);
                        setUpdates([]);
                        setSkip(0);
                        skipRef.current = 0;
                        setHasMore(true);
                        setLoading(true);
                    }}
                >
                    <Bookmark className="mr-2 h-4 w-4" />
                    {showOnlyBookmarked ? "Show All" : `Bookmarked (${bookmarksLoading ? '...' : bookmarks.length})`}
                </Button>
                {/* Enacted Legislation Filter */}
                <Button
                    variant={showOnlyEnacted ? "default" : "outline"}
                    className="w-full sm:w-auto"
                    onClick={() => {
                        setShowOnlyEnacted(!showOnlyEnacted);
                        setUpdates([]);
                        setSkip(0);
                        skipRef.current = 0;
                        setHasMore(true);
                        setLoading(true);
                    }}
                >
                    <span className="ml-2">{showOnlyEnacted ? "Show All Bills" : "Enacted into Law"}</span>
                </Button>
                {/* Refresh Feed button */}
                <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={handleRefresh}
                >
                    Refresh Feed
                </Button>
            </div>
            {/*</AnimatedSection>*/}

            {/* Classification badges */}
            {/*<AnimatedSection>*/}
            <div className="mb-4 flex flex-wrap gap-2">
                {CLASSIFICATIONS.map(opt => (
                    <Badge
                        key={opt.value}
                        variant={classification === opt.value ? "default" : "secondary"}
                        onClick={() => {
                            if (classification !== opt.value) {
                                setClassification(opt.value);
                                setUpdates([]);
                                setSkip(0);
                                skipRef.current = 0;
                                setHasMore(true);
                                setLoading(true);
                            }
                        }}
                        className="cursor-pointer"
                    >
                        {opt.label}
                    </Badge>
                ))}
            </div>
            {/*</AnimatedSection>*/}

            {/* Predefined Subject Tags */}
            {/*<AnimatedSection>*/}
            <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Subject Tags</h3>
                <div className="flex flex-wrap gap-2">
                    {Object.keys(BROAD_TOPIC_KEYWORDS).map((cat) => (
                        <Badge
                            key={cat}
                            variant={subject === cat ? "default" : "secondary"}
                            onClick={() => {
                                const newSubject = subject === cat ? "" : cat;
                                if (subject !== newSubject) {
                                    setSubject(newSubject);
                                    setUpdates([]);
                                    setSkip(0);
                                    skipRef.current = 0;
                                    setHasMore(true);
                                    setLoading(true);
                                }
                            }}
                            className="cursor-pointer"
                        >
                            #{cat}
                        </Badge>
                    ))}
                </div>
            </div>
            {/*</AnimatedSection>*/}

            {/* Custom Tags Section */}
            {/*<AnimatedSection>*/}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Custom Tags</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomTagInput(!showCustomTagInput)}
                        className="flex items-center gap-1"
                    >
                        <Plus className="h-3 w-3" />
                        Add Tag
                    </Button>
                </div>

                {/* Custom Tag Input */}
                {showCustomTagInput && (
                    <div className="flex gap-2 mb-3">
                        <Input
                            placeholder="Enter custom tag..."
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addCustomTag();
                                }
                                if (e.key === 'Escape') {
                                    setShowCustomTagInput(false);
                                    setNewTagInput("");
                                }
                            }}
                            className="flex-1"
                            autoFocus
                        />
                        <Button onClick={addCustomTag} disabled={!newTagInput.trim()}>
                            Add
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCustomTagInput(false);
                                setNewTagInput("");
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                )}

                {/* Custom Tags Display */}
                {customTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {customTags.map((tag) => (
                            <Badge
                                key={tag}
                                variant={subject === tag ? "default" : "outline"}
                                onClick={() => {
                                    const newSubject = subject === tag ? "" : tag;
                                    if (subject !== newSubject) {
                                        setSubject(newSubject);
                                        setUpdates([]);
                                        setSkip(0);
                                        skipRef.current = 0;
                                        setHasMore(true);
                                        setLoading(true);
                                    }
                                }}
                                className="cursor-pointer flex items-center gap-1"
                            >
                                #{tag}
                                <X
                                    className="h-3 w-3 hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeCustomTag(tag);
                                    }}
                                />
                            </Badge>
                        ))}
                    </div>
                )}

                {customTags.length === 0 && !showCustomTagInput && (
                    <p className="text-sm text-muted-foreground">No custom tags yet. Add your own tags to quickly filter
                        content.</p>
                )}
            </div>
            {/*</AnimatedSection>*/}

            {/* Bookmark checkbox */}
            {/*<AnimatedSection>*/}
            <div className="flex items-center mb-4">
                <input
                    id="show-bookmarked"
                    type="checkbox"
                    checked={showOnlyBookmarked}
                    onChange={e => {
                        setShowOnlyBookmarked(e.target.checked);
                        setUpdates([]);
                        setSkip(0);
                        skipRef.current = 0;
                        setHasMore(true);
                        setLoading(true);
                    }}
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="show-bookmarked" className="ml-2 text-sm text-muted-foreground cursor-pointer">
                    Show only bookmarked updates
                </label>
            </div>
            {/*</AnimatedSection>*/}

            {/* Updates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                {updates.map((update, idx) => (
                    <PolicyUpdateCard
                        key={update.id || idx}
                        update={update}
                        idx={idx}
                        updates={updates}
                        classification={classification}
                        subject={subject}
                        setClassification={setClassification}
                        setSubject={setSubject}
                        setUpdates={setUpdates}
                        setSkip={setSkip}
                        skipRef={skipRef}
                        setHasMore={setHasMore}
                        setLoading={setLoading}
                    />
                ))}
            </div>
            <div ref={loader} />
            {showLoadingText && loading && updates.length > 0 && (
                <LoadingOverlay text="Loading more updates..." smallText="Loading..." />
            )}
            {!hasMore && !loading && <p className="mt-6 text-center text-muted-foreground">No more updates.</p>}
        </>
    );
}
