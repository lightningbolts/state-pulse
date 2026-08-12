import React, { Suspense } from 'react';
import { ExecutiveOrdersList } from '@/components/features/ExecutiveOrdersList';
import { queryExecutiveOrders } from '@/services/executiveOrderService';
import { ExecutiveOrder } from '@/types/executiveOrder';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelBody } from '@/components/layout/Panel';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { Badge } from '@/components/ui/badge';

interface ExecutiveOrdersPageProps {
  searchParams: Promise<{
    state?: string;
    days?: string;
    search?: string;
    topic?: string;
    source?: string;
    sortField?: string;
    sortDir?: string;
  }>;
}

const ORDERS_PER_PAGE = 20;

function serializeExecutiveOrder(order: ExecutiveOrder): ExecutiveOrder {
  return {
    id: order.id,
    state: order.state,
    governor_or_president: order.governor_or_president,
    title: order.title,
    number: order.number,
    date_signed: new Date(order.date_signed),
    full_text_url: order.full_text_url,
    summary: order.summary || null,
    geminiSummary: order.geminiSummary || null,
    topics: order.topics || [],
    createdAt: new Date(order.createdAt),
    updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
    full_text: order.full_text || null,
    source_type: order.source_type,
    raw_data: order.raw_data ? JSON.parse(JSON.stringify(order.raw_data)) : undefined,
  };
}

async function getInitialExecutiveOrders(params: {
  state?: string;
  days?: number;
  search?: string;
  topic?: string;
  source?: 'federal' | 'state';
  sortField?: 'date_signed' | 'createdAt' | 'title';
  sortDir?: 'asc' | 'desc';
}) {
  try {
    const orders = await queryExecutiveOrders({
      state: params.state,
      days: params.days ?? 30,
      limit: ORDERS_PER_PAGE,
      skip: 0,
      search: params.search,
      topic: params.topic,
      source: params.source,
      sortField: params.sortField ?? 'date_signed',
      sortDir: params.sortDir ?? 'desc',
    });
    return {
      orders: orders.map(serializeExecutiveOrder),
      hasMore: orders.length === ORDERS_PER_PAGE,
    };
  } catch (error) {
    console.error('Error fetching initial executive orders:', error);
    return { orders: [], hasMore: false };
  }
}

export default async function ExecutiveOrdersPage({ searchParams }: ExecutiveOrdersPageProps) {
  const resolvedSearchParams = await searchParams;
  const state = resolvedSearchParams.state || 'All States';
  const days = resolvedSearchParams.days ? parseInt(resolvedSearchParams.days, 10) : 30;
  const search = resolvedSearchParams.search || undefined;
  const topic = resolvedSearchParams.topic || undefined;
  const source =
    resolvedSearchParams.source === 'federal' || resolvedSearchParams.source === 'state'
      ? resolvedSearchParams.source
      : undefined;
  const sortField =
    resolvedSearchParams.sortField === 'createdAt' ||
    resolvedSearchParams.sortField === 'title' ||
    resolvedSearchParams.sortField === 'date_signed'
      ? resolvedSearchParams.sortField
      : 'date_signed';
  const sortDir = resolvedSearchParams.sortDir === 'asc' ? 'asc' : 'desc';

  const { orders: initialOrders, hasMore: initialHasMore } = await getInitialExecutiveOrders({
    state: state === 'All States' ? undefined : state,
    days: Number.isFinite(days) ? days : 30,
    search,
    topic,
    source,
    sortField,
    sortDir,
  });

  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Executive Orders"
        subtitle="Track presidential and governor executive orders with AI-powered summaries. Filter by jurisdiction, topic, or search for specific orders."
        badge={<Badge variant="secondary">Beta</Badge>}
      />
      <Panel>
        <PanelBody>
          <Suspense fallback={<PageSkeleton variant="feed" />}>
            <ExecutiveOrdersList
              initialOrders={initialOrders}
              initialHasMore={initialHasMore}
              initialState={state}
              initialDays={Number.isFinite(days) ? days : 30}
            />
          </Suspense>
        </PanelBody>
      </Panel>
    </div>
  );
}
