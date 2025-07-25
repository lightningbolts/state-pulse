import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import RepresentativesFeed from "@/components/features/RepresentativesFeed";

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
        <Suspense fallback={<div className="text-center p-8">Loading representatives...</div>}>
          <RepresentativesFeed />
        </Suspense>
      </CardContent>
    </Card>
  );
}
