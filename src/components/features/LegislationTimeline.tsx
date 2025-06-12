import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const timelineEvents = [
    { id: 1, status: "Introduced", date: "2024-01-15", details: "Bill H.R. 123 introduced in the House." },
    { id: 2, status: "Committee Review", date: "2024-02-01", details: "Sent to the Ways and Means Committee." },
    { id: 3, status: "Committee Vote", date: "2024-03-10", details: "Passed committee vote with amendments." },
    { id: 4, status: "House Vote", date: "2024-04-05", details: "Passed House vote (218-210)." },
    { id: 5, status: "Senate Introduction", date: "2024-04-10", details: "Introduced in the Senate as S. 456." },
    { id: 6, status: "Senate Committee", date: "2024-05-01", details: "Referred to Senate Finance Committee." },
    { id: 7, status: "Governor Signature", date: "Pending", details: "Awaiting Governor's action." },
    { id: 8, status: "Codified", date: "Pending", details: "To be codified if signed." },
];

export function LegislationTimeline() {
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Legislation Timeline</CardTitle>
                <CardDescription>Track the progress of a bill from introduction to codification.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <div className="relative pl-6">
                        {/* Vertical line */}
                        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border"></div>

                        {timelineEvents.map((event, index) => (
                            <div key={event.id} className="mb-8 relative">
                                {/* Dot on the line */}
                                <div className={`absolute -left-[calc(0.5rem+1px)] top-1 w-4 h-4 rounded-full ${event.date === "Pending" ? "bg-muted-foreground" : "bg-primary"}`}></div>
                                <div className="ml-3"> {/* Added ml-3 to shift text content to the right */}
                                    <p className={`font-semibold ${event.date === "Pending" ? "text-muted-foreground" : "text-primary"}`}>{event.status}</p>
                                    <p className="text-sm text-muted-foreground">{event.date}</p>
                                    <p className="text-sm mt-1">{event.details}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <p className="mt-4 text-sm text-muted-foreground text-center">Select a bill to see its detailed timeline.</p>
            </CardContent>
        </Card>
    );
}