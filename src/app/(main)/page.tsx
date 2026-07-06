import HomePageClient from './HomePageClient';
import { pageMetadata } from '@/lib/metadata';
import { fetchHomepageExamples, fetchHomepageStats } from '@/lib/homepage';

export const metadata = pageMetadata.home;

export default async function HomePage() {
  const [initialStats, initialExamples] = await Promise.all([
    fetchHomepageStats(),
    fetchHomepageExamples(),
  ]);

  return (
    <HomePageClient
      initialStats={initialStats}
      initialExamples={initialExamples}
    />
  );
}
