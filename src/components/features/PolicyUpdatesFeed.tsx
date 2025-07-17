"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bookmark, Search, Plus, X, MapPin } from "lucide-react";
import { BookmarkButton, BookmarksContext } from "@/components/features/BookmarkButton";
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect, useContext } from "react";
import { useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { STATE_MAP } from "@/types/geo";

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
  { label: "Resolution", value: "resolution" },
  { label: "Joint Resolution", value: "concurrent resolution" },
  { label: "Concurrent Resolution", value: "memorial" },
  { label: "Proclamation", value: "proclamation" },
];

let cardNumber = 20;

// Fetch updates with optional filters and sorting
async function fetchUpdatesFeed({ skip = 0, limit = cardNumber, search = "", subject = "", sortField = "createdAt", sortDir = "desc", classification = "", jurisdictionName = "", showCongress = false }: { skip?: number; limit?: number; search?: string; subject?: string; sortField?: string; sortDir?: string; classification?: string; jurisdictionName?: string; showCongress?: boolean }) {
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
  const res = await fetch(`/api/legislation?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch updates");
  return await res.json();
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
  const [showLoadingText, setShowLoadingText] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const loader = useRef<HTMLDivElement | null>(null);
  const skipRef = useRef(0);
  const loadingRef = useRef(false); // Ref to prevent concurrent loads
  const hasRestored = useRef(false);
  const prevDeps = useRef<{search: string, subject: string, classification: string, sort: any, jurisdictionName: string} | null>(null);

  // Access bookmark context
  const { bookmarks, loading: bookmarksLoading } = useContext(BookmarksContext);
  const { user } = useUser();

  // URL parameter handling for state filtering and congress filtering
  const searchParams = useSearchParams();

  // Handle URL parameters for state filtering
  useEffect(() => {
    const stateParam = searchParams.get('state');
    const stateAbbrParam = searchParams.get('stateAbbr');
    const congressParam = searchParams.get('congress');

    // console.log('PolicyUpdatesFeed received params:', { stateParam, stateAbbrParam, congressParam });

    // Handle congress parameter first
    if (congressParam === 'true') {
      // console.log('Setting showCongress to true from URL parameter');
      setShowCongress(true);
      setJurisdictionName(''); // Clear any state filter
      // Reset the feed to load fresh data for congress
      setUpdates([]);
      setSkip(0);
      skipRef.current = 0;
      setHasMore(true);
      setLoading(true);
      return; // Exit early to avoid state processing
    }

    if (stateParam || stateAbbrParam) {
      let stateName = stateParam ? decodeURIComponent(stateParam) : null;

      // console.log('Initial stateName:', stateName);

      // If we have a state abbreviation, convert it to full name
      if (stateAbbrParam && !stateName) {
        // Create reverse mapping from abbreviation to state name
        const abbrToStateName = Object.entries(STATE_MAP).reduce((acc, [fullName, abbr]) => {
          acc[abbr] = fullName;
          return acc;
        }, {} as Record<string, string>);

        stateName = abbrToStateName[stateAbbrParam.toUpperCase()] || stateAbbrParam;
        // console.log('Converted from stateAbbrParam:', stateAbbrParam, 'to stateName:', stateName);
      }

      // If stateParam looks like an abbreviation (2 chars, all caps), convert it
      if (stateName && stateName.length === 2 && stateName === stateName.toUpperCase()) {
        const abbrToStateName = Object.entries(STATE_MAP).reduce((acc, [fullName, abbr]) => {
          acc[abbr] = fullName;
          return acc;
        }, {} as Record<string, string>);

        const originalStateName = stateName;
        stateName = abbrToStateName[stateName] || stateName;
        // console.log('Converted abbreviation:', originalStateName, 'to full name:', stateName);
      }

      if (stateName) {
        // console.log('Final stateName being set:', stateName);
        setJurisdictionName(stateName);
        setShowCongress(false); // Clear congress filter
        // Reset the feed to load fresh data for this state
        setUpdates([]);
        setSkip(0);
        skipRef.current = 0;
        setHasMore(true);
        setLoading(true);
      }
    }
  }, [searchParams]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const currentSkip = skipRef.current;
      const newUpdates = await fetchUpdatesFeed({
        skip: currentSkip,
        limit: 20,
        search,
        subject,
        sortField: sort.field,
        sortDir: sort.dir,
        classification,
        jurisdictionName,
        showCongress
      });

      // Filter to only bookmarked items if showOnlyBookmarked is true
      const filteredNewUpdates = showOnlyBookmarked
        ? newUpdates.filter((update: PolicyUpdate) => bookmarks.includes(update.id))
        : newUpdates;

      // Since the backend now handles all sorting, we can simplify the frontend logic.
      if (filteredNewUpdates.length > 0) {
        setUpdates((prev) => {
          // Merge and ensure no duplicates, maintaining the order from the API.
          const existingIds = new Set(prev.map((u) => u.id));
          const newUniqueUpdates = filteredNewUpdates.filter((u) => !existingIds.has(u.id));
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
  }, [hasMore, search, subject, sort, classification, jurisdictionName, showCongress, showOnlyBookmarked, bookmarks]);

  // Search handler for button/enter
  const handleSearch = useCallback(() => {
    if (search === searchInput) return;
    setSearch(searchInput);
    setUpdates([]);
    setSkip(0);
    skipRef.current = 0;
    setHasMore(true);
  }, [searchInput, search, setUpdates]);

  // --- Seamless state/scroll restore ---
  // Use a ref to block the initial fetch until state/scroll is restored
  const didRestore = useRef(false);

  useLayoutEffect(() => {
    if (didRestore.current) return;

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
    prevDeps.current = {search, subject, classification, sort, jurisdictionName};
  }, [searchParams]);

  // Block the initial fetch until after restore, and only fetch if updates are empty
  useEffect(() => {
    if (!didRestore.current) return;
    if (updates.length > 0) return; // Don't fetch if updates already restored
    let isMounted = true;
    const fetchAndSet = async () => {
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
          showCongress
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
    return () => { isMounted = false; };
  }, [search, subject, classification, sort, jurisdictionName, showCongress, showOnlyBookmarked, bookmarks, didRestore.current]);


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
        threshold: 0.1,
        rootMargin: '100px'
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
        search, subject, classification, sort, skip, searchInput, hasMore, jurisdictionName, showCongress, updates
      }));
    } catch (error) {
      console.warn('Failed to save state to sessionStorage:', error);
      // If storage fails, try to clear old data and retry with minimal state
      try {
        sessionStorage.removeItem('policyUpdatesFeedState');
        sessionStorage.setItem('policyUpdatesFeedState', JSON.stringify({
          search, subject, classification, sort, showCongress
        }));
      } catch (retryError) {
        console.error('Failed to save even minimal state:', retryError);
      }
    }
  }, [search, subject, classification, sort, skip, searchInput, hasMore, jurisdictionName, showCongress, updates]);

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
      case "createdAt:desc": return "Most Recent";
      case "createdAt:asc": return "Oldest";
      case "lastActionAt:desc": return "Latest Action";
      case "lastActionAt:asc": return "Earliest Action";
      case "title:asc": return "Alphabetical (A-Z)";
      case "title:desc": return "Alphabetical (Z-A)";
      default: return "Custom";
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
        {/* Congress Filter Indicator */}
        {showCongress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600">
                  Filtered by: U.S. Congress
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Showing federal legislation only
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCongress(false);
                  setUpdates([]);
                  setSkip(0);
                  skipRef.current = 0;
                  setHasMore(true);
                  setLoading(true);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            </div>
          </div>
        )}

        {/* State Filter Indicator */}
        {jurisdictionName && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-primary">
                  Filtered by State: {jurisdictionName}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Showing legislation from {jurisdictionName} only
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setJurisdictionName("");
                  setUpdates([]);
                  setSkip(0);
                  skipRef.current = 0;
                  setHasMore(true);
                  setLoading(true);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
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
                  setUpdates([]); setSkip(0); skipRef.current = 0; setHasMore(true);
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
        </div>

        {/* Classification badges */}
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

        {/* Predefined Subject Tags */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Subject Tags</h3>
          <div className="flex flex-wrap gap-2">
            {["Education", "Healthcare", "Policing", "Climate", "Labor", "Tech", "Housing", "Transportation", "Immigration", "Criminal Justice", "Budget", "Taxation", "Energy", "Agriculture", "Veterans", "Civil Rights", "Gun Control", "Privacy", "Ethics", "Environment"].map((cat) => (
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

        {/* Custom Tags Section */}
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
            <p className="text-sm text-muted-foreground">No custom tags yet. Add your own tags to quickly filter content.</p>
          )}
        </div>

        {/* Bookmark checkbox */}
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

        {/* Updates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
          {updates.map((update, idx) => {
            const getFormattedDate = (dateString: string | null | undefined) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return ''; // Invalid date check
                return typeof window !== 'undefined'
                    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : date.toISOString().slice(0, 10);
            };

            // --- Introduction Date Logic ---
            let introDate: Date | null = null;
            if (update.firstActionAt) {
                introDate = new Date(update.firstActionAt);
            } else if (Array.isArray(update.history) && update.history.length > 0) {
                const sortedHistory = [...update.history]
                    .filter(h => h.date)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // sort ascending for earliest
                if (sortedHistory.length > 0 && sortedHistory[0].date) {
                    introDate = new Date(sortedHistory[0].date);
                }
            }
            if ((!introDate || isNaN(introDate.getTime())) && update.createdAt) {
                introDate = new Date(update.createdAt);
            }
            const formattedIntroDate = introDate && !isNaN(introDate.getTime()) ? getFormattedDate(introDate.toISOString()) : '';


            // --- Last Action Date & Description Logic ---
            let lastActionDate: Date | null = update.lastActionAt ? new Date(update.lastActionAt) : null;
            let lastActionDescription = update.latestActionDescription;

            if (Array.isArray(update.history) && update.history.length > 0) {
                const sortedHistory = [...update.history]
                    .filter(h => h.date && h.action)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (sortedHistory.length > 0) {
                    const latestHistoryAction = sortedHistory[0];
                    const latestHistoryDate = new Date(latestHistoryAction.date);

                    if (latestHistoryDate && !isNaN(latestHistoryDate.getTime())) {
                        if (!lastActionDate || isNaN(lastActionDate.getTime()) || latestHistoryDate > lastActionDate) {
                            lastActionDate = latestHistoryDate;
                            lastActionDescription = latestHistoryAction.action;
                        }
                    }
                }
            }
            const formattedLastActionDate = lastActionDate && !isNaN(lastActionDate.getTime()) ? getFormattedDate(lastActionDate.toISOString()) : null;

            const stateUrl = update.sources && update.sources.length > 0 ? update.sources[0].url : update.openstatesUrl;
            const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
            const uniqueKey = update.id && updates.filter(u => u.id === update.id).length === 1 ? update.id : `${update.id || 'no-id'}-${idx}`;

            return (
                <div
                  key={uniqueKey}
                  className="mb-4 p-4 border rounded-lg bg-background transition hover:bg-accent/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary h-full relative"
                >
                  <div className="flex flex-col h-full">
                    {/* Clickable area for navigation */}
                    <Link
                      href={`/legislation/${update.id}`}
                      className="block flex-1"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div>
                        <div className="font-bold text-lg mb-1 text-left">{update.identifier ? `${update.identifier} - ${update.title}` : update.title}</div>
                        <div className="text-sm text-muted-foreground mb-1 text-left">
                          {update.jurisdictionName} • {update.session}
                        </div>
                        {update.classification && update.classification.length > 0 && (
                          <div className="mb-1">
                            {update.classification.map((c, i) => (
                              <Badge
                                key={c + i}
                                variant={classification === c.toLowerCase() ? "default" : "secondary"}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (classification !== c.toLowerCase()) {
                                    setClassification(c.toLowerCase());
                                    setUpdates([]);
                                    setSkip(0);
                                    skipRef.current = 0;
                                    setHasMore(true);
                                    setLoading(true);
                                  }
                                }}
                                className="mr-1 cursor-pointer"
                              >
                                {capitalize(c)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {update.subjects && update.subjects.length > 0 && (
                          <div className="mb-1">
                            {update.subjects.map((s, i) => (
                              <Badge
                                key={s + i}
                                variant={subject === s ? "default" : "outline"}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newSubject = subject === s ? "" : s;
                                  if (subject !== newSubject) {
                                    setSubject(newSubject);
                                    setUpdates([]);
                                    setSkip(0);
                                    skipRef.current = 0;
                                    setHasMore(true);
                                    setLoading(true);
                                  }
                                }}
                                className="mr-1 cursor-pointer"
                              >
                                #{capitalize(s)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {formattedIntroDate && (
                          <div className="text-sm text-muted-foreground mb-1">
                              <span className="font-semibold">Introduced: </span>{formattedIntroDate}
                          </div>
                        )}
                        {(lastActionDescription || formattedLastActionDate) && (
                          <div className="text-sm text-muted-foreground mb-1 text-left">
                            <span className="font-semibold">Last Action: </span>{lastActionDescription || 'N/A'}
                            {formattedLastActionDate && (
                              <span className="ml-2">({formattedLastActionDate})</span>
                            )}
                          </div>
                        )}
                        {update.sponsors && update.sponsors.length > 0 && (
                            <div className="mb-1 text-xs text-muted-foreground">
                              <span className="font-semibold">Sponsors: </span>
                              {update.sponsors.map((sp, i) => (
                                  <span key={`${sp.name || ''}-${i}`}>{sp.name}{i < (update.sponsors?.length || 0) - 1 ? ', ' : ''}</span>
                              ))}
                            </div>
                        )}
                        {update.geminiSummary && (
                          <div className="mt-2 text-sm text-left">{update.geminiSummary}</div>
                        )}
                        {!update.geminiSummary && update.summary && (
                          <div className="mt-2 text-sm text-left">{update.summary}</div>
                        )}
                      </div>
                    </Link>

                    {/* Bottom buttons section */}
                    <div className="mt-auto pt-4 flex justify-between items-center gap-2">
                      <button
                        type="button"
                        className="h-10 px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-1 transition-colors"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(stateUrl, '_blank', 'noopener');
                        }}
                      >
                        {update.sources && update.sources.length > 0 ? 'State Link' : 'OpenStates Link'}
                      </button>

                      <div onClick={e => e.stopPropagation()}>
                        <BookmarkButton
                          legislationId={update.id}
                          className="h-10 px-3 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>
        <div ref={loader} />
        {showLoadingText && (loading) && (
          <p className="mt-6 text-center text-muted-foreground">Loading more updates...</p>
        )}
        {!hasMore && !loading && <p className="mt-6 text-center text-muted-foreground">No more updates.</p>}
    </>
  );
}
