"use client";

import { PolicyTracker } from "@/components/features/PolicyTracker";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useUser } from "@clerk/nextjs";

export default function TrackerPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <LoadingOverlay text="Loading tracker..." smallText="Loading..." />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
        <p className="text-muted-foreground">You must be signed in to track policies.</p>
      </div>
    );
  }

  return <PolicyTracker />;
}
