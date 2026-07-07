import { CONFIDENCE_THRESHOLD } from '@/lib/comparisonConstants';
import { STATE_MAP } from '@/types/geo';

export interface CompareCandidate {
  id: string;
  identifier?: string;
  title?: string;
  jurisdictionName?: string;
  geminiSummary?: string | null;
  longGeminiSummary?: string | null;
  enactedAt?: string | null;
  latestActionAt?: string | null;
  statusText?: string | null;
  chamber?: string | null;
  subjects?: string[];
  score?: number;
  matchReasons?: string[];
}

export interface StateComparisonRow {
  jurisdictionName: string;
  stateAbbr: string;
  topBill: CompareCandidate | null;
  isUserState: boolean;
  score: number;
  matchReasons: string[];
  lowConfidence: boolean;
}

export type RankingMethod = 'vector' | 'keyword';

export function dotProduct(a: Float32Array | number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

export function scoreToPercent(score: number, method: RankingMethod): number {
  if (method === 'vector') {
    if (score >= 0 && score <= 1) return score * 100;
    return Math.max(0, Math.min(100, ((score + 1) / 2) * 100));
  }
  return Math.max(0, Math.min(100, score * 100));
}

export function getMatchReasons(
  query: string,
  bill: CompareCandidate,
  topics: string[],
): string[] {
  const reasons: string[] = [];
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const haystack = [bill.title, bill.geminiSummary, bill.identifier, ...(bill.subjects || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const topic of topics) {
    if (haystack.includes(topic.toLowerCase())) {
      reasons.push(`Topic: ${topic}`);
    }
  }

  for (const term of terms) {
    if (bill.title?.toLowerCase().includes(term)) {
      reasons.push(`"${term}" in title`);
    } else if (bill.geminiSummary?.toLowerCase().includes(term)) {
      reasons.push(`"${term}" in summary`);
    } else if (bill.subjects?.some((s) => s.toLowerCase().includes(term))) {
      reasons.push(`"${term}" in subjects`);
    }
  }

  if (reasons.length === 0 && bill.geminiSummary) {
    reasons.push('Semantic similarity');
  }

  return [...new Set(reasons)].slice(0, 4);
}

export function keywordScore(query: string, bill: CompareCandidate, topics: string[]): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  let score = 0;

  const fields = [bill.title, bill.geminiSummary, bill.identifier, ...(bill.subjects || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const term of terms) {
    if (fields.includes(term)) score += 10;
  }

  for (const topic of topics) {
    if (fields.includes(topic.toLowerCase())) score += 15;
  }

  if (bill.title && terms.some((t) => bill.title!.toLowerCase().includes(t))) {
    score += 20;
  }

  if (bill.geminiSummary) score += 5;

  return score;
}

export function rerankCandidates(
  query: string,
  queryVec: number[] | null,
  candidates: Array<CompareCandidate & { embedding?: number[] }>,
  topics: string[],
): { candidates: CompareCandidate[]; method: RankingMethod } {
  const hasEmbeddings = Boolean(queryVec && candidates.some((c) => c.embedding?.length));
  const method: RankingMethod = hasEmbeddings ? 'vector' : 'keyword';

  const ranked = candidates
    .map((candidate) => {
      let score = candidate.score ?? 0;
      if (hasEmbeddings && candidate.embedding?.length && queryVec) {
        score = dotProduct(queryVec, candidate.embedding);
      } else if (!candidate.score) {
        score = keywordScore(query, candidate, topics) / 100;
      }

      return {
        ...candidate,
        embedding: undefined,
        score,
        matchReasons: getMatchReasons(query, candidate, topics),
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return { candidates: ranked, method };
}

export function groupByState(
  ranked: CompareCandidate[],
  userState?: string,
  rankingMethod: RankingMethod = 'vector',
): StateComparisonRow[] {
  const seen = new Set<string>();
  const rows: StateComparisonRow[] = [];
  const normalizedUserState = userState?.toLowerCase();

  for (const bill of ranked) {
    const jurisdiction = bill.jurisdictionName || 'Unknown';
    if (seen.has(jurisdiction)) continue;
    seen.add(jurisdiction);

    const stateAbbr = STATE_MAP[jurisdiction] || jurisdiction.slice(0, 2).toUpperCase();
    const rawScore = bill.score || 0;
    const percentScore = scoreToPercent(rawScore, rankingMethod) / 100;

    rows.push({
      jurisdictionName: jurisdiction,
      stateAbbr,
      topBill: bill,
      isUserState: normalizedUserState
        ? jurisdiction.toLowerCase() === normalizedUserState ||
          stateAbbr.toLowerCase() === normalizedUserState
        : false,
      score: percentScore,
      matchReasons: bill.matchReasons || [],
      lowConfidence: percentScore < CONFIDENCE_THRESHOLD,
    });
  }

  rows.sort((a, b) => {
    if (a.isUserState && !b.isUserState) return -1;
    if (!a.isUserState && b.isUserState) return 1;
    return b.score - a.score;
  });

  return rows;
}

export function partitionByConfidence(rows: StateComparisonRow[]): {
  confident: StateComparisonRow[];
  lowConfidence: StateComparisonRow[];
} {
  const confident = rows.filter((row) => !row.lowConfidence);
  const lowConfidence = rows.filter((row) => row.lowConfidence);
  return { confident, lowConfidence };
}
