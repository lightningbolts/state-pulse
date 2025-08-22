"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import {
  FileText,
  Users,
  MessageSquare,
  TrendingUp,
  Calendar,
  MapPin,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface HomepageStats {
  legislation: {
    total: number;
    recent: number;
    active: number;
    daily: number;
    topSubjects: Array<{ subject: string; count: number }>;
  };
  representatives: {
    total: number;
    state: number;
    congress: number;
    parties: Array<{ _id: string; count: number }>;
  };
  posts: {
    total: number;
    recent: number;
    active: number;
  };
  jurisdictions: number;
  lastUpdated: string;
}

export default function StatisticsShowcase() {
  const [stats, setStats] = useState<HomepageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/homepage/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setLastRefresh(new Date());
      } else {
        setError('Failed to load statistics');
        // Use fallback stats if API fails
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching homepage stats:', err);
      setError('Failed to connect to statistics service');
      // Provide fallback data
      setStats({
        legislation: { total: 0, recent: 0, active: 0, daily: 0, topSubjects: [] },
        representatives: { total: 0, state: 0, congress: 0, parties: [] },
        posts: { total: 0, recent: 0, active: 0 },
        jurisdictions: 0,
        lastUpdated: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <AnimatedSection className="py-20 px-6 md:px-10 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-8">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-lg text-muted-foreground">Loading latest statistics...</span>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection className="py-20 px-6 md:px-10 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 tracking-tight">
            StatePulse by the Numbers
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed mb-4">
            Real-time statistics from our comprehensive database of legislation and representatives.
          </p>
          {stats?.lastUpdated && (
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Last updated: {formatTimeAgo(stats.lastUpdated)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchStats}
                className="ml-2 h-6 px-2"
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Legislation Statistics */}
          <Card className="overflow-hidden shadow-xl bg-white dark:bg-slate-800 border-0 hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="bg-blue-50 dark:bg-blue-950/20 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-blue-900 dark:text-blue-100">
                      Legislation
                    </CardTitle>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Live Data
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {formatNumber(stats?.legislation.total || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Bills</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {formatNumber(stats?.legislation.active || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Bills</div>
                </div>
              </div>

              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">
                  {formatNumber(stats?.legislation.recent || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Updated This Month</div>
              </div>

              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">
                  {formatNumber(stats?.legislation.daily || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Updated Today</div>
              </div>

              {stats?.legislation.topSubjects && stats.legislation.topSubjects.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Top Policy Areas</h4>
                  <div className="space-y-2">
                    {stats.legislation.topSubjects.slice(0, 5).map((subject, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-foreground truncate">{subject.subject}</span>
                        <Badge variant="outline" className="text-xs">
                          {formatNumber(subject.count)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button asChild className="w-full group">
                <Link href="/legislation">
                  Explore Legislation
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Representatives Statistics */}
          <Card className="overflow-hidden shadow-xl bg-white dark:bg-slate-800 border-0 hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="bg-green-50 dark:bg-green-950/20 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-green-900 dark:text-green-100">
                      Representatives
                    </CardTitle>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  All Levels
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {formatNumber(stats?.representatives.state || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">State Level</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {formatNumber(stats?.representatives.congress || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Federal Level</div>
                </div>
              </div>

              <div className="text-center p-4 bg-green-50 dark:bg-green-950/10 rounded-lg">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300 mb-1">
                  {formatNumber(stats?.representatives.total || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Representatives</div>
              </div>

              {stats?.representatives.parties && stats.representatives.parties.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Party Breakdown</h4>
                  <div className="space-y-2">
                    {stats.representatives.parties.slice(0, 5).map((party, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-foreground truncate">
                          {party._id || 'Unknown'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {formatNumber(party.count)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button asChild variant="outline" className="w-full group">
                <Link href="/representatives">
                  Find Representatives
                  <MapPin className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Community Posts Statistics */}
          {/*<Card className="overflow-hidden shadow-xl bg-white dark:bg-slate-800 border-0 hover:shadow-2xl transition-shadow duration-300">*/}
          {/*  <CardHeader className="bg-purple-50 dark:bg-purple-950/20 pb-4">*/}
          {/*    <div className="flex items-center justify-between">*/}
          {/*      <div className="flex items-center space-x-3">*/}
          {/*        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">*/}
          {/*          <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />*/}
          {/*        </div>*/}
          {/*        <div>*/}
          {/*          <CardTitle className="text-xl text-purple-900 dark:text-purple-100">*/}
          {/*            Community*/}
          {/*          </CardTitle>*/}
          {/*        </div>*/}
          {/*      </div>*/}
          {/*      <Badge variant="secondary" className="text-xs">*/}
          {/*        Active*/}
          {/*      </Badge>*/}
          {/*    </div>*/}
          {/*  </CardHeader>*/}
          {/*  <CardContent className="p-6 space-y-6">*/}
          {/*    <div className="grid grid-cols-2 gap-4">*/}
          {/*      <div className="text-center">*/}
          {/*        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">*/}
          {/*          {formatNumber(stats?.posts.total || 0)}*/}
          {/*        </div>*/}
          {/*        <div className="text-sm text-muted-foreground">Total Posts</div>*/}
          {/*      </div>*/}
          {/*      <div className="text-center">*/}
          {/*        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">*/}
          {/*          {formatNumber(stats?.posts.active || 0)}*/}
          {/*        </div>*/}
          {/*        <div className="text-sm text-muted-foreground">Active Discussions</div>*/}
          {/*      </div>*/}
          {/*    </div>*/}

          {/*    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/10 rounded-lg">*/}
          {/*      <div className="text-2xl font-bold text-purple-700 dark:text-purple-300 mb-1">*/}
          {/*        {formatNumber(stats?.posts.recent || 0)}*/}
          {/*      </div>*/}
          {/*      <div className="text-sm text-muted-foreground">New This Week</div>*/}
          {/*    </div>*/}

          {/*    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/10 dark:to-pink-950/10 rounded-lg">*/}
          {/*      <div className="flex items-center space-x-2 mb-2">*/}
          {/*        <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />*/}
          {/*        <span className="text-sm font-medium text-purple-900 dark:text-purple-100">*/}
          {/*          Community Growth*/}
          {/*        </span>*/}
          {/*      </div>*/}
          {/*      <div className="text-xs text-muted-foreground">*/}
          {/*        Join thousands of engaged citizens discussing policy and legislation*/}
          {/*      </div>*/}
          {/*    </div>*/}

          {/*    <Button asChild variant="outline" className="w-full group border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/20">*/}
          {/*      <Link href="/posts">*/}
          {/*        Join Discussion*/}
          {/*        <MessageSquare className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />*/}
          {/*      </Link>*/}
          {/*    </Button>*/}
          {/*  </CardContent>*/}
          {/*</Card>*/}
        </div>

        {/* Platform Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="text-2xl font-bold text-primary mb-2">
              {formatNumber((stats?.legislation.total || 0) + (stats?.posts.total || 0))}
            </div>
            <div className="text-sm text-muted-foreground">Total Content Items</div>
          </div>

          <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="text-2xl font-bold text-primary mb-2">
              {formatNumber(stats?.jurisdictions || 52)}
            </div>
            <div className="text-sm text-muted-foreground">Jurisdictions Covered</div>
          </div>

          <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="text-2xl font-bold text-primary mb-2">
              {formatNumber(stats?.legislation.daily || 0)}
            </div>
            <div className="text-sm text-muted-foreground">Updates Today</div>
          </div>

          <div className="text-center p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <div className="text-2xl font-bold text-primary mb-2">24/7</div>
            <div className="text-sm text-muted-foreground">Live Monitoring</div>
          </div>
        </div>

        {error && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center space-x-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 rounded-lg">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
