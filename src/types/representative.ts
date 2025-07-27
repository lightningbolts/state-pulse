
import { Pagination } from "@/types/index";

// Representative type now matches OpenStatesPerson, plus legacy fields
export interface Representative {
  id: string;
  name: string;
  party?: string;
  current_role?: {
    title: string;
    org_classification: string;
    district?: string | number;
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
  extras?: Record<string, any>;
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
    name?: string;
    fax?: string;
    voice?: string;
    address?: string;
    classification?: string;
    email?: string;
  }>;
  // Legacy/derived fields for compatibility
  office?: string;
  district?: string;
  jurisdictionName?: string;
  phone?: string;
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
  lastUpdated?: Date;
}

// CongressPerson type matches congress.gov API response example
export interface CongressPerson {
  id: string;
  birthYear?: string;
  cosponsoredLegislation?: {
    count: number;
    URL: string;
  };
  depiction?: {
    attribution?: string;
    imageUrl?: string;
  };
  directOrderName?: string;
  firstName?: string;
  honorificName?: string;
  invertedOrderName?: string;
  lastName?: string;
  leadership?: Array<{
    congress: number;
    type: string;
  }>;
  partyHistory?: Array<{
    partyAbbreviation: string;
    partyName: string;
    startYear: number;
  }>;
  sponsoredLegislation?: {
    count: number;
    url: string;
  };
  state?: string;
  terms?: Array<{
    chamber: string;
    congress: number;
    endYear: number;
    memberType: string;
    startYear: number;
    stateCode: string;
    stateName: string;
  }>;
  updateDate?: string;
  lastUpdated?: Date;
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
    roles?: Array<{
        type: string;
        title: string;
        org_classification: string;
        district?: string | number;
        division_id?: string;
        party?: string;
        start_date?: string;
        end_date?: string | null;
    }>;
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