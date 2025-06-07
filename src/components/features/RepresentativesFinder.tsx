import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search } from "lucide-react";

export function RepresentativesFinder() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Find Your Representatives</CardTitle>
        <CardDescription>Enter your address or zip code to find your elected officials and their contact information.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full max-w-md items-center space-x-2 mx-auto">
          <Input type="text" placeholder="Enter address or zip code" />
          <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Search className="mr-2 h-4 w-4" />
            Find
          </Button>
        </div>
        <div className="mt-6">
          {/* Placeholder for results */}
          <h4 className="font-semibold mb-2">Your Representatives:</h4>
          <p className="text-sm text-muted-foreground text-center">Representative information will be displayed here.</p>
          {/* Example of how results might look */}
          {/* <div className="border p-4 rounded-md mt-2">
            <p className="font-medium">Rep. Jane Doe</p>
            <p className="text-sm">U.S. House of Representatives, District 5</p>
            <p className="text-sm text-primary hover:underline cursor-pointer">janedoe.house.gov</p>
          </div> */}
        </div>
        <div className="mt-8 border-t pt-6">
            <h4 className="font-semibold mb-2 text-lg">Civic Tools</h4>
            <p className="text-sm text-muted-foreground mb-4">Quick access to other civic information.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline">Voting Dates & Deadlines</Button>
                <Button variant="outline">Public Hearing Schedules</Button>
                <Button variant="outline">Ballot Information</Button>
                <Button variant="outline">Generate Message to Legislator</Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
