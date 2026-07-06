import { Suspense } from 'react';
import { Panel, PanelBody } from '@/components/layout/Panel';
import { pageMetadata } from '@/lib/metadata';
import { HomeExamplesSection } from './HomeExamplesSection';
import { HomeFeatures } from './HomeFeatures';
import { HomeHero } from './HomeHero';
import { HomeStats } from './HomeStats';
import { HomeStatsSkeleton } from './HomeStatsSkeleton';

export const metadata = pageMetadata.home;

export default function HomePage() {
  return (
    <div className="animate-content-in space-y-8">
      <HomeHero />

      <Suspense fallback={<HomeStatsSkeleton />}>
        <HomeStats />
      </Suspense>

      <HomeFeatures />

      <Panel title="Spotlight">
        <PanelBody>
          <HomeExamplesSection initialExamples={{ legislation: null, representative: null }} />
        </PanelBody>
      </Panel>
    </div>
  );
}
