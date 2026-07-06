import { getCollection } from '@/lib/mongodb';
import { classifyLegislationTopics } from '@/services/classifyLegislationService';
import type { Legislation } from '@/types/legislation';

export interface CompareCandidatePayload {
  id: string;
  identifier?: string;
  title?: string;
  jurisdictionName?: string;
  embedding?: number[];
  geminiSummary?: string | null;
  longGeminiSummary?: string | null;
  enactedAt?: string | null;
  latestActionAt?: string | null;
  statusText?: string | null;
  chamber?: string | null;
  subjects?: string[];
}

export interface CompareCandidatesResponse {
  query: string;
  detectedTopics: { broad: string[]; narrow: string[] };
  candidates: CompareCandidatePayload[];
}

const CANDIDATE_LIMIT = 300;

const PROJECTION = {
  id: 1,
  identifier: 1,
  title: 1,
  jurisdictionName: 1,
  embedding: 1,
  geminiSummary: 1,
  longGeminiSummary: 1,
  enactedAt: 1,
  latestActionAt: 1,
  statusText: 1,
  chamber: 1,
  subjects: 1,
} as const;

function serializeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toPayload(doc: Legislation): CompareCandidatePayload {
  return {
    id: doc.id,
    identifier: doc.identifier,
    title: doc.title,
    jurisdictionName: doc.jurisdictionName,
    embedding: doc.embedding,
    geminiSummary: doc.geminiSummary,
    longGeminiSummary: doc.longGeminiSummary,
    enactedAt: serializeDate(doc.enactedAt),
    latestActionAt: serializeDate(doc.latestActionAt),
    statusText: doc.statusText,
    chamber: doc.chamber,
    subjects: doc.subjects,
  };
}

export async function getComparisonCandidates(
  query: string,
  options: { enactedOnly?: boolean; showCongress?: boolean } = {},
): Promise<CompareCandidatesResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: trimmed, detectedTopics: { broad: [], narrow: [] }, candidates: [] };
  }

  const classification = classifyLegislationTopics(trimmed);
  const broadTopics = classification.broadTopics;
  const narrowTopics = classification.narrowTopics;

  const collection = await getCollection('legislation');
  const matchConditions: Record<string, unknown>[] = [];

  if (options.enactedOnly) {
    matchConditions.push({ enactedAt: { $exists: true, $ne: null } });
  }

  if (!options.showCongress) {
    matchConditions.push({ jurisdictionName: { $ne: 'United States Congress' } });
  }

  const topicOr: Record<string, unknown>[] = [];
  if (broadTopics.length > 0) {
    topicOr.push({ 'topicClassification.broadTopics': { $in: broadTopics } });
  }
  if (narrowTopics.length > 0) {
    topicOr.push({ 'topicClassification.narrowTopics': { $in: narrowTopics } });
  }

  const searchOr = [
    { title: { $regex: trimmed, $options: 'i' } },
    { summary: { $regex: trimmed, $options: 'i' } },
    { identifier: { $regex: trimmed, $options: 'i' } },
    { subjects: { $regex: trimmed, $options: 'i' } },
    { geminiSummary: { $regex: trimmed, $options: 'i' } },
    { latestActionDescription: { $regex: trimmed, $options: 'i' } },
  ];

  for (const term of trimmed.split(/\s+/).filter((t) => t.length > 2)) {
    searchOr.push(
      { title: { $regex: term, $options: 'i' } },
      { geminiSummary: { $regex: term, $options: 'i' } },
      { subjects: { $regex: term, $options: 'i' } },
    );
  }

  const contentOr = [...topicOr, ...searchOr];
  if (contentOr.length > 0) {
    matchConditions.push({ $or: contentOr });
  }

  const filter = matchConditions.length > 0 ? { $and: matchConditions } : {};

  let docs = await collection
    .find(filter, { projection: PROJECTION })
    .sort({ latestActionAt: -1, updatedAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .toArray();

  if (docs.length < 50) {
    const fallbackFilter: Record<string, unknown> = {};
    if (options.enactedOnly) {
      fallbackFilter.enactedAt = { $exists: true, $ne: null };
    }
    if (!options.showCongress) {
      fallbackFilter.jurisdictionName = { $ne: 'United States Congress' };
    }

    const fallbackDocs = await collection
      .find(fallbackFilter, { projection: PROJECTION })
      .sort({ latestActionAt: -1 })
      .limit(CANDIDATE_LIMIT)
      .toArray();

    const seen = new Set(docs.map((d) => d.id));
    for (const doc of fallbackDocs) {
      if (!seen.has(doc.id)) {
        docs.push(doc);
        seen.add(doc.id);
      }
      if (docs.length >= CANDIDATE_LIMIT) break;
    }
  }

  const withEmbeddings = docs.filter((d) => d.embedding?.length);
  const withoutEmbeddings = docs.filter((d) => !d.embedding?.length);
  const ordered = [...withEmbeddings, ...withoutEmbeddings].slice(0, CANDIDATE_LIMIT);

  return {
    query: trimmed,
    detectedTopics: { broad: broadTopics, narrow: narrowTopics },
    candidates: ordered.map((doc) => toPayload(doc as Legislation)),
  };
}
