
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { StateDetailData } from "@/types/jurisdictions";

export function useDashboardData() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [stateData, setStateData] = useState<StateDetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        if (isCongressDashboard) {
            fetchCongressData();
        } else if (stateAbbrParam && stateAbbrParam !== "US" && stateAbbrParam !== "USA") {
            fetchStateData(stateAbbrParam);
        }
    }, [isCongressDashboard, stateAbbrParam]);

    const fetchCongressData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/dashboard/congress`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch US Congress data: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            if (result.success) {
                setStateData(result.data);
            } else {
                throw new Error(result.error || "Unknown error fetching congress data");
            }
        } catch (err) {
            console.error("Error fetching Congress data:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred");
        } finally {
            setLoading(false);
        }
    };

    const fetchStateData = async (stateAbbr: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/dashboard/state/${stateAbbr}`);
            if (!response.ok) {
                throw new Error("Failed to fetch state data");
            }
            const result = await response.json();
            if (result.success) {
                setStateData(result.data);
            } else {
                throw new Error(result.error || "Unknown error fetching state data");
            }
        } catch (err) {
            console.error("Error fetching state data:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred");
        } finally {
            setLoading(false);
        }
    };

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
