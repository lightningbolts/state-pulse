import { SidebarTrigger } from "@/components/ui/sidebar";
import { Gavel } from "lucide-react";

export function StatePulseHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      <SidebarTrigger className="md:hidden" />
      <div className="flex items-center gap-2">
        <Gavel className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold font-headline">StatePulse</h1>
      </div>
      {/* Add other header elements like user profile, settings, etc. here */}
    </header>
  );
}
