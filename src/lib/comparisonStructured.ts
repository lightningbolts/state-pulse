import type { StateComparisonRow } from '@/lib/comparisonScoring';

export interface StructuredComparisonEntry {
  jurisdictionName: string;
  identifier: string;
  title: string;
  excerpt: string;
  statusLabel: string;
  isUserState: boolean;
  enacted: boolean;
}

export interface StructuredComparisonGroup {
  label: string;
  entries: StructuredComparisonEntry[];
}

function statusLabel(row: StateComparisonRow): string {
  if (row.topBill?.enactedAt) return 'Enacted';
  if (row.topBill?.statusText) return row.topBill.statusText;
  return 'In progress';
}

function excerpt(row: StateComparisonRow): string {
  const bill = row.topBill;
  if (!bill) return 'No matching bill found.';
  const text = bill.geminiSummary || bill.title || '';
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

export function buildStructuredComparison(
  rows: StateComparisonRow[],
  userState?: string,
): StructuredComparisonGroup[] {
  const normalizedUser = userState?.toLowerCase();
  const entries: StructuredComparisonEntry[] = rows
    .filter((row) => row.topBill)
    .map((row) => ({
      jurisdictionName: row.jurisdictionName,
      identifier: row.topBill?.identifier || 'Bill',
      title: row.topBill?.title || '',
      excerpt: excerpt(row),
      statusLabel: statusLabel(row),
      isUserState: normalizedUser
        ? row.jurisdictionName.toLowerCase() === normalizedUser ||
          row.stateAbbr.toLowerCase() === normalizedUser
        : row.isUserState,
      enacted: Boolean(row.topBill?.enactedAt),
    }));

  const enacted = entries.filter((e) => e.enacted);
  const inProgress = entries.filter((e) => !e.enacted);

  const sortEntries = (list: StructuredComparisonEntry[]) =>
    [...list].sort((a, b) => {
      if (a.isUserState && !b.isUserState) return -1;
      if (!a.isUserState && b.isUserState) return 1;
      return a.jurisdictionName.localeCompare(b.jurisdictionName);
    });

  const groups: StructuredComparisonGroup[] = [];
  if (enacted.length > 0) {
    groups.push({ label: 'Enacted', entries: sortEntries(enacted) });
  }
  if (inProgress.length > 0) {
    groups.push({ label: 'In progress or pending', entries: sortEntries(inProgress) });
  }
  return groups;
}
