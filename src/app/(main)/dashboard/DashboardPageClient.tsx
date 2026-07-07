
"use client";

import dynamic from "next/dynamic";
import { useDashboardData } from "@/hooks/useDashboardData";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

const InteractiveMap = dynamic(
  () => import("@/components/features/InteractiveMap").then((m) => m.InteractiveMap),
  { ssr: false, loading: () => <PageSkeleton variant="map" /> },
);

const StateDashboard = dynamic(
  () => import("@/components/features/StateDashboard").then((m) => m.StateDashboard),
  { ssr: false, loading: () => <PageSkeleton variant="map" /> },
);

export default function DashboardPageClient() {
    const {
        stateData,
        loading,
        error,
        isDetailedView,
        isCongressDashboard,
        stateParam,
        stateAbbrParam,
        clearStateFilter,
    } = useDashboardData();

    return (
        <>
            <div className={isDetailedView ? "hidden" : undefined}>
                <InteractiveMap />
            </div>
            {isDetailedView && (
                <StateDashboard
                    stateData={stateData}
                    loading={loading}
                    error={error}
                    isCongressDashboard={isCongressDashboard}
                    stateParam={stateParam}
                    stateAbbrParam={stateAbbrParam}
                    clearStateFilter={clearStateFilter}
                />
            )}
        </>
    );
}
