import DashboardPageClient from "@/app/(main)/dashboard/DashboardPageClient";
import { pageMetadata } from '@/lib/metadata';
import { Suspense } from 'react';
import {LoadingOverlay} from "@/components/ui/LoadingOverlay";

export const metadata = pageMetadata.dashboard;

export default function DashboardPage() {
  return (
    <Suspense fallback={
        <LoadingOverlay text="Loading dashboard..."/>
    }>
      <DashboardPageClient />
    </Suspense>
  );
}
