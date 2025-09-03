import { PolicyUpdatesFeed } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.legislation;

export default function UpdatesPage() {
  return (
      <Card className="shadow-lg">
        <CardHeader>
            {/*<AnimatedSection>*/}
          <CardTitle className="font-headline text-2xl">Policy Updates</CardTitle>
            {/*</AnimatedSection>*/}
            {/*<AnimatedSection>*/}
          <CardDescription>
            Stay updated with the latest policy developments. Filter by category or search for specific topics.
          </CardDescription>
            {/*</AnimatedSection>*/}
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingOverlay text="Loading policy feed..." smallText="Loading..." /> }>
            <PolicyUpdatesFeed />
          </Suspense>
        </CardContent>
      </Card>
  );
}
