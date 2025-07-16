export interface BallotMeasure {
    id: string;
    title: string;
    type: 'proposition' | 'referendum' | 'initiative' | 'bond' | 'constitutional_amendment';
    number?: string;
    description: string;
    summary: string;
    fullText?: string;
    supportingArgument?: string;
    opposingArgument?: string;
    fiscalImpact?: string;
    jurisdiction: string;
    electionDate: string;
    status: 'upcoming' | 'passed' | 'failed' | 'pending';
}

export interface Candidate {
    id: string;
    name: string;
    party?: string;
    office: string;
    incumbent: boolean;
    website?: string;
    bio?: string;
}

export interface BallotInformationProps {
    userLocation?: {
        state?: string;
        city?: string;
        county?: string;
    };
    onClose?: () => void;
}
