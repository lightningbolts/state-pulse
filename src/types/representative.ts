import {Pagination} from "@/types/index";

export interface Representative {
    id: string;
    name: string;
    party: string;
    office: string;
    district?: string;
    jurisdiction: string;
    phone?: string;
    email?: string;
    website?: string;
    photo?: string;
    lat?: number;
    lon?: number;
    distance?: number;
    addresses?: Array<{
        type: string;
        address: string;
        phone?: string;
        fax?: string;
    }>;
    lastUpdated: Date;
}

export interface ApiResponse {
    representatives: Representative[];
    source: 'cache' | 'api';
    count?: number;
    pagination?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface RepresentativesResultsProps {
    representatives: Representative[];
    closestReps: Representative[];
    loading: boolean;
    error: string | null;
    showMap: boolean;
    showAllMode: boolean;
    userLocation: { lat: number; lon: number } | null;
    dataSource: 'cache' | 'api' | null;
    pagination?: Pagination;
    onShowAllToggle: () => void;
    onPageChange: (page: number) => void;
}

export interface OpenStatesPerson {
    id: string;
    name: string;
    party: string;
    current_role?: {
        title: string;
        org_classification: string;
        district?: number;
        division_id?: string;
    };
    jurisdiction?: {
        id: string;
        name: string;
        classification: string;
    };
    given_name?: string;
    family_name?: string;
    image?: string;
    email?: string;
    gender?: string;
    birth_date?: string;
    death_date?: string;
    extras?: {
        profession?: string;
    };
    created_at?: string;
    updated_at?: string;
    openstates_url?: string;
    other_identifiers?: Array<{
        identifier: string;
        scheme: string;
    }>;
    other_names?: Array<{
        name: string;
        note?: string;
    }>;
    links?: Array<{
        url: string;
        note?: string;
    }>;
    sources?: Array<{
        url: string;
        note?: string;
    }>;
    offices?: Array<{
        name: string;
        fax?: string;
        voice?: string;
        address?: string;
        classification?: string;
    }>;
}