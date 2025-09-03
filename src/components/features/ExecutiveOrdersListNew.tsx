"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ExecutiveOrder } from '@/types/executiveOrder';
import { Card, CardContent } from '../ui/card';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { ExecutiveOrderCard } from './ExecutiveOrderCard';
import { useSearchParams, useRouter } from 'next/navigation';

interface ExecutiveOrdersListProps {
  initialOrders: ExecutiveOrder[];
  initialHasMore: boolean;
  state?: string;
  days?: number;
}

const ORDERS_PER_PAGE = 20;

// Fetch function to get executive orders
async function fetchExecutiveOrders({
  skip = 0,
  limit = ORDERS_PER_PAGE,
  state = "",
  days = 30
}: {
  skip?: number;
  limit?: number;
  state?: string;
  days?: number;
}) {
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (state && state !== 'All States') params.append('state', state);
  if (days) params.append('days', String(days));

  const response = await fetch(`/api/executive-orders?${params}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }

  return {
    orders: result.data || [],
    hasMore: (result.data || []).length === limit
  };
}

export function ExecutiveOrdersList({
  initialOrders,
  initialHasMore,
  state,
  days
}: ExecutiveOrdersListProps) {
  const [orders, setOrders] = useState<ExecutiveOrder[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [skip, setSkip] = useState(initialOrders.length);
  const [error, setError] = useState<string | null>(null);

  const skipRef = useRef(skip);
  const loadingRef = useRef(false);
  const scrollPositionKey = `executive-orders-scroll-${state}-${days}`;

  const searchParams = useSearchParams();
  const router = useRouter();

  // Update skip ref when skip state changes
  useEffect(() => {
    skipRef.current = skip;
  }, [skip]);

  // Reset data when filters change
  useEffect(() => {
    setOrders(initialOrders);
    setSkip(initialOrders.length);
    setHasMore(initialHasMore);
    setError(null);
  }, [initialOrders, initialHasMore, state, days]);

  // Save scroll position before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem(scrollPositionKey, window.scrollY.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [scrollPositionKey]);

  // Restore scroll position after component mounts
  useLayoutEffect(() => {
    const savedScrollPosition = sessionStorage.getItem(scrollPositionKey);
    if (savedScrollPosition) {
      const scrollY = parseInt(savedScrollPosition, 10);
      if (!isNaN(scrollY)) {
        window.scrollTo(0, scrollY);
        // Clear the saved position after restoring
        sessionStorage.removeItem(scrollPositionKey);
      }
    }
  }, [scrollPositionKey]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { orders: newOrders, hasMore: newHasMore } = await fetchExecutiveOrders({
        skip: skipRef.current,
        limit: ORDERS_PER_PAGE,
        state: state === 'All States' ? undefined : state,
        days
      });

      setOrders(prev => [...prev, ...newOrders]);
      setSkip(prev => prev + newOrders.length);
      setHasMore(newHasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more executive orders';
      setError(errorMessage);
      console.error('Error loading more executive orders:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore, state, days]);

  // Infinite scroll implementation
  useEffect(() => {
    const handleScroll = () => {
      if (loadingRef.current || !hasMore) return;

      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Load more when user is 500px from bottom
      if (scrollTop + windowHeight >= documentHeight - 500) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, hasMore]);

  if (orders.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <p className="font-medium">No executive orders found</p>
            <p className="text-sm mt-1">Try adjusting your search criteria</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order, idx) => (
        <ExecutiveOrderCard key={order.id} order={order} />
      ))}

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingOverlay />
        </div>
      )}

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-red-600 text-center">
              <p className="font-medium">Error loading executive orders</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={loadMore}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasMore && orders.length > 0 && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No more executive orders to load</p>
        </div>
      )}
    </div>
  );
}
