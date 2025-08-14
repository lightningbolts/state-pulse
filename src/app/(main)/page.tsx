import HomePageClient from './HomePageClient';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.home;

export default function HomePage() {
  return <HomePageClient />;
}
