import { getCollection } from '@/lib/mongodb';
import { classifyLegislationTopics } from '@/services/classifyLegislationService';
import { embedLegislationText } from '@/lib/legislationEmbedding';
import {
  groupByState,
  rerankCandidates,
  getMatchReasons,
  type CompareCandidate,
  type RankingMethod,
  type StateComparisonRow,
} from '@/lib/comparisonScoring';
import { CONFIDENCE_THRESHOLD, VECTOR_SEARCH_INDEX } from '@/lib/comparisonConstants';
import type { Legislation } from '@/types/legislation';

export interface CompareCandidatesResponse {
  query: string;
  detectedTopics: { broad: string[]; narrow: string[] };
  stateResults: StateComparisonRow[];
  lowConfidenceResults: StateComparisonRow[];
  rankingMethod: RankingMethod;
  coverage: EmbeddingCoverage;
}

export interface EmbeddingCoverage {
  embedded: number;
  total: number;
  percent: number;
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

let coverageCache: { data: EmbeddingCoverage; timestamp: number } | null = null;
const COVERAGE_CACHE_TTL = 10 * 60 * 1000;

function serializeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toCandidate(doc: Legislation): CompareCandidate & { embedding?: number[] } {
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

function baseFilters(options: { enactedOnly?: boolean; showCongress?: boolean }) {
  const filters: Record<string, unknown>[] = [
    { geminiSummary: { $exists: true, $nin: [null, ''] } },
  ];

  if (options.enactedOnly) {
    filters.push({ enactedAt: { $exists: true, $ne: null } });
  }

  if (!options.showCongress) {
    filters.push({ jurisdictionName: { $ne: 'United States Congress' } });
  }

  return filters;
}

function buildKeywordConditions(query: string): Record<string, unknown>[] {
  const trimmed = query.trim();
  const terms = trimmed.split(/\s+/).filter((t) => t.length > 2);

  const conditions: Record<string, unknown>[] = [
    { title: { $regex: trimmed, $options: 'i' } },
    { geminiSummary: { $regex: trimmed, $options: 'i' } },
    { subjects: { $regex: trimmed, $options: 'i' } },
  ];

  for (const term of terms) {
    conditions.push(
      { title: { $regex: term, $options: 'i' } },
      { geminiSummary: { $regex: term, $options: 'i' } },
      { subjects: { $regex: term, $options: 'i' } },
    );
  }

  return conditions;
}

function buildTopicConditions(broadTopics: string[], narrowTopics: string[]): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];
  if (broadTopics.length > 0) {
    conditions.push({ 'topicClassification.broadTopics': { $in: broadTopics } });
  }
  if (narrowTopics.length > 0) {
    conditions.push({ 'topicClassification.narrowTopics': { $in: narrowTopics } });
  }
  return conditions;
}

