import { PolicyUpdatesFeed } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";

export default function UpdatesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PolicyUpdatesFeed />
    </Suspense>
  );
}
