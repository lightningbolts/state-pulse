import DashboardPageClient from "@/app/(main)/dashboard/DashboardPageClient";
import { pageMetadata } from '@/lib/metadata';
import { Suspense } from 'react';

export const metadata = pageMetadata.dashboard;

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPageClient />
    </Suspense>
  );
}
