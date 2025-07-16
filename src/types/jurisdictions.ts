import type {LatLngExpression} from "leaflet";

export interface StateData {
    name: string;
    abbreviation: string;
    legislationCount: number;
    activeRepresentatives: number;
    recentActivity: number;
    keyTopics: string[];
    center: LatLngExpression;
    color: string;
}

export interface StateDetailData {
    state?: string;
    jurisdiction?: string; // Add jurisdiction field for Congress
    statistics: {
        totalLegislation: number;
        recentActivity: number;
        activeSponsors: number;
        averageBillAge: number;
    };
    recentLegislation: Array<{
        id: string;
        identifier: string;
        title: string;
        lastAction: string;
        lastActionDate: string;
        subjects: string[];
        primarySponsor: string;
        chamber: string;
    }>;
    trendingTopics: Array<{
        name: string;
        totalCount: number;
        recentCount: number;
        trend: string;
    }>;
    topSponsors: Array<{
        name: string;
        totalBills: number;
        recentBills: number;
        activity: string;
    }>;
}