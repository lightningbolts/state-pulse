
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StateDetailData } from "@/types/jurisdictions";

async function fetchStateDetail(stateAbbr: string): Promise<StateDetailData> {
    const response = await fetch(`/api/dashboard/state/${stateAbbr}`);
    if (!response.ok) {
        throw new Error("Failed to fetch state data");
    }
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || "Unknown error fetching state data");
    }
    return result.data;
}

async function fetchCongressDetail(): Promise<StateDetailData> {
    const response = await fetch(`/api/dashboard/congress`);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch US Congress data: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || "Unknown error fetching congress data");
    }
    return result.data;
}

export function useDashboardData() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const stateParam = searchParams.get("state");
    const stateAbbrParam = searchParams.get("stateAbbr");
    const congressParam = searchParams.get("congress");

    const isCongressDashboard = useMemo(() =>
        congressParam === "true" ||
        stateParam === "United States" ||
        stateParam === "US" ||
        stateAbbrParam === "US" ||
        stateAbbrParam === "USA",
        [congressParam, stateParam, stateAbbrParam]
    );

    const isDetailedView = useMemo(() =>
        isCongressDashboard || (stateAbbrParam && stateAbbrParam !== "US" && stateAbbrParam !== "USA"),
        [isCongressDashboard, stateAbbrParam]
    );

    const {
        data: stateData = null,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: isCongressDashboard
            ? ['dashboard-detail', 'congress']
            : ['dashboard-detail', 'state', stateAbbrParam],
        queryFn: () => (
            isCongressDashboard
                ? fetchCongressDetail()
                : fetchStateDetail(stateAbbrParam!)
        ),
        enabled: Boolean(
            isCongressDashboard ||
            (stateAbbrParam && stateAbbrParam !== "US" && stateAbbrParam !== "USA")
        ),
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
    });

    const error = queryError instanceof Error
        ? queryError.message
        : queryError
            ? "An unknown error occurred"
            : null;

    const clearStateFilter = () => {
        router.push("/dashboard");
    };

    return {
        stateData,
        loading,
        error,
        isDetailedView,
        isCongressDashboard,
        stateParam,
        stateAbbrParam,
        clearStateFilter,
    };
}
