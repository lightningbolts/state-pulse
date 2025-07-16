export interface PublicHearing {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    type: 'city_council' | 'county_board' | 'school_board' | 'planning_commission' | 'other';
    description: string;
    agenda?: string[];
    contact?: {
        phone?: string;
        email?: string;
        website?: string;
    };
    isVirtual: boolean;
    virtualLink?: string;
    status: 'scheduled' | 'cancelled' | 'postponed';
}

export interface PublicHearingsProps {
    userLocation?: {
        state?: string;
        city?: string;
        county?: string;
    };
    onClose?: () => void;
}

export interface ElectionEvent {
    id: string;
    type: 'election' | 'primary' | 'registration_deadline' | 'early_voting' | 'absentee_deadline';
    title: string;
    date: string;
    description?: string;
    location?: string;
    requirements?: string[];
    isUrgent?: boolean;
}

export interface VotingInfoProps {
    userLocation?: {
        state?: string;
        city?: string;
        county?: string;
    };
    onClose?: () => void;
}