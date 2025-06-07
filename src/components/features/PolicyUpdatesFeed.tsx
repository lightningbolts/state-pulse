import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bookmark, Search } from "lucide-react";

const sampleUpdates = [
  { id: 1, title: "New Education Bill Passes in California", state: "CA", category: "Education", date: "2024-07-28", summary: "A bill aimed at increasing funding for public schools was signed into law." },
  { id: 2, title: "Texas Proposes Healthcare Reform", state: "TX", category: "Healthcare", date: "2024-07-27", summary: "Lawmakers in Texas introduced a new proposal to overhaul the state's healthcare system." },
  { id: 3, title: "Florida Implements New Climate Initiative", state: "FL", category: "Climate", date: "2024-07-26", summary: "Governor announces a series of measures to combat climate change." },
];

export function PolicyUpdatesFeed() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Real-Time Policy Updates</CardTitle>
        <CardDescription>Stay updated with the latest policy developments. Filter by category or search for specific topics.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Search updates..." className="pl-10" />
          </div>
          <Button variant="outline">
            <Bookmark className="mr-2 h-4 w-4" />
            Bookmarked (0)
          </Button>
        </div>
        <div className="mb-6 space-x-2">
          <Badge variant="secondary">#Education</Badge>
          <Badge variant="secondary">#Healthcare</Badge>
          <Badge variant="secondary">#Policing</Badge>
          <Badge variant="secondary">#Climate</Badge>
          <Badge variant="secondary">#Labor</Badge>
          <Badge variant="secondary">#Tech</Badge>
        </div>
        <div className="space-y-4">
          {sampleUpdates.map((update) => (
            <Card key={update.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{update.title}</h3>
                  <p className="text-sm text-muted-foreground">{update.date} - {update.state}</p>
                </div>
                <Badge>{update.category}</Badge>
              </div>
              <p className="mt-2 text-sm">{update.summary}</p>
              <Button variant="ghost" size="sm" className="mt-2">
                <Bookmark className="mr-2 h-4 w-4" /> Bookmark
              </Button>
            </Card>
          ))}
        </div>
         <p className="mt-6 text-center text-muted-foreground">More updates would load here...</p>
      </CardContent>
    </Card>
  );
}
