'use client';

import React, { useState } from 'react';
import { useExecutiveOrders } from '../../../hooks/use-executive-orders';
import { ExecutiveOrdersList } from '../../../components/features/ExecutiveOrdersList';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { RefreshCw, Filter } from 'lucide-react';

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

export default function ExecutiveOrdersPage() {
  const [selectedState, setSelectedState] = useState<string>('All States');
  const [dayRange, setDayRange] = useState<number>(30);

  const { orders, loading, error, refetch } = useExecutiveOrders({
    state: selectedState === 'All States' ? undefined : selectedState,
    days: dayRange,
    limit: 100
  });

  const handleStateChange = (value: string) => {
    setSelectedState(value);
  };

  const handleDayRangeChange = (value: string) => {
    setDayRange(parseInt(value));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Executive Orders</h1>
            <p className="text-gray-600 mt-1">
              Track presidential and governor executive orders with AI-powered summaries
            </p>
          </div>

          <Button
            onClick={refetch}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
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
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 3 months</SelectItem>
                    <SelectItem value="180">Last 6 months</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {orders.filter(o => o.state === 'United States').length}
                </div>
                <div className="text-sm text-gray-600">Federal Orders</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {orders.filter(o => o.state !== 'United States').length}
                </div>
                <div className="text-sm text-gray-600">State Orders</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {orders.filter(o => o.geminiSummary).length}
                </div>
                <div className="text-sm text-gray-600">AI Summarized</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Orders List */}
        <ExecutiveOrdersList
          orders={orders}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}
