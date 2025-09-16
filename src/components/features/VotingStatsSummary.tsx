"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Users,
  Calendar,
  Building,
  UserX
} from 'lucide-react';
import { RepresentativeVotingRecord, formatVoteCount } from '@/services/representativeVotingService';

interface VotingStatsSummaryProps {
  records: RepresentativeVotingRecord[];
}

interface VotingStats {
  totalVotes: number;
  byPosition: {
    Yea: number;
    Nay: number;
    'Not Voting': number;
    Present: number;
    Other: number;
  };
  byChamber: {
    'US House': number;
    'US Senate': number;
  };
  votedAgainstParty: number;
  participationRate: number;
  recentActivity: {
    last30Days: number;
    last90Days: number;
  };
}

export const VotingStatsSummary: React.FC<VotingStatsSummaryProps> = ({ records }) => {
  const calculateStats = (): VotingStats => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const stats: VotingStats = {
      totalVotes: records.length,
      byPosition: {
        Yea: 0,
        Nay: 0,
        'Not Voting': 0,
        Present: 0,
        Other: 0
      },
      byChamber: {
        'US House': 0,
        'US Senate': 0
      },
      votedAgainstParty: 0,
      participationRate: 0,
      recentActivity: {
        last30Days: 0,
        last90Days: 0
      }
    };

    let votedAgainstPartyCount = 0;
    let participationCount = 0;

    records.forEach(record => {
      const voteDate = new Date(record.date);
      
      // Count by position
      const position = record.representativeVote.voteCast;
      if (position in stats.byPosition) {
        stats.byPosition[position as keyof typeof stats.byPosition]++;
      } else {
        stats.byPosition.Other++;
      }

      // Count by chamber
      if (record.chamber in stats.byChamber) {
        stats.byChamber[record.chamber as keyof typeof stats.byChamber]++;
      }

      // Recent activity
      if (voteDate >= thirtyDaysAgo) {
        stats.recentActivity.last30Days++;
      }
      if (voteDate >= ninetyDaysAgo) {
        stats.recentActivity.last90Days++;
      }

      // Participation (not "Not Voting")
      if (position !== 'Not Voting' && position !== 'Absent') {
        participationCount++;
      }

      // Voted against party
      if (record.votedAgainstParty) {
        votedAgainstPartyCount++;
      }
    });

    stats.participationRate = records.length > 0 ? (participationCount / records.length) * 100 : 0;
    stats.votedAgainstParty = participationCount > 0 ? (votedAgainstPartyCount / participationCount) * 100 : 0;

    return stats;
  };

  const stats = calculateStats();

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    trend,
    color = "text-primary"
  }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
  }) => (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="p-3 sm:pt-6 sm:p-6">
        <div className="flex items-center justify-between min-w-0">
          <div className="space-y-1 min-w-0 overflow-hidden">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <div className="flex items-center gap-2 min-w-0">
              <p className={`text-lg sm:text-2xl font-bold ${color} truncate`}>{value}</p>
              {/*{trend && (*/}
              {/*  <div className={`flex items-center ${*/}
              {/*    trend === 'up' ? 'text-green-600' : */}
              {/*    trend === 'down' ? 'text-red-600' : */}
              {/*    'text-gray-600'*/}
              {/*  }`}>*/}
              {/*    {trend === 'up' && <TrendingUp className="h-4 w-4" />}*/}
              {/*    {trend === 'down' && <TrendingDown className="h-4 w-4" />}*/}
              {/*  </div>*/}
              {/*)}*/}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground break-words">{description}</p>
            )}
          </div>
          {/* <Icon className={`h-8 w-8 ${color} opacity-60`} /> */}
        </div>
      </CardContent>
    </Card>
  );

  if (records.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 overflow-hidden">
      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        <StatCard
          title="Total Votes"
          value={stats.totalVotes}
          icon={BarChart3}
          description="All recorded votes"
          color="text-primary"
        />
        
        <StatCard
          title="Participation Rate"
          value={`${stats.participationRate.toFixed(1)}%`}
          icon={Users}
          description="Votes cast (not absent)"
          trend={stats.participationRate > 90 ? 'up' : stats.participationRate < 70 ? 'down' : 'neutral'}
          color="text-blue-600"
        />
        
        <StatCard
          title="Against Party"
          value={`${stats.votedAgainstParty.toFixed(1)}%`}
          icon={UserX}
          description="Voted against party line"
          color="text-green-600"
          trend={stats.votedAgainstParty > 10 ? 'down' : 'neutral'}
        />
        
        <StatCard
          title="Recent Activity"
          value={stats.recentActivity.last30Days}
          icon={Calendar}
          description="Votes in last 30 days"
          color="text-purple-600"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 min-w-0">
        {/* Vote Position Breakdown */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span className="truncate">Vote Positions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center min-w-0">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm font-medium truncate">Yea/Yes</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm sm:text-base">{stats.byPosition.Yea}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition.Yea, stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center min-w-0">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm font-medium truncate">Nay/No</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm sm:text-base">{stats.byPosition.Nay}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition.Nay, stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center min-w-0">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm font-medium truncate">Not Voting</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm sm:text-base">{stats.byPosition['Not Voting']}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition['Not Voting'], stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center min-w-0">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <span className="text-xs sm:text-sm font-medium truncate">Present</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-sm sm:text-base">{stats.byPosition.Present}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition.Present, stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chamber Breakdown & Recent Activity */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Building className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span className="truncate">Chamber & Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              {/* Chamber breakdown */}
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-medium mb-2 truncate">By Chamber</h4>
                <div className="space-y-2">
                  {stats.byChamber['US House'] > 0 && (
                    <div className="flex justify-between items-center min-w-0">
                      <span className="text-xs sm:text-sm truncate">House</span>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">{stats.byChamber['US House']} votes</Badge>
                    </div>
                  )}
                  {stats.byChamber['US Senate'] > 0 && (
                    <div className="flex justify-between items-center min-w-0">
                      <span className="text-xs sm:text-sm truncate">Senate</span>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">{stats.byChamber['US Senate']} votes</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div className="border-t pt-3 sm:pt-4 min-w-0">
                <h4 className="text-xs sm:text-sm font-medium mb-2 truncate">Recent Activity</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-xs sm:text-sm truncate">Last 30 days</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{stats.recentActivity.last30Days} votes</Badge>
                  </div>
                  <div className="flex justify-between items-center min-w-0">
                    <span className="text-xs sm:text-sm truncate">Last 90 days</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{stats.recentActivity.last90Days} votes</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
