import type { Legislation } from '@/types/legislation';
import { enactedPatterns } from "@/types/legislation";

function toEnactedDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function matchesEnactedPattern(text: string | undefined | null): boolean {
  if (!text) return false;
  return enactedPatterns.some((pattern) => pattern.test(text));
}

/**
 * Derive the enacted date from legislation history and action fields.
 */
export function findEnactedDate(legislation: Legislation | Record<string, unknown>): Date | null {
  const doc = legislation as Record<string, unknown>;
  const sortedHistory = Array.isArray(doc.history)
    ? [...(doc.history as { date?: string; action?: string }[])].sort((a, b) => {
        const dateA = toEnactedDate(a.date)?.getTime() ?? 0;
        const dateB = toEnactedDate(b.date)?.getTime() ?? 0;
        return dateB - dateA;
      })
    : [];

  if (doc.isEnacted === true) {
    return (
      toEnactedDate(sortedHistory[0]?.date) ||
      toEnactedDate(doc.latestPassageAt as string | Date | undefined) ||
      toEnactedDate(doc.latestActionAt as string | Date | undefined) ||
      toEnactedDate(doc.updatedAt as string | Date | undefined) ||
      toEnactedDate(doc.createdAt as string | Date | undefined)
    );
  }

  if (matchesEnactedPattern(doc.latestActionDescription as string | undefined)) {
    return toEnactedDate(doc.latestActionAt as string | Date | undefined);
  }

  const enactedHistoryItem = sortedHistory.find((item) => matchesEnactedPattern(item.action));
  if (enactedHistoryItem) {
    return toEnactedDate(enactedHistoryItem.date);
  }

  return null;
}

/**
 * Check if a single action string indicates enacted status
 * Used for timeline highlighting
 */
export function isEnactedAction(action: string): boolean {
  if (!action) return false;

  return enactedPatterns.some(pattern => pattern.test(action));
}

/**
 * Optimized function to detect if legislation is enacted
 * First checks the pre-computed isEnacted field, falls back to pattern matching
 */
export function isLegislationEnacted(legislation: Legislation | any): boolean {
  // If we have the pre-computed field, use it for maximum performance
  // if (typeof legislation.isEnacted === 'boolean') {
  //   return legislation.isEnacted;
  // }

  if (legislation?.enactedAt) {
    return true;
  }

  // Fallback to pattern matching for backward compatibility
  return detectEnactedByPatterns(legislation);
}

/**
 * Pattern-based enacted detection (used for computing the isEnacted field)
 */
export function detectEnactedByPatterns(legislation: Legislation | any): boolean {
  // Check latest action description
  if (legislation.latestActionDescription) {
    for (const pattern of enactedPatterns) {
      if (pattern.test(legislation.latestActionDescription)) {
        return true;
      }
    }
  }

  // Check history for enacted actions
  if (legislation.history && Array.isArray(legislation.history)) {
    for (const historyItem of legislation.history) {
      if (historyItem.action) {
        for (const pattern of enactedPatterns) {
          if (pattern.test(historyItem.action)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Get enacted legislation statistics for analytics
 */
export function getEnactedStats(legislations: Legislation[]): {
  total: number;
  enacted: number;
  percentage: number;
} {
  const enacted = legislations.filter(isLegislationEnacted).length;
  return {
    total: legislations.length,
    enacted,
    percentage: legislations.length > 0 ? (enacted / legislations.length) * 100 : 0
  };
}

/**
 * Batch update enacted status for multiple legislation documents
 * This is useful for maintaining data consistency
 */
export async function batchUpdateEnactedStatus(legislations: (Legislation & { isEnacted?: boolean })[]): Promise<{
  processed: number;
  updated: number;
  errors: string[];
}> {
  let processed = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const legislation of legislations) {
    try {
      const computedEnacted = detectEnactedByPatterns(legislation);

      // Only update if the computed value differs from stored value
      if (legislation.isEnacted !== computedEnacted) {
        // This would need to be connected to the actual update service
        // For now, we'll just log what would be updated
        console.log(`Would update ${legislation.id}: isEnacted from ${legislation.isEnacted} to ${computedEnacted}`);
        updated++;
      }

      processed++;
    } catch (error) {
      errors.push(`Failed to process ${legislation.id}: ${error}`);
    }
  }

  return { processed, updated, errors };
}
