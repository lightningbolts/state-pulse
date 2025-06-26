import { PolicyTracker } from "@/components/features/PolicyTracker";
import { getCurrentUser } from "@/lib/clerkMongoIntegration";

export default async function TrackerPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
        <p className="text-muted-foreground">You must be signed in to track policies.</p>
      </div>
    );
  }
  return <PolicyTracker userId={user.id} />;
}
