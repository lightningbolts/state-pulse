import { NextRequest, NextResponse } from 'next/server';
import {
  getExecutiveOrderById,
  queryExecutiveOrders,
  type ExecutiveOrderSortField,
} from '@/services/executiveOrderService';
import { CACHE, jsonWithCdnCache } from '@/lib/cdnCache';

const VALID_SORT_FIELDS = new Set<ExecutiveOrderSortField>(['date_signed', 'createdAt', 'title']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const state = searchParams.get('state') || undefined;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const search = searchParams.get('search') || undefined;
    const topic = searchParams.get('topic') || undefined;
    const sourceParam = searchParams.get('source');
    const source =
      sourceParam === 'federal' || sourceParam === 'state' ? sourceParam : undefined;
    const sortFieldParam = searchParams.get('sortField') || 'date_signed';
    const sortField = VALID_SORT_FIELDS.has(sortFieldParam as ExecutiveOrderSortField)
      ? (sortFieldParam as ExecutiveOrderSortField)
      : 'date_signed';
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

    if (id) {
      const order = await getExecutiveOrderById(id);
      if (!order) {
        return NextResponse.json({ error: 'Executive order not found' }, { status: 404 });
      }
      return jsonWithCdnCache({ data: order }, CACHE.medium);
    }

    const orders = await queryExecutiveOrders({
      state,
      days: Number.isFinite(days) ? days : 30,
      limit: Number.isFinite(limit) ? limit : 50,
      skip: Number.isFinite(skip) ? skip : 0,
      search,
      topic,
      source,
      sortField,
      sortDir,
    });

    return jsonWithCdnCache({
      data: orders,
      count: orders.length,
      state: state || null,
      days,
      limit,
      skip,
      search: search || null,
      topic: topic || null,
      source: source || null,
      sortField,
      sortDir,
    }, CACHE.list);
  } catch (error) {
    console.error('Error fetching executive orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
