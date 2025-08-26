import { getCollection } from '../lib/mongodb';
import { ExecutiveOrder } from '../types/executiveOrder';

const COLLECTION_NAME = 'executive_orders';

export async function upsertExecutiveOrder(order: Omit<ExecutiveOrder, 'createdAt' | 'updatedAt'>): Promise<void> {
  const collection = await getCollection(COLLECTION_NAME);

  const now = new Date();

  // Separate the data that should always be updated vs data that should only be set on insert
  const updateData = { ...order, updatedAt: now };

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

  return doc as ExecutiveOrder;
}

export async function getExecutiveOrdersByState(state: string, limit: number = 100, skip: number = 0): Promise<ExecutiveOrder[]> {
  const collection = await getCollection(COLLECTION_NAME);
  const docs = await collection
    .find({ state })
    .sort({ date_signed: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs as ExecutiveOrder[];
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

  return docs as ExecutiveOrder[];
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
  const collection = await getCollection(COLLECTION_NAME);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const docs = await collection
    .find({ date_signed: { $gte: cutoffDate } })
    .sort({ date_signed: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs as ExecutiveOrder[];
}
