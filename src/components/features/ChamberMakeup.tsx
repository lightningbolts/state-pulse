"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';

interface Representative {
  id: string;
  name: string;
  party: string;
  district?: string;
}

interface PartyData {
  party: string;
  count: number;
  percentage: number;
  representatives: Representative[];
}

interface ChamberData {
  chamber: string;
  totalSeats: number;
  parties: PartyData[];
}

interface PartyMakeupData {
  success: boolean;
  state: string;
  chambers: ChamberData[];
  summary: {
    totalRepresentatives: number;
    chambersAvailable: string[];
  };
}

interface PartyMakeupProps {
  state: string;
}

const PARTY_COLORS: Record<string, string> = {
  'Democratic': '#2563eb', // Blue
  'Republican': '#dc2626', // Red
  'Other': 'hsl(var(--primary))', // StatePulse green
  'Independent': 'hsl(var(--primary))',
  'Nonpartisan': 'hsl(var(--primary))',
  'Unknown': '#6b7280' // Gray
};

export function ChamberMakeup({ state }: PartyMakeupProps) {
  const [data, setData] = useState<PartyMakeupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    const fetchChamberMakeup = async () => {
      if (!state) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/chamber-makeup/${encodeURIComponent(state)}`);
        if (!response.ok) {
          console.error(`Failed to fetch chamber makeup: ${response.status}`);
        }
        const result = await response.json();
        if (result.success) {
          setData(result);
        } else {
          console.error(result.error || 'Failed to fetch chamber makeup');
        }
      } catch (err) {
        console.error('Error fetching chamber makeup:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchChamberMakeup();
  }, [state]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg md:text-xl">
            {/* <Users className="h-5 w-5" /> */}
            Chamber Makeup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading chamber makeup...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="text-lg h-5 w-5" />
            Chamber Makeup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Error loading chamber makeup data</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.chambers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg md:text-xl">
            {/* <Users className="h-5 w-5" />  */}
            Chamber Makeup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No chamber makeup data available for {state}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderPartyBar = (parties: PartyData[], totalSeats: number) => {
    return (
      <div className="w-full h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex">
        {parties.map((party, index) => {
          const width = (party.count / totalSeats) * 100;
          const color = PARTY_COLORS[party.party] || PARTY_COLORS['Unknown'];
          
          return (
            <div
              key={`${party.party}-${index}`}
              className="h-full flex items-center justify-center text-xs font-medium text-white"
              style={{
                width: `${width}%`,
                backgroundColor: color,
                minWidth: width > 10 ? 'auto' : '0px' // Only show text if segment is wide enough
              }}
              title={`${party.party}: ${party.count} seats (${party.percentage}%)`}
            >
              {width > 15 && party.count} {/* Only show count if segment is wide enough */}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg md:text-xl">
          {/* <Users className="h-5 w-5" /> */}
          Chamber Makeup - {data.state}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.chambers.map((chamber, chamberIndex) => (
          <div key={`${chamber.chamber}-${chamberIndex}`} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">
                {chamber.chamber === 'House' ? 'Lower Chamber (House)' : 
                 chamber.chamber === 'Senate' ? 'Upper Chamber (Senate)' : 
                 chamber.chamber}
              </h4>
              <Badge variant="outline" className="text-sm">
                {chamber.totalSeats} seats
              </Badge>
            </div>
            {/* Visual party breakdown bar */}
            {renderPartyBar(chamber.parties, chamber.totalSeats)}
            {/* Party breakdown details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {chamber.parties.map((party, partyIndex) => (
                <div 
                  key={`${party.party}-${partyIndex}`}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderLeftColor: PARTY_COLORS[party.party] || PARTY_COLORS['Unknown'], borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PARTY_COLORS[party.party] || PARTY_COLORS['Unknown'] }}
                    />
                    <span className="font-medium text-sm">{party.party}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{party.count}</div>
                    <div className="text-xs text-muted-foreground">{party.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="text-center text-sm text-muted-foreground">
            Total: {data.summary.totalRepresentatives} representatives across {data.summary.chambersAvailable.length} chamber{data.summary.chambersAvailable.length !== 1 ? 's' : ''}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChamberMakeup;
