import { PolicyUpdatesFeed, type PolicyUpdate } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { pageMetadata } from '@/lib/metadata';
import { getAllLegislationWithFiltering } from "@/services/legislationService";

export const metadata = pageMetadata.legislation;

function LegislationFeedFallback() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="mb-4 p-4 border rounded-lg bg-background flex flex-col gap-3">
          <Skeleton className="h-6 w-[90%]" />
          <Skeleton className="h-4 w-[45%]" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

export default async function UpdatesPage() {
  const raw = await getAllLegislationWithFiltering({
    limit: 20,
    skip: 0,
    sortDir: 'desc',
    sortBy: 'createdAt',
    context: 'policy-updates-feed',
  });
  const initialData = JSON.parse(JSON.stringify(raw)) as PolicyUpdate[];

  return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Policy Updates</CardTitle>
          <CardDescription>
            Stay updated with the latest policy developments. Filter by category or search for specific topics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LegislationFeedFallback />}>
            <PolicyUpdatesFeed initialData={initialData} />
          </Suspense>
        </CardContent>
      </Card>
  );
}
