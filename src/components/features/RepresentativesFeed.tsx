"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { STATE_MAP } from '@/types/geo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import RepresentativeCard from '@/components/features/RepresentativeCard';
import type { Representative } from '@/types/representative';
export default function RepresentativesFeed() {
  const [reps, setReps] = useState<Representative[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' });
  const [jurisdictionName, setJurisdictionName] = useState<string>("");
  const [congressChamber, setCongressChamber] = useState<"" | "us-house" | "us-senate">("");
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const loader = useRef<HTMLDivElement | null>(null);

  const fetchReps = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(reset ? 1 : page));
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
        // Convert state name to abbreviation if possible
        const abbr = STATE_MAP[jurisdictionName] || jurisdictionName;
        params.set('filterState', abbr);
      }
      const res = await fetch(`/api/representatives?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch representatives');
      const data = await res.json();
      const newReps: Representative[] = data.representatives || [];
      setReps(reset ? newReps : prev => [...prev, ...newReps]);
      setHasMore(data.pagination?.hasNext ?? false);
      setPage(reset ? 2 : page + 1);
      if (data.pagination && typeof data.pagination.total === 'number') {
        setTotalCount(data.pagination.total);
      } else if (reset) {
        setTotalCount(newReps.length);
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, page, sort, jurisdictionName, congressChamber]);

  // Initial fetch and on search
  useEffect(() => {
    fetchReps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Infinite scroll
  useEffect(() => {
    if (!loader.current) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchReps();
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
    setPage(1);
    fetchReps(true);
  }, [fetchReps]);

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
        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              Sort: {sort.field === 'name' && sort.dir === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={`${sort.field}:${sort.dir}`}
              onValueChange={val => {
                const [field, dir] = val.split(":");
                setSort({ field, dir: dir as 'asc' | 'desc' });
                setReps([]);
                setPage(1);
                setHasMore(true);
              }}
            >
              <DropdownMenuRadioItem value="name:asc">Alphabetical (A-Z)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name:desc">Alphabetical (Z-A)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* State Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              {congressChamber === "us-house" ? "U.S. House" : congressChamber === "us-senate" ? "U.S. Senate" : jurisdictionName || "All States"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={congressChamber ? congressChamber : jurisdictionName}
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
                setReps([]);
                setPage(1);
                setHasMore(true);
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
