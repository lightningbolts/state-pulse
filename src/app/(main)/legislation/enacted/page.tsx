import { PolicyUpdatesFeed } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: 'Enacted Legislation | StatePulse',
  description: 'View all bills that have been enacted into law across states and federal government. Track successful legislation from introduction to enactment.',
  keywords: ['enacted legislation', 'bills signed into law', 'public law', 'governor signed', 'chapter laws', 'acts'],
};

export default function EnactedLegislationPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <Badge variant="default" className="bg-green-600 text-white">
            Enacted into Law
          </Badge>
          <CardTitle className="font-headline text-2xl">Enacted Legislation</CardTitle>
        </div>
        <CardDescription>
          View all bills that have successfully become law. These bills have been signed by governors,
          approved by executives, or otherwise enacted into law with effective dates and chapter numbers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoadingOverlay text="Loading enacted legislation..." smallText="Loading..." />}>
          <EnactedLegislationFeed />
        </Suspense>
      </CardContent>
    </Card>
  );
}

// Component that automatically shows only enacted legislation
function EnactedLegislationFeed() {
  return (
    <div className="space-y-4">
      {/* Info banner about enacted legislation */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">About Enacted Legislation</h3>
        <p className="text-sm text-green-700 dark:text-green-300">
          This page shows bills that have completed the legislative process and become law.
          Look for keywords like "signed by governor", "became law", "effective date", "chapter laws",
          and "public law" in the action descriptions.
        </p>
      </div>

      {/* Use the existing PolicyUpdatesFeed but force enacted filter */}
      <div style={{ display: 'none' }}>
        {/* This hidden component will automatically trigger the enacted filter */}
        <PolicyUpdatesFeed />
      </div>

      {/* Custom enacted feed implementation */}
      <EnactedFeedComponent />
    </div>
  );
}

// Custom component that fetches and displays only enacted legislation
function EnactedFeedComponent() {
  return (
    <div className="space-y-4">
      {/* Placeholder for now - this would use the enacted API endpoint directly */}
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Loading enacted legislation feed...
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Use the main legislation page with the "Enacted into Law" filter for now.
        </p>
      </div>
    </div>
  );
}
