import { NextRequest, NextResponse } from 'next/server';
import {
  getExecutiveOrdersByState,
  getRecentExecutiveOrders,
  getExecutiveOrderById
} from '@/services/executiveOrderService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const id = searchParams.get('id');

    // Get specific executive order by ID
    if (id) {
      const order = await getExecutiveOrderById(id);
      if (!order) {
        return NextResponse.json({ error: 'Executive order not found' }, { status: 404 });
      }
      return NextResponse.json({ data: order });
    }

    // Get executive orders by state
    if (state) {
      const orders = await getExecutiveOrdersByState(state, limit, skip);
      return NextResponse.json({
        data: orders,
        count: orders.length,
        state
      });
    }

    // Get recent executive orders (default)
    const orders = await getRecentExecutiveOrders(days, limit, skip);
    return NextResponse.json({
      data: orders,
      count: orders.length,
      days,
      limit
    });

  } catch (error) {
    console.error('Error fetching executive orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
