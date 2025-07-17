import { RepresentativesFinder } from "@/components/features/RepresentativesFinder";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function CivicPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <Users className="mr-3 h-7 w-7" />
          Find Your Representatives
        </CardTitle>
        <CardDescription>
          Start typing your address for instant suggestions, or enter a zip code to find your closest state representatives with an interactive map.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Suspense fallback={<div className="text-center p-8">Loading finder...</div>}>
          <RepresentativesFinder />
        </Suspense>
      </CardContent>
    </Card>
  );
}
