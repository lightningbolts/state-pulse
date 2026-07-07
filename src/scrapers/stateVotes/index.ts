import type { StateVoteAdapter } from '@/types/voteRecord';
import { REMAINING_STATE_CONFIGS } from './adapters/allStateConfigs';
import { ArizonaVoteAdapter } from './adapters/az';
import { CaliforniaVoteAdapter } from './adapters/ca';
import {
  ChamberHtmlVoteAdapter,
  createWave2Adapters,
} from './adapters/chamberHtml';
import { FloridaVoteAdapter } from './adapters/fl';
import { MarylandVoteAdapter } from './adapters/md';
import { MinnesotaVoteAdapter } from './adapters/mn';
import { NewYorkVoteAdapter } from './adapters/ny';
import { NorthCarolinaVoteAdapter } from './adapters/nc';
import { PennsylvaniaVoteAdapter } from './adapters/pa';
import { createTableIndexAdapters } from './adapters/tableIndex';
import { TennesseeVoteAdapter } from './adapters/tn';
import { WisconsinVoteAdapter } from './adapters/wi';

export class StateAdapterRegistry {
  private adapters = new Map<string, StateVoteAdapter>();

  register(adapter: StateVoteAdapter): void {
    this.adapters.set(adapter.stateAbbr.toUpperCase(), adapter);
  }

  get(stateAbbr: string): StateVoteAdapter | undefined {
    return this.adapters.get(stateAbbr.toUpperCase());
  }

  getAll(): StateVoteAdapter[] {
    return Array.from(this.adapters.values());
  }

  getByStates(states?: string[]): StateVoteAdapter[] {
    if (!states?.length) return this.getAll();
    return states
      .map((s) => this.get(s))
      .filter((a): a is StateVoteAdapter => Boolean(a));
  }
}

export function createDefaultRegistry(): StateAdapterRegistry {
  const registry = new StateAdapterRegistry();
  registry.register(new CaliforniaVoteAdapter());
  registry.register(new FloridaVoteAdapter());
  registry.register(new NewYorkVoteAdapter());
  registry.register(new NorthCarolinaVoteAdapter());
  registry.register(new PennsylvaniaVoteAdapter());
  registry.register(new WisconsinVoteAdapter());
  registry.register(new ArizonaVoteAdapter());
  registry.register(new MinnesotaVoteAdapter());
  registry.register(new MarylandVoteAdapter());
  registry.register(new TennesseeVoteAdapter());
  for (const adapter of createWave2Adapters()) {
    registry.register(adapter);
  }
  for (const adapter of createTableIndexAdapters()) {
    registry.register(adapter);
  }
  for (const config of REMAINING_STATE_CONFIGS) {
    registry.register(new ChamberHtmlVoteAdapter(config));
  }
  return registry;
}

export { ALL_US_STATE_ABBRS, REMAINING_STATE_CONFIGS } from './adapters/allStateConfigs';
export { ArizonaVoteAdapter } from './adapters/az';
export { CaliforniaVoteAdapter } from './adapters/ca';
export { ChamberHtmlVoteAdapter, createWave2Adapters } from './adapters/chamberHtml';
export { FloridaVoteAdapter } from './adapters/fl';
export { MarylandVoteAdapter } from './adapters/md';
export { MinnesotaVoteAdapter } from './adapters/mn';
export { NewYorkVoteAdapter } from './adapters/ny';
export { NorthCarolinaVoteAdapter } from './adapters/nc';
export { PennsylvaniaVoteAdapter } from './adapters/pa';
export { TennesseeVoteAdapter } from './adapters/tn';
export { WisconsinVoteAdapter } from './adapters/wi';
