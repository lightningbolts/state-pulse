'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VotingPredictionCard } from './VotingPredictionCard';
import { useVotingPrediction } from '@/hooks/use-voting-prediction';
import { RefreshCw, Settings, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VotingPredictionSectionProps {
  legislationId: string;
}

export function VotingPredictionSection({ legislationId }: VotingPredictionSectionProps) {
  const [politicalContext, setPoliticalContext] = useState({
    controllingParty: '',
    partisanBalance: '',
    recentElections: ''
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const {
    prediction,
    isLoading,
    error,
    refetch,
    generatePrediction
  } = useVotingPrediction({
    legislationId,
    politicalContext: {
      controllingParty: politicalContext.controllingParty || undefined,
      partisanBalance: politicalContext.partisanBalance || undefined,
      recentElections: politicalContext.recentElections || undefined,
    },
    autoFetch: true
  });

  const handleRefresh = () => {
    refetch(true);
  };

  const handleGenerateWithContext = async () => {
    await generatePrediction(politicalContext);
    setIsDialogOpen(false);
  };

  const handleContextChange = (field: string, value: string) => {
    setPoliticalContext(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">Voting Outcome Prediction</h3>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Political Context</DialogTitle>
                <DialogDescription>
                  Provide additional political context to improve prediction accuracy.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="controllingParty">Controlling Party</Label>
                  <Input
                    id="controllingParty"
                    placeholder="e.g., Republican, Democratic"
                    value={politicalContext.controllingParty}
                    onChange={(e) => handleContextChange('controllingParty', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partisanBalance">Partisan Balance</Label>
                  <Input
                    id="partisanBalance"
                    placeholder="e.g., 60-40 Republican majority"
                    value={politicalContext.partisanBalance}
                    onChange={(e) => handleContextChange('partisanBalance', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recentElections">Recent Election Context</Label>
                  <Input
                    id="recentElections"
                    placeholder="e.g., Recent wave election favoring..."
                    value={politicalContext.recentElections}
                    onChange={(e) => handleContextChange('recentElections', e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleGenerateWithContext} disabled={isLoading}>
                  {isLoading ? 'Generating...' : 'Generate Prediction'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}. Try refreshing or check your internet connection.
          </AlertDescription>
        </Alert>
      )}

      {!prediction && !isLoading && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground text-center mb-4">
              Generate an AI-powered voting outcome prediction for this legislation
            </p>
            <Button onClick={() => refetch(true)} disabled={isLoading}>
              Generate Prediction
            </Button>
          </CardContent>
        </Card>
      )}

      {(prediction || isLoading) && (
        <VotingPredictionCard prediction={prediction!} isLoading={isLoading} />
      )}

      {prediction && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-semibold mb-1">About Voting Predictions:</p>
          <p>
            These predictions are generated using AI analysis of bill content, sponsor information,
            political context, and historical patterns. They are estimates based on available data
            and should not be considered definitive forecasts. Political outcomes can be influenced
            by many unpredictable factors.
          </p>
        </div>
      )}
    </div>
  );
}
