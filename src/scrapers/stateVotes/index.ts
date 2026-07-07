import type { StateVoteAdapter } from '@/types/voteRecord';
import { CaliforniaVoteAdapter } from './adapters/ca';
import { ChamberHtmlVoteAdapter, createWave2Adapters } from './adapters/chamberHtml';
import { FloridaVoteAdapter } from './adapters/fl';
import { NewYorkVoteAdapter } from './adapters/ny';

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
  for (const adapter of createWave2Adapters()) {
    registry.register(adapter);
  }
  return registry;
}

export {
  CaliforniaVoteAdapter,
  ChamberHtmlVoteAdapter,
  FloridaVoteAdapter,
  NewYorkVoteAdapter,
  createWave2Adapters,
};
