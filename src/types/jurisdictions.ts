import type {LatLngExpression} from "leaflet";

export type TrendDirection = 'up' | 'down' | 'stable';

export interface StateData {
    name: string;
    abbreviation: string;
    legislationCount: number;
    activeRepresentatives: number;
    recentActivity: number;
    topicDiversity: number;
    keyTopics: string[];
    center: LatLngExpression;
    color: string;
    // Voting power fields (optional for backward compatibility)
    population?: number;
    houseSeats?: number;
    senateSeats?: number;
    houseVotingPower?: number;
    senateVotingPower?: number;
    enactmentRate?: number | null;
    averageBillVelocityDays?: number | null;
    bipartisanRate?: number | null;
    topicMomentum?: number;
    legislativePace?: number;
    chamberUpperShare?: number | null;
    sponsorConcentration?: number | null;
    doaRate?: number | null;
    pingPongRate?: number | null;
    multiSponsorRate?: number | null;
}

export interface TrendingTopic {
    name: string;
    totalCount: number;
    recentCount: number;
    priorCount: number;
    pctChange: number;
    trend: TrendDirection | string;
    weeklyCounts?: number[];
}

export interface PolicyDiffusionTopic {
    name: string;
    billCount: number;
    stateCount: number;
    states: string[];
}

export interface SessionPhaseBreakdown {
    session: string | null;
    current: 'early' | 'mid' | 'late' | null;
    early: number;
    mid: number;
    late: number;
}

export interface ClassificationMix {
    bills: number;
    resolutions: number;
    memorials: number;
    other: number;
}

export interface ChamberMix {
    upper: number;
    lower: number;
    unicameral: number;
    other: number;
}

export interface StateDetailData {
    state?: string;
    jurisdiction?: string; // Add jurisdiction field for Congress
    statistics: {
        totalLegislation: number;
        recentActivity: number;
        activeSponsors: number;
        averageBillAge: number;
        enactedCount?: number;
        enactmentRate?: number | null;
        averageBillVelocityDays?: number | null;
        bipartisanRate?: number | null;
        bipartisanScoredBills?: number;
        legislativePace?: number;
        sponsorConcentration?: number | null;
        sponsorHhi?: number | null;
        multiSponsorRate?: number | null;
        multiSponsorCount?: number;
        primaryShare?: number | null;
        cosponsorMentions?: number;
        primaryMentions?: number;
        doaRate?: number | null;
        doaCount?: number;
        pingPongRate?: number | null;
        pingPongCount?: number;
        weeklyActivity?: number[];
    };
    sessionPhase?: SessionPhaseBreakdown;
    classificationMix?: ClassificationMix;
    chamberMix?: ChamberMix;
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
    trendingTopics: TrendingTopic[];
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
        [key in "congress" | "lower" | "upper"]?: TrendingTopic[];
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