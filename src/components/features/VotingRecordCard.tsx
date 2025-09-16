"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  FileText,
  ExternalLink,
  BarChart3,
  Users,
  Gavel
} from 'lucide-react';
import Link from 'next/link';
import { RepresentativeVotingRecord, getVotePositionColor, formatVoteCount } from '@/services/representativeVotingService';

interface VotingRecordCardProps {
  record: RepresentativeVotingRecord;
}

export const VotingRecordCard: React.FC<VotingRecordCardProps> = ({ record }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getResultColor = (result: string) => {
    if (result.toLowerCase().includes('passed') || result.toLowerCase().includes('agreed')) {
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700';
    }
    if (result.toLowerCase().includes('failed') || result.toLowerCase().includes('rejected')) {
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
  };

  const getBillUrl = (billId: string | undefined) => {
    if (!billId) return null;
    return `/legislation/${billId}`;
  };

  return (
    <Card className="w-full hover:shadow-md transition-shadow min-w-0 overflow-hidden">
      <CardContent className="p-3 sm:pt-6 sm:p-6">
        <div className="space-y-3 sm:space-y-4 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 min-w-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  {record.chamber === 'US House' ? 'House' : 'Senate'} Vote #{record.rollCallNumber}
                </Badge>
                {record.legislationType && record.legislationNumber && (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {record.legislationType.toUpperCase()} {record.legislationNumber}
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{formatDate(record.date)}</span>
                </div>
              </div>
              
              <h3 className="font-medium text-foreground text-sm sm:text-base leading-relaxed break-words">
                {record.voteQuestion || 
                  (record.legislationType && record.legislationNumber 
                    ? `Vote on ${record.legislationType.toUpperCase()} ${record.legislationNumber}` 
                    : `Roll Call Vote #${record.rollCallNumber}`
                  )
                }
              </h3>
            </div>

            {/* Representative's Vote */}
            <div className="flex sm:flex-col items-center sm:items-end gap-2">
              <Badge 
                className={`px-2 sm:px-3 py-1 font-medium border text-xs sm:text-sm ${getVotePositionColor(record.representativeVote.voteCast)}`}
              >
                {record.representativeVote.voteCast}
              </Badge>
              <Badge 
                className={`px-2 py-1 text-xs border ${getResultColor(record.result)}`}
              >
                {record.result}
              </Badge>
            </div>
          </div>

          {/* Vote Breakdown */}
          <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Vote Breakdown</span>
              <span className="text-xs text-muted-foreground">
                ({record.totalVotes} total)
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 text-xs min-w-0">
              <div className="flex justify-between min-w-0">
                <span className="text-green-700 dark:text-green-300 truncate">Yea:</span>
                <span className="font-medium ml-1 flex-shrink-0">
                  {formatVoteCount(record.voteBreakdown.Yea, record.totalVotes)}
                </span>
              </div>
              <div className="flex justify-between min-w-0">
                <span className="text-red-700 dark:text-red-300 truncate">Nay:</span>
                <span className="font-medium ml-1 flex-shrink-0">
                  {formatVoteCount(record.voteBreakdown.Nay, record.totalVotes)}
                </span>
              </div>
              <div className="flex justify-between min-w-0">
                <span className="text-gray-700 dark:text-gray-300 truncate">Not Voting:</span>
                <span className="font-medium ml-1 flex-shrink-0">
                  {formatVoteCount(record.voteBreakdown['Not Voting'], record.totalVotes)}
                </span>
              </div>
              <div className="flex justify-between min-w-0">
                <span className="text-blue-700 dark:text-blue-300 truncate">Present:</span>
                <span className="font-medium ml-1 flex-shrink-0">
                  {formatVoteCount(record.voteBreakdown.Present, record.totalVotes)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2 border-t min-w-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gavel className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Congress {record.congress}, Session {record.session}</span>
            </div>
            
            <div className="flex gap-2">
              {record.bill_id && getBillUrl(record.bill_id) && (
                <Button asChild variant="outline" size="sm" className="text-xs px-2 sm:px-3">
                  <Link href={getBillUrl(record.bill_id)!} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">View Bill</span>
                    <span className="sm:hidden">Bill</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
