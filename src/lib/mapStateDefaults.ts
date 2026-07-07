import { STATE_COORDINATES, STATE_NAMES } from '@/types/geo';
import type { StateData } from '@/types/jurisdictions';

export function createEmptyStateStats(): Record<string, StateData> {
  const stats: Record<string, StateData> = {};
  for (const [abbr, name] of Object.entries(STATE_NAMES)) {
    if (!STATE_COORDINATES[abbr]) continue;
    stats[abbr] = {
      name,
      abbreviation: abbr,
      legislationCount: 0,
      activeRepresentatives: 0,
      recentActivity: 0,
      topicDiversity: 0,
      keyTopics: [],
      center: STATE_COORDINATES[abbr],
      color: '#d4d0c8',
    };
  }
  return stats;
}

export const MAP_STATE_ABBRS = Object.keys(STATE_NAMES).filter((abbr) => abbr !== 'US');

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
