"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExecutiveOrder, EXECUTIVE_ORDER_TOPICS } from '@/types/executiveOrder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import { ExecutiveOrderCard } from './ExecutiveOrderCard';
import { STATE_MAP } from '@/types/geo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, Grid3X3, List, MapPin, Search, X } from 'lucide-react';

interface ExecutiveOrdersListProps {
  initialOrders: ExecutiveOrder[];
  initialHasMore: boolean;
  initialState?: string;
  initialDays?: number;
}

type SortState = { field: 'date_signed' | 'createdAt' | 'title'; dir: 'asc' | 'desc' };
type SourceFilter = '' | 'federal' | 'state';

const ORDERS_PER_PAGE = 20;
const COMPACT_PAGE_SIZE = 100;
const DAY_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 2 weeks' },
  { value: 30, label: 'Last 30 days' },
  { value: 60, label: 'Last 2 months' },
  { value: 90, label: 'Last 3 months' },
  { value: 180, label: 'Last 6 months' },
  { value: 365, label: 'Last year' },
];

function getSortLabel(field: string, dir: string) {
  if (field === 'date_signed' && dir === 'desc') return 'Most Recent';
  if (field === 'date_signed' && dir === 'asc') return 'Oldest';
  if (field === 'createdAt' && dir === 'desc') return 'Recently Added';
  if (field === 'createdAt' && dir === 'asc') return 'Earliest Added';
  if (field === 'title' && dir === 'asc') return 'Alphabetical (A-Z)';
  if (field === 'title' && dir === 'desc') return 'Alphabetical (Z-A)';
  return 'Most Recent';
}

