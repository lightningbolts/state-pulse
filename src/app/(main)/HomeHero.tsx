import { HomeHeroActions } from './HomeHeroActions';

export function HomeHero() {
  return (
    <section className="border border-border bg-surface-elevated p-8 sm:p-10">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        StatePulse
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        Track state and federal bills, find your representatives, and follow what&apos;s moving in legislatures near you.
        StatePulse is dedicated to democratizing access to state and local legislation—we believe every citizen deserves to understand the laws that govern their daily lives.
      </p>
      <HomeHeroActions />
    </section>
  );
}
