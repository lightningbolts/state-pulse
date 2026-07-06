import { getCollection } from '@/lib/mongodb';
import type { Legislation } from '@/types/legislation';
import type { Representative } from '@/types/representative';

export interface HomepageStats {
  legislation: {
    total: number;
    recent: number;
    active: number;
    daily: number;
    topSubjects: Array<{ subject: string; count: number }>;
  };
  representatives: {
    total: number;
    state: number;
    congress: number;
    parties: Array<{ _id: string; count: number }>;
  };
  posts: {
    total: number;
    recent: number;
    active: number;
  };
  jurisdictions: number;
  lastUpdated: string;
}

export interface HomepageExamples {
  legislation: Legislation | null;
  representative: Representative | null;
}

export async function fetchHomepageStats(): Promise<HomepageStats | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/homepage/stats`, {
      next: { revalidate: 300 },
    });
    const data = await response.json();
    return data.success ? data.stats : data.stats ?? null;
  } catch {
    return null;
  }
}

export async function fetchHomepageExamples(): Promise<HomepageExamples> {
  try {
    const legislationCollection = await getCollection('legislation');
    const representativesCollection = await getCollection('representatives');

    const [legislationCount, repCount] = await Promise.all([
      legislationCollection.countDocuments(),
      representativesCollection.countDocuments(),
    ]);

    const [legislation, representative] = await Promise.all([
      legislationCount > 0
        ? legislationCollection
            .aggregate([{ $sample: { size: 1 } }])
            .toArray()
            .then((docs) => (docs[0] ? JSON.parse(JSON.stringify(docs[0])) : null))
        : Promise.resolve(null),
      repCount > 0
        ? representativesCollection
            .aggregate([{ $sample: { size: 1 } }])
            .toArray()
            .then((docs) => (docs[0] ? JSON.parse(JSON.stringify(docs[0])) : null))
        : Promise.resolve(null),
    ]);

    return {
      legislation: legislation as Legislation | null,
      representative: representative as Representative | null,
    };
  } catch {
    return { legislation: null, representative: null };
  }
}