function OrderCardSkeleton({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <div className="block p-3 border rounded-md bg-background h-full min-h-[120px] flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-5 w-14 shrink-0 rounded" />
        </div>
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-5 w-14 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-0 p-4 border rounded-lg bg-background h-full min-h-[280px] flex flex-col gap-3">
      <Skeleton className="h-6 w-[90%]" />
      <Skeleton className="h-4 w-[45%]" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-[70%]" />
      <Skeleton className="h-4 w-[55%]" />
      <Skeleton className="h-20 w-full" />
      <div className="mt-auto flex gap-2 pt-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

async function fetchExecutiveOrders({
  skip = 0,
  limit = ORDERS_PER_PAGE,
  state = '',
  days = 30,
  search = '',
  topic = '',
  source = '',
  sortField = 'date_signed',
  sortDir = 'desc',
}: {
  skip?: number;
  limit?: number;
  state?: string;
  days?: number;
  search?: string;
  topic?: string;
  source?: SourceFilter;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}) {
  const params = new URLSearchParams({
    limit: String(limit),
    skip: String(skip),
    days: String(days),
    sortField,
    sortDir,
  });
  if (state && state !== 'All States') params.append('state', state);
  if (search.trim()) params.append('search', search.trim());
  if (topic) params.append('topic', topic);
  if (source) params.append('source', source);

  const response = await fetch(`/api/executive-orders?${params}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }

  const orders = result.data || [];
  return {
    orders,
    hasMore: orders.length >= limit,
  };
}

export function ExecutiveOrdersList({
  initialOrders,
  initialHasMore,
  initialState = 'All States',
  initialDays = 30,
}: ExecutiveOrdersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<ExecutiveOrder[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [skip, setSkip] = useState(initialOrders.length);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stateFilter, setStateFilter] = useState(initialState);
  const [days, setDays] = useState(initialDays);
  const [topic, setTopic] = useState('');
  const [source, setSource] = useState<SourceFilter>('');
  const [sort, setSort] = useState<SortState>({ field: 'date_signed', dir: 'desc' });
  const [compactView, setCompactView] = useState(false);

  const skipRef = useRef(skip);
  const loadingRef = useRef(false);
  const skipFilterFetch = useRef(true);

  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  // Sync from URL on mount / URL change
  useEffect(() => {
    const stateParam = searchParams.get('state');
    const daysParam = searchParams.get('days');
    const topicParam = searchParams.get('topic');
    const sourceParam = searchParams.get('source');
    const searchParam = searchParams.get('search');
    const sortFieldParam = searchParams.get('sortField');
    const sortDirParam = searchParams.get('sortDir');

    const nextState = stateParam || initialState;
    const nextDays = daysParam
      ? (Number.isNaN(parseInt(daysParam, 10)) ? initialDays : parseInt(daysParam, 10))
      : initialDays;
    const nextTopic = topicParam || '';
    const nextSource: SourceFilter =
      sourceParam === 'federal' || sourceParam === 'state' ? sourceParam : '';
    const nextSearch = searchParam || '';
    const nextSortField =
      sortFieldParam === 'date_signed' || sortFieldParam === 'createdAt' || sortFieldParam === 'title'
        ? sortFieldParam
        : 'date_signed';
    const nextSortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

    setStateFilter((prev) => (prev === nextState ? prev : nextState));
    setDays((prev) => (prev === nextDays ? prev : nextDays));
    setTopic((prev) => (prev === nextTopic ? prev : nextTopic));
    setSource((prev) => (prev === nextSource ? prev : nextSource));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setSearchInput((prev) => (prev === nextSearch ? prev : nextSearch));
    setSort((prev) =>
      prev.field === nextSortField && prev.dir === nextSortDir
        ? prev
        : { field: nextSortField, dir: nextSortDir }
    );
  }, [searchParams, initialState, initialDays]);

  const updateURL = useCallback(
    (next: {
      state?: string;
      days?: number;
      topic?: string;
      source?: SourceFilter;
      search?: string;
      sort?: SortState;
    }) => {
      const params = new URLSearchParams();
      const nextState = next.state ?? stateFilter;
      const nextDays = next.days ?? days;
      const nextTopic = next.topic ?? topic;
      const nextSource = next.source ?? source;
      const nextSearch = next.search ?? search;
      const nextSort = next.sort ?? sort;

      if (nextState && nextState !== 'All States') params.set('state', nextState);
      if (nextDays !== 30) params.set('days', String(nextDays));
      if (nextTopic) params.set('topic', nextTopic);
      if (nextSource) params.set('source', nextSource);
      if (nextSearch.trim()) params.set('search', nextSearch.trim());
      if (nextSort.field !== 'date_signed' || nextSort.dir !== 'desc') {
        params.set('sortField', nextSort.field);
        params.set('sortDir', nextSort.dir);
      }

      const qs = params.toString();
      router.replace(qs ? `/executive-orders?${qs}` : '/executive-orders');
    },
    [router, stateFilter, days, topic, source, search, sort]
  );

  const resetAndLoad = useCallback(() => {
    setOrders([]);
    setSkip(0);
    skipRef.current = 0;
    setHasMore(true);
    setError(null);
    setLoading(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const limit = compactView ? COMPACT_PAGE_SIZE : ORDERS_PER_PAGE;
      const { orders: newOrders, hasMore: newHasMore } = await fetchExecutiveOrders({
        skip: skipRef.current,
        limit,
        state: stateFilter === 'All States' ? undefined : stateFilter,
        days,
        search,
        topic,
        source,
        sortField: sort.field,
        sortDir: sort.dir,
      });

      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        return [...prev, ...newOrders.filter((o: ExecutiveOrder) => !existingIds.has(o.id))];
      });
      skipRef.current = skipRef.current + newOrders.length;
      setSkip(skipRef.current);
      setHasMore(newHasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more executive orders';
      setError(errorMessage);
      console.error('Error loading more executive orders:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore, stateFilter, days, search, topic, source, sort, compactView]);

  const handleRefresh = useCallback(async () => {
    resetAndLoad();
    loadingRef.current = true;
    try {
      const limit = compactView ? COMPACT_PAGE_SIZE : ORDERS_PER_PAGE;
      const { orders: newOrders, hasMore: newHasMore } = await fetchExecutiveOrders({
        skip: 0,
        limit,
        state: stateFilter === 'All States' ? undefined : stateFilter,
        days,
        search,
        topic,
        source,
        sortField: sort.field,
        sortDir: sort.dir,
      });
      setOrders(newOrders);
      skipRef.current = newOrders.length;
      setSkip(newOrders.length);
      setHasMore(newHasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh executive orders';
      setError(errorMessage);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [resetAndLoad, compactView, stateFilter, days, search, topic, source, sort]);

  // Refetch when filters change; skip the first pass (SSR initialOrders already match URL)
  useEffect(() => {
    if (skipFilterFetch.current) {
      skipFilterFetch.current = false;
      return;
    }

    let cancelled = false;
    const run = async () => {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      setOrders([]);
      skipRef.current = 0;
      setSkip(0);
      setHasMore(true);
      try {
        const limit = compactView ? COMPACT_PAGE_SIZE : ORDERS_PER_PAGE;
        const { orders: newOrders, hasMore: newHasMore } = await fetchExecutiveOrders({
          skip: 0,
          limit,
          state: stateFilter === 'All States' ? undefined : stateFilter,
          days,
          search,
          topic,
          source,
          sortField: sort.field,
          sortDir: sort.dir,
        });
        if (cancelled) return;
        setOrders(newOrders);
        skipRef.current = newOrders.length;
        setSkip(newOrders.length);
        setHasMore(newHasMore);
      } catch (err) {
        if (cancelled) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to load executive orders';
        setError(errorMessage);
      } finally {
        if (!cancelled) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [search, topic, source, stateFilter, days, sort.field, sort.dir, compactView]);

  useEffect(() => {
    const handleScroll = () => {
      if (loadingRef.current || !hasMore) return;
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (scrollTop + windowHeight >= documentHeight - 500) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, hasMore]);

  const handleSearch = () => {
    if (search === searchInput) return;
    setSearch(searchInput);
    updateURL({ search: searchInput });
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setStateFilter('All States');
    setDays(30);
    setTopic('');
    setSource('');
    setSort({ field: 'date_signed', dir: 'desc' });
    router.replace('/executive-orders');
  };

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(topic) ||
    Boolean(source) ||
    (stateFilter && stateFilter !== 'All States') ||
    days !== 30;

  const dayLabel = DAY_OPTIONS.find((d) => d.value === days)?.label || `Last ${days} days`;

  return (
    <>
      {hasActiveFilters && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {stateFilter && stateFilter !== 'All States' && (
                <Badge variant="default" className="bg-primary">
                  {stateFilter === 'United States' ? 'U.S. Federal' : `State: ${stateFilter}`}
                </Badge>
              )}
              {source && (
                <Badge variant="default" className="bg-primary capitalize">
                  {source} only
                </Badge>
              )}
              {topic && (
                <Badge variant="default" className="bg-primary capitalize">
                  #{topic.replace(/-/g, ' ')}
                </Badge>
              )}
              {search && (
                <Badge variant="default" className="bg-primary">
                  Search: {search}
                </Badge>
              )}
              {days !== 30 && (
                <Badge variant="secondary">{dayLabel}</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Showing matching executive orders
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear Filter
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-center justify-center md:justify-start">
        <div className="relative flex-grow w-full sm:w-auto flex min-w-[300px] md:min-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search executive orders..."
            className="pl-10 w-full min-w-0"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
          <Button className="ml-2 flex-shrink-0" variant="default" onClick={handleSearch} aria-label="Search">
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
              onValueChange={(val) => {
                const [field, dir] = val.split(':') as [SortState['field'], SortState['dir']];
                const next = { field, dir };
                setSort(next);
                updateURL({ sort: next });
              }}
            >
              <DropdownMenuRadioItem value="date_signed:desc">Most Recent</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="date_signed:asc">Oldest</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="createdAt:desc">Recently Added</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="createdAt:asc">Earliest Added</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="title:asc">Alphabetical (A-Z)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="title:desc">Alphabetical (Z-A)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <MapPin className="mr-2 h-4 w-4" />
              {stateFilter === 'United States' ? 'U.S. Federal' : stateFilter || 'All States'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={stateFilter}
              onValueChange={(value) => {
                setStateFilter(value);
                updateURL({ state: value });
              }}
            >
              <DropdownMenuRadioItem value="All States">All States</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="United States">U.S. Federal</DropdownMenuRadioItem>
              {Object.keys(STATE_MAP)
                .sort()
                .map((state) => (
                  <DropdownMenuRadioItem key={state} value={state}>
                    {state}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4" />
              {dayLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={String(days)}
              onValueChange={(value) => {
                const nextDays = parseInt(value, 10);
                setDays(nextDays);
                updateURL({ days: nextDays });
              }}
            >
              {DAY_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={compactView ? 'default' : 'outline'}
          className="w-full sm:w-auto"
          onClick={() => setCompactView(!compactView)}
        >
          {compactView ? <List className="mr-2 h-4 w-4" /> : <Grid3X3 className="mr-2 h-4 w-4" />}
          {compactView ? 'List View' : 'Compact View'}
        </Button>

        <Button variant="outline" className="w-full sm:w-auto" onClick={handleRefresh}>
          Refresh Feed
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { value: '', label: 'All Sources' },
          { value: 'federal', label: 'Federal' },
          { value: 'state', label: 'State' },
        ].map((opt) => (
          <Badge
            key={opt.value || 'all'}
            variant={source === opt.value ? 'default' : 'secondary'}
            onClick={() => {
              const next = opt.value as SourceFilter;
              if (source !== next) {
                setSource(next);
                updateURL({ source: next });
              }
            }}
            className="cursor-pointer"
          >
            {opt.label}
          </Badge>
        ))}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2">Topic Tags</h3>
        <div className="flex flex-wrap gap-2">
          {EXECUTIVE_ORDER_TOPICS.map((cat) => (
            <Badge
              key={cat}
              variant={topic === cat ? 'default' : 'secondary'}
              onClick={() => {
                const next = topic === cat ? '' : cat;
                setTopic(next);
                updateURL({ topic: next });
              }}
              className="cursor-pointer capitalize"
            >
              #{cat.replace(/-/g, ' ')}
            </Badge>
          ))}
        </div>
      </div>

      <div
        className={
          compactView
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-stretch'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch'
        }
      >
        {loading && orders.length === 0
          ? Array.from({ length: compactView ? 12 : 6 }, (_, i) => (
              <OrderCardSkeleton key={`eo-skeleton-${i}`} compact={compactView} />
            ))
          : orders.map((order) => (
              <ExecutiveOrderCard
                key={order.id}
                order={order}
                compact={compactView}
                onTopicClick={(t) => {
                  setTopic(t);
                  updateURL({ topic: t });
                }}
              />
            ))}
      </div>

      {orders.length === 0 && !loading && (
        <AnimatedSection>
          <div className="text-center text-muted-foreground py-12">
            <p className="font-medium">No executive orders found</p>
            <p className="text-sm mt-1">Try adjusting your search criteria</p>
          </div>
        </AnimatedSection>
      )}

      {loading && orders.length > 0 && (
        <div className="flex justify-center py-8">
          <LoadingOverlay text="Loading more executive orders..." />
        </div>
      )}

      {error && (
        <AnimatedSection>
          <div className="text-destructive text-center py-6">
            <p className="font-medium">Error loading executive orders</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadMore} className="mt-2 text-sm underline hover:no-underline">
              Try again
            </button>
          </div>
        </AnimatedSection>
      )}

      {!hasMore && orders.length > 0 && (
        <div className="text-center text-muted-foreground py-8">
          <p className="text-sm">No more executive orders to load</p>
        </div>
      )}
    </>
  );
}
