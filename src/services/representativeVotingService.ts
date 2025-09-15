import { VotingRecord, MemberVote } from '@/types/legislation';

export interface RepresentativeVotingRecord extends Omit<VotingRecord, 'memberVotes'> {
  representativeVote: MemberVote;
  totalVotes: number;
  voteBreakdown: {
    Yea: number;
    Nay: number;
    'Not Voting': number;
    Present: number;
    Other: number;
  };
  votedAgainstParty: boolean;
}

export interface VotingRecordsResponse {
  success: boolean;
  data: {
    votingRecords: RepresentativeVotingRecord[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalRecords: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      limit: number;
    };
    filters: {
      chamber?: string;
      votePosition?: string;
      sortBy: string;
      sortOrder: string;
    };
  };
}

export interface VotingRecordsFilters {
  page?: number;
  limit?: number;
  chamber?: 'US House' | 'US Senate';
  votePosition?: 'Yea' | 'Nay' | 'Not Voting' | 'Present';
  sortBy?: 'date' | 'bill';
  sortOrder?: 'asc' | 'desc';
}

export async function getRepresentativeVotingRecords(
  representativeId: string,
  filters: VotingRecordsFilters = {}
): Promise<VotingRecordsResponse | null> {
  try {
    const searchParams = new URLSearchParams();
    
    if (filters.page) searchParams.set('page', filters.page.toString());
    if (filters.limit) searchParams.set('limit', filters.limit.toString());
    if (filters.chamber) searchParams.set('chamber', filters.chamber);
    if (filters.votePosition) searchParams.set('votePosition', filters.votePosition);
    if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
    if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);

    const url = `/api/representatives/${representativeId}/voting-records?${searchParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch voting records: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching representative voting records:', error);
    return null;
  }
}

export function getVotePositionColor(vote: string): string {
  switch (vote) {
    case 'Yea':
    case 'Yes':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700';
    case 'Nay':
    case 'No':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700';
    case 'Not Voting':
    case 'Absent':
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
    case 'Present':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700';
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700';
  }
}

export function formatVoteCount(count: number, total: number): string {
  if (total === 0) return '0 (0%)';
  const percentage = ((count / total) * 100).toFixed(1);
  return `${count} (${percentage}%)`;
}
