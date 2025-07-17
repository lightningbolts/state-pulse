import { PolicyUpdatesFeed } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function UpdatesPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Policy Updates</CardTitle>
        <CardDescription>
          Stay updated with the latest policy developments. Filter by category or search for specific topics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="text-center p-8">Loading policy feed...</div>}>
          <PolicyUpdatesFeed />
        </Suspense>
      </CardContent>
    </Card>
  );
}
