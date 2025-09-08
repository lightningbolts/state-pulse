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
  Building
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
  agreementWithMajority: number;
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
      agreementWithMajority: 0,
      participationRate: 0,
      recentActivity: {
        last30Days: 0,
        last90Days: 0
      }
    };

    let agreementCount = 0;
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

      // Agreement with majority (simplified: if rep voted same as the majority)
      const totalBallotsCast = record.voteBreakdown.Yea + record.voteBreakdown.Nay;
      if (totalBallotsCast > 0) {
        const majorityVote = record.voteBreakdown.Yea > record.voteBreakdown.Nay ? 'Yea' : 'Nay';
        if (position === majorityVote || (position === 'Yes' && majorityVote === 'Yea') || (position === 'No' && majorityVote === 'Nay')) {
          agreementCount++;
        }
      }
    });

    stats.participationRate = records.length > 0 ? (participationCount / records.length) * 100 : 0;
    stats.agreementWithMajority = records.length > 0 ? (agreementCount / records.length) * 100 : 0;

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
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              {trend && (
                <div className={`flex items-center ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {trend === 'down' && <TrendingDown className="h-4 w-4" />}
                </div>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
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
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Majority Agreement"
          value={`${stats.agreementWithMajority.toFixed(1)}%`}
          icon={TrendingUp}
          description="Voted with majority"
          color="text-green-600"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vote Position Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Vote Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Yea/Yes</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{stats.byPosition.Yea}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition.Yea, stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium">Nay/No</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{stats.byPosition.Nay}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition.Nay, stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm font-medium">Not Voting</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{stats.byPosition['Not Voting']}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition['Not Voting'], stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium">Present</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{stats.byPosition.Present}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVoteCount(stats.byPosition.Present, stats.totalVotes).split(' ')[1]}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chamber Breakdown & Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Chamber & Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Chamber breakdown */}
              <div>
                <h4 className="text-sm font-medium mb-2">By Chamber</h4>
                <div className="space-y-2">
                  {stats.byChamber['US House'] > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">House</span>
                      <Badge variant="secondary">{stats.byChamber['US House']} votes</Badge>
                    </div>
                  )}
                  {stats.byChamber['US Senate'] > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Senate</span>
                      <Badge variant="secondary">{stats.byChamber['US Senate']} votes</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Last 30 days</span>
                    <Badge variant="outline">{stats.recentActivity.last30Days} votes</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Last 90 days</span>
                    <Badge variant="outline">{stats.recentActivity.last90Days} votes</Badge>
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
