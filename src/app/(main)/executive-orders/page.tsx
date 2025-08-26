import React from 'react';
import { ExecutiveOrdersList } from '../../../components/features/ExecutiveOrdersList';
import { ExecutiveOrderFilters } from '../../../components/features/ExecutiveOrderFilters';
import { getRecentExecutiveOrders, getExecutiveOrdersByState } from '../../../services/executiveOrderService';
import { ExecutiveOrder } from '../../../types/executiveOrder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';

interface ExecutiveOrdersPageProps {
  searchParams: {
    state?: string;
    days?: string;
  };
}

const ORDERS_PER_PAGE = 20;

// Serialize executive order data for client-side consumption
function serializeExecutiveOrder(order: ExecutiveOrder): ExecutiveOrder {
  return {
    id: order.id,
    state: order.state,
    governor_or_president: order.governor_or_president,
    title: order.title,
    number: order.number,
    date_signed: new Date(order.date_signed), // Ensure it's a proper Date object
    full_text_url: order.full_text_url,
    summary: order.summary || null,
    geminiSummary: order.geminiSummary || null,
    topics: order.topics || [],
    createdAt: new Date(order.createdAt), // Ensure it's a proper Date object
    updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
    full_text: order.full_text || null,
    source_type: order.source_type,
    raw_data: order.raw_data ? JSON.parse(JSON.stringify(order.raw_data)) : undefined
  };
}

// Server-side function to fetch initial data
async function getInitialExecutiveOrders(state?: string, days?: number) {
  try {
    let orders: ExecutiveOrder[];

    if (state && state !== 'All States') {
      orders = await getExecutiveOrdersByState(state, ORDERS_PER_PAGE);
    } else {
      orders = await getRecentExecutiveOrders(days || 30, ORDERS_PER_PAGE);
    }

    // Serialize the orders to remove non-serializable MongoDB objects
    const serializedOrders = orders.map(serializeExecutiveOrder);

    return {
      orders: serializedOrders,
      hasMore: orders.length === ORDERS_PER_PAGE
    };
  } catch (error) {
    console.error('Error fetching initial executive orders:', error);
    return {
      orders: [],
      hasMore: false
    };
  }
}

export default async function ExecutiveOrdersPage({ searchParams }: ExecutiveOrdersPageProps) {
  const resolvedSearchParams = await searchParams;
  const state = resolvedSearchParams.state || 'All States';
  const days = resolvedSearchParams.days ? parseInt(resolvedSearchParams.days) : 30;

  // Fetch initial data server-side
  const { orders: initialOrders, hasMore: initialHasMore } = await getInitialExecutiveOrders(
    state === 'All States' ? undefined : state,
    days
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Executive Orders (Beta)</CardTitle>
          <CardDescription>
            Track presidential and governor executive orders with AI-powered summaries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Filters */}
            <ExecutiveOrderFilters
              initialState={state}
              initialDays={days}
            />

            {/* Results Summary */}
            <div className="text-sm text-gray-600">
              Showing executive orders
              {state !== 'All States' && (
                <span className="font-medium"> from {state}</span>
              )}
              {days && (
                <span className="font-medium"> from the last {days} days</span>
              )}
              {initialOrders.length > 0 && (
                <span> • {initialOrders.length}+ results found</span>
              )}
            </div>

            {/* Executive Orders List */}
            <ExecutiveOrdersList
              initialOrders={initialOrders}
              initialHasMore={initialHasMore}
              state={state}
              days={days}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
