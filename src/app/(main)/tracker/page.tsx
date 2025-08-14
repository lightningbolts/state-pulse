import TrackerPageClient from './TrackerPageClient';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.tracker;

export default function TrackerPage() {
  return <TrackerPageClient />;
}
