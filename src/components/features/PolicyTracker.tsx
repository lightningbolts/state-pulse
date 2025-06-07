import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BellRing } from "lucide-react";

export function PolicyTracker() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Custom Policy Tracking</CardTitle>
        <CardDescription>Subscribe to specific policies or topics (e.g., "abortion laws in Ohio") and receive updates.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full max-w-md items-center space-x-2 mx-auto">
          <Input type="text" placeholder="Enter topic to track (e.g., 'minimum wage CA')" />
          <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <BellRing className="mr-2 h-4 w-4" />
            Subscribe
          </Button>
        </div>
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Your Tracked Topics:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Minimum wage in California <Button variant="ghost" size="sm" className="ml-2 text-destructive hover:text-destructive/80">Unsubscribe</Button></li>
            <li>Renewable energy policies in Texas <Button variant="ghost" size="sm" className="ml-2 text-destructive hover:text-destructive/80">Unsubscribe</Button></li>
          </ul>
           <p className="mt-4 text-sm text-muted-foreground text-center">Updates on your tracked topics will appear here and/or be sent via notifications.</p>
        </div>
      </CardContent>
    </Card>
  );
}
