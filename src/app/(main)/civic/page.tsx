import { RepresentativesFinder } from "@/components/features/RepresentativesFinder";
import { Suspense } from "react";

export default function CivicPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RepresentativesFinder />
    </Suspense>
  );
}
