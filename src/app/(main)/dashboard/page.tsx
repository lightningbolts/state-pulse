import DashboardPageClient from "@/app/(main)/dashboard/DashboardPageClient";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.dashboard;

export default function DashboardPage() {
  return (
      <DashboardPageClient />
  );
}
