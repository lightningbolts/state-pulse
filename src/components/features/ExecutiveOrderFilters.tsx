"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { RefreshCw, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

const US_STATES = [
  'All States',
  'United States', // Federal
  'California',
  'Texas',
  'New York',
  'Florida',
  'Illinois',
  'Pennsylvania',
  'Ohio',
  'Georgia',
  'North Carolina',
  'Michigan'
];

interface ExecutiveOrderFiltersProps {
  initialState: string;
  initialDays: number;
}

export function ExecutiveOrderFilters({
  initialState,
  initialDays
}: ExecutiveOrderFiltersProps) {
  const [selectedState, setSelectedState] = useState<string>(initialState);
  const [dayRange, setDayRange] = useState<number>(initialDays);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    updateURL(value, dayRange);
  };

  const handleDayRangeChange = (value: string) => {
    const days = parseInt(value);
    setDayRange(days);
    updateURL(selectedState, days);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    router.refresh();
    // Reset refreshing state after a delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  const updateURL = (state: string, days: number) => {
    const params = new URLSearchParams();

    if (state && state !== 'All States') {
      params.set('state', state);
    }

    if (days !== 30) {
      params.set('days', days.toString());
    }

    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.push(`/executive-orders${newURL}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">State/Federal</label>
            <Select value={selectedState} onValueChange={handleStateChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Time Range</label>
            <Select value={dayRange.toString()} onValueChange={handleDayRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 2 weeks</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 2 months</SelectItem>
                <SelectItem value="90">Last 3 months</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
