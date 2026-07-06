import { STATE_MAP } from '@/types/geo';

export interface CompareCandidate {
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
  score?: number;
}

export interface StateComparisonRow {
  jurisdictionName: string;
  stateAbbr: string;
  topBill: CompareCandidate | null;
  isUserState: boolean;
  score: number;
}

export function dotProduct(a: Float32Array | number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) sum += a[i] * b[i];
  return sum;
}

export function keywordScore(query: string, bill: CompareCandidate, topics: string[]): number {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  let score = 0;

  const fields = [
    bill.title,
    bill.geminiSummary,
    bill.identifier,
    ...(bill.subjects || []),
  ]
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

  return score;
}

export function rerankCandidates(
  query: string,
  queryVec: Float32Array | null,
  candidates: CompareCandidate[],
  topics: string[],
): CompareCandidate[] {
  return candidates
    .map((candidate) => {
      let score = 0;
      if (queryVec && candidate.embedding?.length) {
        score = dotProduct(queryVec, candidate.embedding);
      } else {
        score = keywordScore(query, candidate, topics) / 100;
      }
      return { ...candidate, score };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function groupByState(
  ranked: CompareCandidate[],
  userState?: string,
): StateComparisonRow[] {
  const seen = new Set<string>();
  const rows: StateComparisonRow[] = [];
  const normalizedUserState = userState?.toLowerCase();

  for (const bill of ranked) {
    const jurisdiction = bill.jurisdictionName || 'Unknown';
    if (seen.has(jurisdiction)) continue;
    seen.add(jurisdiction);

    const stateAbbr = STATE_MAP[jurisdiction] || jurisdiction.slice(0, 2).toUpperCase();
    rows.push({
      jurisdictionName: jurisdiction,
      stateAbbr,
      topBill: bill,
      isUserState: normalizedUserState
        ? jurisdiction.toLowerCase() === normalizedUserState ||
          stateAbbr.toLowerCase() === normalizedUserState
        : false,
      score: bill.score || 0,
    });
  }

  rows.sort((a, b) => {
    if (a.isUserState && !b.isUserState) return -1;
    if (!a.isUserState && b.isUserState) return 1;
    return b.score - a.score;
  });

  return rows;
}
