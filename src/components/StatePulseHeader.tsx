import { SidebarTrigger } from "@/components/ui/sidebar";
import { Gavel } from "lucide-react";

export function StatePulseHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-2 sm:px-4 md:px-6 lg:px-8 shadow-sm w-full max-w-none min-w-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2 min-w-0">
          <Gavel className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold font-headline truncate">StatePulse</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-wrap min-w-0">
        {/* ThemeToggle and Auth buttons moved to sidebar */}
      </div>
      {/* Add other header elements like user profile, settings, etc. here */}
    </header>
  );
}
