import { Suspense } from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import RepresentativesFeed from "@/components/features/RepresentativesFeed";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.representatives;

export default function RepresentativesPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <AnimatedSection>
          <CardTitle className="font-headline text-2xl">Representatives</CardTitle>
        </AnimatedSection>
        <AnimatedSection>
          <CardDescription>
            Search and filter all state and federal representatives. Use the dropdowns or search bar to find who represents you.
          </CardDescription>
        </AnimatedSection>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoadingOverlay text="Loading representatives..." smallText="Loading..." /> }>
          <RepresentativesFeed />
        </Suspense>
      </CardContent>
    </Card>
  );
}
