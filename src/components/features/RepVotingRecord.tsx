"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  ChevronRight, 
  Vote, 
  Calendar, 
  FileText,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3
} from 'lucide-react';
import { 
  getRepresentativeVotingRecords,
  RepresentativeVotingRecord,
  VotingRecordsResponse,
  VotingRecordsFilters,
  getVotePositionColor,
  formatVoteCount
} from '@/services/representativeVotingService';
import { VotingRecordCard } from './VotingRecordCard';
import { VotingStatsSummary } from './VotingStatsSummary';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

interface RepVotingRecordProps {
  representativeId: string;
  representativeName?: string;
}

export default function RepVotingRecord({ representativeId, representativeName }: RepVotingRecordProps) {
  const [votingRecords, setVotingRecords] = useState<RepresentativeVotingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'bill_number'>('date');
  const [filterByVote, setFilterByVote] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;
  const [renderKey, setRenderKey] = useState(0);

  // Force re-render when representativeId changes to prevent stale renders
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [representativeId]);

  // Fetch voting records on component mount and when representativeId changes
  useEffect(() => {
    if (!representativeId) {
      return;
    }

    // Reset state when representativeId changes
    setVotingRecords([]);
    setError(null);
    setSearchTerm('');
    setFilterByVote('all');
    setCurrentPage(1);

    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchVotingRecords = async () => {
      if (!isMounted) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Test direct API call first
        // const directResponse = await fetch(`/api/representatives/${representativeId}/voting-records`);
        
        if (!isMounted) return; // Check if component is still mounted
        
        // Now test service function
        const response = await getRepresentativeVotingRecords(representativeId, {
          limit: 500, // Request more records by default
          sortBy: 'date',
          sortOrder: 'desc'
        });
        
        if (!isMounted) return; // Check if component is still mounted
        
        if (response && response.data && response.data.votingRecords) {
          setVotingRecords(response.data.votingRecords);
        } else {
          setVotingRecords([]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load voting records');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchVotingRecords();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [representativeId]);

  // Helper to normalize strings for robust search (remove spaces, punctuation, lowercase)
  function normalizeText(str: string | number | undefined | null): string {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '');
  }

  // Full-text search across all relevant fields, robust to spaces/punctuation, and prioritize best matches

  function getBestMatchScore(record: RepresentativeVotingRecord, normSearch: string, rawSearch: string): number {
    // Lower score is better (0 = exact, 1 = startsWith, 2 = substring, 3 = not found)
    // Shorter field length is better for tie-breaker
    const fields = [
      record.legislationNumber,
      record.voteQuestion,
      record.result,
      record.chamber,
      record.date,
      record.rollCallNumber,
      record.session,
      record.representativeVote?.voteCast,
      record.bill_id,
    ];
    let bestScore = 3;
    let bestLength = Infinity;
    for (const f of fields) {
      if (typeof f !== 'string') continue;
      const normField = normalizeText(f);
      if (normField === normSearch) {
        if (0 < bestScore || normField.length < bestLength) {
          bestScore = 0;
          bestLength = normField.length;
        }
      } else if (normField.startsWith(normSearch)) {
        if (1 < bestScore || normField.length < bestLength) {
          bestScore = 1;
          bestLength = normField.length;
        }
      } else if (normField.includes(normSearch)) {
        if (2 < bestScore || normField.length < bestLength) {
          bestScore = 2;
          bestLength = normField.length;
        }
      }
    }
    // Special: vote number search (e.g. 'house vote 239', '#239')
    const voteNumMatch = rawSearch.match(/(?:house|senate)?\s*vote\s*#?(\d+)/i) || rawSearch.match(/^#(\d+)$/);
    if (voteNumMatch && record.rollCallNumber) {
      const searchNum = voteNumMatch[1];
      if (String(record.rollCallNumber) === searchNum) {
        // Highest priority for exact vote number
        return -1000;
      }
    }
    return bestScore * 10000 + bestLength; // Lower is better
  }

  const filteredRecords = votingRecords
    .map(record => {
      const matchesVoteFilter = filterByVote === 'all' || record.representativeVote?.voteCast === filterByVote;
      if (!searchTerm) {
        return matchesVoteFilter ? { record, matchScore: 0 } : null;
      }
      const normSearch = normalizeText(searchTerm);
      const matchScore = getBestMatchScore(record, normSearch, searchTerm);
      // Only include if there's a match and vote filter passes
      const hasMatch = matchScore < 30000;
      return hasMatch && matchesVoteFilter ? { record, matchScore } : null;
    })
    .filter(Boolean) // Remove nulls
    .sort((a: any, b: any) => {
      // Prioritize best match, then current sort
      if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
      if (sortBy === 'date') {
        return new Date(b.record.date || 0).getTime() - new Date(a.record.date || 0).getTime();
      } else {
        return (a.record.legislationNumber || '').localeCompare(b.record.legislationNumber || '');
      }
    })
    .map((x: any) => x.record);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + recordsPerPage);

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Voting Record
        </h2>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading voting records...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Voting Record
        </h2>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Error loading voting records: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div key={renderKey} className="space-y-4 sm:space-y-6 min-w-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words">
          Voting Record{representativeName ? ` for ${representativeName}` : ''}
        </h2>
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {votingRecords.length > 0 && (
        <VotingStatsSummary records={votingRecords} />
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <Input
            type="text"
            placeholder="Search by bill or vote..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm"
          />
        </div>
        <div className="flex flex-col xs:flex-row gap-2 min-w-0">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'date' | 'bill_number')}>
            <SelectTrigger className="w-full xs:w-28 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="bill_number">Bill #</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterByVote} onValueChange={setFilterByVote}>
            <SelectTrigger className="w-full xs:w-28 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Votes</SelectItem>
              <SelectItem value="Yea">Yea</SelectItem>
              <SelectItem value="Nay">Nay</SelectItem>
              <SelectItem value="Present">Present</SelectItem>
              <SelectItem value="Not Voting">Not Voting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Voting Records List */}
      {paginatedRecords.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filterByVote !== 'all' 
              ? 'No voting records match your current filters.' 
              : 'No voting records found for this representative.'}
          </p>
          {(searchTerm || filterByVote !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterByVote('all');
              }}
              className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedRecords.map((record, index) => (
            <AnimatedSection key={`${record.rollCallNumber}-${index}`}>
              <VotingRecordCard record={record} />
            </AnimatedSection>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
            Showing {startIndex + 1}-{Math.min(startIndex + recordsPerPage, filteredRecords.length)} of {filteredRecords.length} records
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Previous
            </Button>
            <span className="flex items-center px-2 sm:px-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}