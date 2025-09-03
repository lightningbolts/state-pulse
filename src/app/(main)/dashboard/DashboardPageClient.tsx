
"use client";

import { useDashboardData } from "@/hooks/useDashboardData";
import { InteractiveMap } from "@/components/features/InteractiveMap";
import { StateDashboard } from "@/components/features/StateDashboard";

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

    if (isDetailedView) {
        return (
            <StateDashboard
                stateData={stateData}
                loading={loading}
                error={error}
                isCongressDashboard={isCongressDashboard}
                stateParam={stateParam}
                stateAbbrParam={stateAbbrParam}
                clearStateFilter={clearStateFilter}
            />
        );
    }

    return <InteractiveMap />;
}
