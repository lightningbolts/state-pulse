import { getCollection } from '@/lib/mongodb';
import { ExecutiveOrder } from '@/types/executiveOrder';
import type { SortDirection } from 'mongodb';

const COLLECTION_NAME = 'executive_orders';

export type ExecutiveOrderSortField = 'date_signed' | 'createdAt' | 'title';

export interface ExecutiveOrderQueryOptions {
  state?: string;
  days?: number;
  limit?: number;
  skip?: number;
  search?: string;
  topic?: string;
  source?: 'federal' | 'state' | '';
  sortField?: ExecutiveOrderSortField;
  sortDir?: 'asc' | 'desc';
}

export async function upsertExecutiveOrder(order: Omit<ExecutiveOrder, 'createdAt' | 'updatedAt'>): Promise<void> {
  const collection = await getCollection(COLLECTION_NAME);

  const now = new Date();

  // Remove any existing createdAt and separate update vs insert data
  const { createdAt, ...orderData } = order as any;
  const updateData = { ...orderData, updatedAt: now };

  const result = await collection.updateOne(
    { id: order.id },
    {
      $set: updateData,
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );

  console.log(`Upserted executive order: ${order.id} (${result.upsertedCount ? 'created' : 'updated'})`);
}

export async function getExecutiveOrderById(id: string): Promise<ExecutiveOrder | null> {
  const collection = await getCollection(COLLECTION_NAME);
  const doc = await collection.findOne({ id });

  if (!doc) return null;

  return doc as unknown as ExecutiveOrder;
}

export async function getExecutiveOrdersByState(state: string, limit: number = 100, skip: number = 0): Promise<ExecutiveOrder[]> {
  return queryExecutiveOrders({ state, limit, skip });
}

export async function getExecutiveOrdersNeedingSummary(limit: number = 10): Promise<ExecutiveOrder[]> {
  const collection = await getCollection(COLLECTION_NAME);
  const docs = await collection
    .find({
      $and: [
        { $or: [{ geminiSummary: null }, { geminiSummary: { $exists: false } }] },
        { full_text: { $ne: null, $exists: true } }
      ]
    })
    .limit(limit)
    .toArray();

  return docs as unknown as ExecutiveOrder[];
}

export async function updateExecutiveOrderSummary(id: string, geminiSummary: string, topics: string[] = []): Promise<void> {
  const collection = await getCollection(COLLECTION_NAME);

  await collection.updateOne(
    { id },
    {
      $set: {
        geminiSummary,
        topics: [...new Set(topics)], // deduplicate topics
        updatedAt: new Date()
      }
    }
  );

  console.log(`Updated summary for executive order: ${id}`);
}

export async function getRecentExecutiveOrders(days: number = 30, limit: number = 50, skip: number = 0): Promise<ExecutiveOrder[]> {
  return queryExecutiveOrders({ days, limit, skip });
}

export async function queryExecutiveOrders(options: ExecutiveOrderQueryOptions = {}): Promise<ExecutiveOrder[]> {
  const {
    state,
    days = 30,
    limit = 50,
    skip = 0,
    search,
    topic,
    source,
    sortField = 'date_signed',
    sortDir = 'desc',
  } = options;

  const collection = await getCollection(COLLECTION_NAME);
  const filter: Record<string, unknown> = {};

  if (state && state !== 'All States') {
    filter.state = state;
  }

  if (days && days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    filter.date_signed = { $gte: cutoffDate };
  }

  if (topic) {
    filter.topics = topic;
  }

  if (source === 'federal') {
    filter.source_type = { $in: ['federal_register', 'whitehouse_website'] };
  } else if (source === 'state') {
    filter.source_type = 'governor_website';
  }

  if (search?.trim()) {
    const regex = { $regex: search.trim(), $options: 'i' };
    filter.$or = [
      { title: regex },
      { summary: regex },
      { geminiSummary: regex },
      { governor_or_president: regex },
      { number: regex },
      { state: regex },
    ];
  }

  const sort: Record<string, SortDirection> = {
    [sortField]: sortDir === 'asc' ? 1 : -1,
  };

  const docs = await collection
    .find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs as unknown as ExecutiveOrder[];
}
