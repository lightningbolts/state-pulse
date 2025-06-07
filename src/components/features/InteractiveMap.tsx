import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";

export function InteractiveMap() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Interactive State Map</CardTitle>
        <CardDescription>Explore state-level developments across the U.S. Click on a state to view details.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="aspect-video w-full relative rounded-md overflow-hidden border">
          <Image 
            src="https://placehold.co/1200x800.png" 
            alt="Interactive US Map Placeholder" 
            fill={true}
            style={{objectFit: "cover"}}
            data-ai-hint="US map"
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          This is a placeholder for the interactive map. In a full implementation, you would be able to click on states to see detailed information.
        </p>
      </CardContent>
    </Card>
  );
}
