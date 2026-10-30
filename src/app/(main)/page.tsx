import { Suspense } from 'react';
import { Panel, PanelBody } from '@/components/layout/Panel';
import { pageMetadata } from '@/lib/metadata';
import { getCachedHomepageExamples } from '@/lib/homepageExamplesService';
import { buildSafe } from '@/lib/buildSafe';
import { HomeExamplesSection } from './HomeExamplesSection';
import { HomeFeatures } from './HomeFeatures';
import { HomeHero } from './HomeHero';
import { HomeStats } from './HomeStats';
import { HomeStatsSkeleton } from './HomeStatsSkeleton';

export const metadata = pageMetadata.home;
export const revalidate = 300;

export default async function HomePage() {
  const initialExamples = await buildSafe(getCachedHomepageExamples, { legislation: null, representative: null });

  return (
    <div className="animate-content-in space-y-8">
      <HomeHero />

      <Suspense fallback={<HomeStatsSkeleton />}>
        <HomeStats />
      </Suspense>

      <HomeFeatures />

      <Panel title="Spotlight">
        <PanelBody>
          <HomeExamplesSection initialExamples={initialExamples} />
        </PanelBody>
      </Panel>
    </div>
  );
}
