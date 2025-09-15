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
    // Voting power fields (optional for backward compatibility)
    population?: number;
    houseSeats?: number;
    senateSeats?: number;
    houseVotingPower?: number;
    senateVotingPower?: number;
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

    // Optional: district-type-indexed fields for dashboard filtering
    recentLegislationByDistrictType?: {
        [key in "congress" | "lower" | "upper"]?: Array<{
            id: string;
            identifier: string;
            title: string;
            lastAction: string;
            lastActionDate: string;
            subjects: string[];
            primarySponsor: string;
            chamber: string;
        }>;
    };
    trendingTopicsByDistrictType?: {
        [key in "congress" | "lower" | "upper"]?: Array<{
            name: string;
            totalCount: number;
            recentCount: number;
            trend: string;
        }>;
    };
    topSponsorsByDistrictType?: {
        [key in "congress" | "lower" | "upper"]?: Array<{
            name: string;
            totalBills: number;
            recentBills: number;
            activity: string;
        }>;
    };
}