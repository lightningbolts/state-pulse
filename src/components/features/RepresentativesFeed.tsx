"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { STATE_MAP } from '@/types/geo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown } from 'lucide-react';
import RepresentativeCard from '@/components/features/RepresentativeCard';
import { useFollowedRepresentatives } from '@/hooks/use-follow-representative';
import type { Representative } from '@/types/representative';

type SortOption = {
  label: string;
  field: string;
  dir: 'asc' | 'desc';
};

const sortOptions: SortOption[] = [
  { label: 'Name (A-Z)', field: 'name', dir: 'asc' },
  { label: 'Name (Z-A)', field: 'name', dir: 'desc' },
  { label: 'State (A-Z)', field: 'state', dir: 'asc' },
  { label: 'State (Z-A)', field: 'state', dir: 'desc' },
  { label: 'Most bills sponsored', field: 'sponsored', dir: 'desc' },
  { label: 'Least bills sponsored', field: 'sponsored', dir: 'asc' },
  { label: 'Most bills cosponsored', field: 'cosponsored', dir: 'desc' },
  { label: 'Least bills cosponsored', field: 'cosponsored', dir: 'asc' },
  { label: 'Most legislative activity', field: 'activity', dir: 'desc' },
  { label: 'Least legislative activity', field: 'activity', dir: 'asc' },
  { label: 'Most recent activity', field: 'recentActivity', dir: 'desc' },
  { label: 'Least recent activity', field: 'recentActivity', dir: 'asc' },
];

export default function RepresentativesFeed() {
  const [reps, setReps] = useState<Representative[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<SortOption>(sortOptions[0]);
  const [jurisdictionName, setJurisdictionName] = useState<string>("");
  const [congressChamber, setCongressChamber] = useState<"" | "us-house" | "us-senate">("");
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const loader = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(1);

  const { followedReps } = useFollowedRepresentatives();
  const followedRepIds = new Set(followedReps.map(rep => rep.id));

  const fetchReps = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    const pageToFetch = reset ? 1 : pageRef.current;
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageToFetch));
      params.set('pageSize', '20');
      params.set('sortBy', sort.field);
      params.set('sortDir', sort.dir);
      if (search.trim() !== "") {
        params.set('search', search);
      }
      if (congressChamber === "us-house" || congressChamber === "us-senate") {
        params.set('showCongress', 'true');
        params.set('chamber', congressChamber === 'us-house' ? 'House of Representatives' : 'Senate');
        params.delete('filterState');
      } else if (jurisdictionName) {
        const abbr = STATE_MAP[jurisdictionName] || jurisdictionName;
        params.set('filterState', abbr);
      }
      const res = await fetch(`/api/representatives?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch representatives');
      const data = await res.json();
      const newReps: Representative[] = data.representatives || [];
      setReps(reset ? newReps : prev => [...prev, ...newReps]);
      setHasMore(data.pagination?.hasNext ?? false);
      const nextPage = pageToFetch + 1;
      pageRef.current = nextPage;
      setPage(nextPage);
      if (data.pagination && typeof data.pagination.total === 'number') {
        setTotalCount(data.pagination.total);
      } else if (reset) {
        setTotalCount(newReps.length);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, sort, jurisdictionName, congressChamber]);

  useEffect(() => {
    pageRef.current = 1;
    setPage(1);
    setHasMore(true);
    setReps([]);
    void fetchReps(true);
  }, [sort.field, sort.dir, jurisdictionName, congressChamber, fetchReps]);

  useEffect(() => {
    if (!loader.current) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          void fetchReps();
        }
      },
      { threshold: 0, rootMargin: '400px' }
    );
    const currentLoader = loader.current;
    observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMore, loading, fetchReps]);

  const handleSearch = useCallback(() => {
    pageRef.current = 1;
    setPage(1);
    setHasMore(true);
    setReps([]);
    void fetchReps(true);
  }, [fetchReps]);

  const currentSortLabel = sortOptions.find(
    (opt) => opt.field === sort.field && opt.dir === sort.dir,
  )?.label ?? 'Sort';

  return (
    <div className="px-0 sm:px-0">
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-center">
        <div className="relative flex-grow w-full sm:w-auto flex">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name, state, chamber, or party..."
            className="pl-10 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          />
          <Button className="ml-2" variant="default" onClick={handleSearch} aria-label="Search">Search</Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto gap-2">
              <ArrowUpDown className="h-4 w-4" />
              <span className="truncate max-w-[12rem]">{currentSortLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={`${sort.field}:${sort.dir}`}
              onValueChange={val => {
                const option = sortOptions.find((opt) => `${opt.field}:${opt.dir}` === val);
                if (option) setSort(option);
              }}
            >
              {sortOptions.map(opt => (
                <DropdownMenuRadioItem key={`${opt.field}:${opt.dir}`} value={`${opt.field}:${opt.dir}`}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              {congressChamber === "us-house" ? "U.S. House" : congressChamber === "us-senate" ? "U.S. Senate" : jurisdictionName || "All States"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={congressChamber ? congressChamber : jurisdictionName || "all"}
              onValueChange={value => {
                if (value === "us-house" || value === "us-senate") {
                  setCongressChamber(value);
                  setJurisdictionName("");
                } else if (value === "all") {
                  setCongressChamber("");
                  setJurisdictionName("");
                } else {
                  setCongressChamber("");
                  setJurisdictionName(value);
                }
              }}
            >
              <DropdownMenuRadioItem value="all">All States</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="us-house">U.S. House</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="us-senate">U.S. Senate</DropdownMenuRadioItem>
              {Object.keys(STATE_MAP).sort().map((state) => (
                <DropdownMenuRadioItem key={state} value={state}>
                  {state}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && <div className="text-red-500 text-center mb-4">{error}</div>}
      <div className="mb-2 text-sm text-muted-foreground text-center">
        {totalCount === 0 ? (
          <>No representatives found.</>
        ) : totalCount != null ? (
          <>Showing <span className="font-semibold">{reps.length}</span> of <span className="font-semibold">{totalCount}</span> representative{totalCount === 1 ? '' : 's'}</>
        ) : null}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {reps.map((rep, idx) => (
          <RepresentativeCard
            key={rep.id + idx}
            rep={rep}
            href={`/representatives/${rep.id}`}
            isFollowed={followedRepIds.has(rep.id)}
          />
        ))}
      </div>
      {loading && <LoadingOverlay text="Loading representatives..." smallText="Loading..." />}
      {!hasMore && !loading && reps.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">No representatives found.</div>
      )}
      <div ref={loader} />
    </div>
  );
}
