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
        const directResponse = await fetch(`/api/representatives/${representativeId}/voting-records`);
        
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

  // Filter and sort records
  const filteredRecords = votingRecords.filter(record => {
    const matchesSearch = !searchTerm || 
      record.legislationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.voteQuestion?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVoteFilter = filterByVote === 'all' || record.representativeVote?.voteCast === filterByVote;
    
    return matchesSearch && matchesVoteFilter;
  }).sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    } else {
      return (a.legislationNumber || '').localeCompare(b.legislationNumber || '');
    }
  });

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
    <div key={renderKey} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Voting Record for {representativeName}
        </h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {votingRecords.length > 0 && (
        <VotingStatsSummary records={votingRecords} />
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search by bill number or vote question..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'date' | 'bill_number')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="bill_number">Bill #</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterByVote} onValueChange={setFilterByVote}>
            <SelectTrigger className="w-32">
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
            <VotingRecordCard key={`${record.rollCallNumber}-${index}`} record={record} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1}-{Math.min(startIndex + recordsPerPage, filteredRecords.length)} of {filteredRecords.length} records
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
              {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}