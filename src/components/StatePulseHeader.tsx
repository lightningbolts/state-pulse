import { SidebarTrigger } from "@/components/ui/sidebar";
import { Gavel } from "lucide-react";
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function StatePulseHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 lg:px-8 shadow-sm w-full max-w-none">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2">
          <Gavel className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold font-headline">StatePulse</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SignedOut>
          <div className="flex items-center gap-2 h-10">
            <SignInButton mode="modal">
              <Button>
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="outline">
                Sign Up
              </Button>
            </SignUpButton>
          </div>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
      {/* Add other header elements like user profile, settings, etc. here */}
    </header>
  );
}