async function fetchStrictCandidates(
  query: string,
  broadTopics: string[],
  narrowTopics: string[],
  options: { enactedOnly?: boolean; showCongress?: boolean },
): Promise<Array<CompareCandidate & { embedding?: number[] }>> {
  const collection = await getCollection('legislation');
  const filters = baseFilters(options);
  const keywordConditions = buildKeywordConditions(query);
  const topicConditions = buildTopicConditions(broadTopics, narrowTopics);

  const attempts: Record<string, unknown>[] = [];

  if (topicConditions.length > 0) {
    attempts.push({
      $and: [...filters, { $or: topicConditions }, { $or: keywordConditions }],
    });
    attempts.push({
      $and: [...filters, { $or: topicConditions }],
    });
  }

  attempts.push({
    $and: [...filters, { $or: keywordConditions }],
  });

  for (const filter of attempts) {
    const docs = await collection
      .find(filter, { projection: PROJECTION })
      .sort({ latestActionAt: -1, updatedAt: -1 })
      .limit(CANDIDATE_LIMIT)
      .toArray();

    if (docs.length >= 10) {
      return docs.map((doc) => toCandidate(doc as unknown as Legislation));
    }
  }

  const lastFilter = attempts[attempts.length - 1];
  const docs = await collection
    .find(lastFilter, { projection: PROJECTION })
    .sort({ latestActionAt: -1, updatedAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .toArray();

  return docs.map((doc) => toCandidate(doc as unknown as Legislation));
}

async function fetchVectorCandidates(
  queryVec: number[],
  options: { enactedOnly?: boolean; showCongress?: boolean },
): Promise<Array<CompareCandidate & { embedding?: number[] }> | null> {
  try {
    const collection = await getCollection('legislation');
    const filter: Record<string, unknown> = {
      geminiSummary: { $exists: true, $nin: [null, ''] },
    };

    if (options.enactedOnly) {
      filter.enactedAt = { $exists: true, $ne: null };
    }
    if (!options.showCongress) {
      filter.jurisdictionName = { $ne: 'United States Congress' };
    }

    const docs = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_SEARCH_INDEX,
            path: 'embedding',
            queryVector: queryVec,
            numCandidates: 500,
            limit: 200,
            filter,
          },
        },
        {
          $project: {
            ...PROJECTION,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray();

    if (docs.length === 0) return null;

    return docs.map((doc) => {
      const candidate = toCandidate(doc as unknown as Legislation);
      if (typeof doc.score === 'number') {
        candidate.score = doc.score;
      }
      return candidate;
    });
  } catch (error) {
    console.warn('Vector search unavailable, falling back to in-memory ranking:', error);
    return null;
  }
}

export async function getEmbeddingCoverage(): Promise<EmbeddingCoverage> {
  if (coverageCache && Date.now() - coverageCache.timestamp < COVERAGE_CACHE_TTL) {
    return coverageCache.data;
  }

  const collection = await getCollection('legislation');
  const baseFilter = {
    jurisdictionName: { $ne: 'United States Congress' },
    geminiSummary: { $exists: true, $nin: [null, ''] },
  };

  const [total, embedded] = await Promise.all([
    collection.countDocuments(baseFilter),
    collection.countDocuments({
      ...baseFilter,
      embedding: { $exists: true, $type: 'array', $ne: [] },
    }),
  ]);

  const data: EmbeddingCoverage = {
    total,
    embedded,
    percent: total > 0 ? Math.round((embedded / total) * 100) : 0,
  };

  coverageCache = { data, timestamp: Date.now() };
  return data;
}

export async function getComparisonCandidates(
  query: string,
  options: { enactedOnly?: boolean; showCongress?: boolean; userState?: string } = {},
): Promise<CompareCandidatesResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    const coverage = await getEmbeddingCoverage();
    return {
      query: trimmed,
      detectedTopics: { broad: [], narrow: [] },
      stateResults: [],
      lowConfidenceResults: [],
      rankingMethod: 'keyword',
      coverage,
    };
  }

  const classification = classifyLegislationTopics(trimmed);
  const broadTopics = classification.broadTopics;
  const narrowTopics = classification.narrowTopics;
  const topics = [...broadTopics, ...narrowTopics];
  const coverage = await getEmbeddingCoverage();

  const queryVec = await embedLegislationText(trimmed);
  let rankingMethod: RankingMethod = queryVec ? 'vector' : 'keyword';
  let rankedCandidates: CompareCandidate[] = [];

  if (queryVec) {
    const vectorResults = await fetchVectorCandidates(queryVec, options);
    if (vectorResults && vectorResults.length >= 10) {
      rankedCandidates = vectorResults.map((candidate) => ({
        ...candidate,
        embedding: undefined,
        matchReasons: getMatchReasons(trimmed, candidate, topics),
      }));
      rankingMethod = 'vector';
    }
  }

  if (rankedCandidates.length < 10) {
    const strictCandidates = await fetchStrictCandidates(
      trimmed,
      broadTopics,
      narrowTopics,
      options,
    );

    const { candidates, method } = rerankCandidates(trimmed, queryVec, strictCandidates, topics);
    rankedCandidates = candidates;
    rankingMethod = method;
  }

  const grouped = groupByState(rankedCandidates, options.userState, rankingMethod);
  const confident = grouped.filter((row) => !row.lowConfidence);
  const lowConfidence = grouped.filter((row) => row.lowConfidence);

  return {
    query: trimmed,
    detectedTopics: { broad: broadTopics, narrow: narrowTopics },
    stateResults: confident,
    lowConfidenceResults: lowConfidence,
    rankingMethod,
    coverage,
  };
}

export { CONFIDENCE_THRESHOLD };
