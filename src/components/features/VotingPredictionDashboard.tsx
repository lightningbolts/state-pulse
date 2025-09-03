'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  Download,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react';

interface BatchPredictionResult {
  success: boolean;
  processed: number;
  total: number;
  predictions: any[];
}

export function VotingPredictionDashboard() {
  const [legislationIds, setLegislationIds] = useState('');
  const [politicalContext, setPoliticalContext] = useState({
    controllingParty: '',
    partisanBalance: '',
    recentElections: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchPredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleBatchPrediction = async () => {
    const ids = legislationIds
      .split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (ids.length === 0) {
      setError('Please enter at least one legislation ID');
      return;
    }

    if (ids.length > 50) {
      setError('Maximum batch size is 50 items');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/legislation/predictions/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legislationIds: ids,
          politicalContext: {
            controllingParty: politicalContext.controllingParty || undefined,
            partisanBalance: politicalContext.partisanBalance || undefined,
            recentElections: politicalContext.recentElections || undefined,
          }
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(errorData.error || 'Failed to generate batch predictions');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate predictions');
      console.error('Batch prediction error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;

    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `voting-predictions-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getSuccessRate = () => {
    if (!results) return 0;
    return Math.round((results.processed / results.total) * 100);
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-500" />
            Voting Prediction Dashboard
          </CardTitle>
          <p className="text-muted-foreground">
            Generate voting outcome predictions for multiple pieces of legislation in batch.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="legislationIds">
                  Legislation IDs (one per line, max 50)
                </Label>
                <Textarea
                  id="legislationIds"
                  placeholder={`Enter legislation IDs:\nocd-bill/1a2b3c4d\nocd-bill/5e6f7g8h\n...`}
                  className="h-32"
                  value={legislationIds}
                  onChange={(e) => setLegislationIds(e.target.value)}
                />
                <div className="text-sm text-muted-foreground mt-1">
                  {legislationIds.split('\n').filter(id => id.trim()).length} IDs entered
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="controllingParty">Controlling Party (Optional)</Label>
                <Input
                  id="controllingParty"
                  placeholder="e.g., Republican, Democratic"
                  value={politicalContext.controllingParty}
                  onChange={(e) => setPoliticalContext(prev => ({
                    ...prev,
                    controllingParty: e.target.value
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="partisanBalance">Partisan Balance (Optional)</Label>
                <Input
                  id="partisanBalance"
                  placeholder="e.g., 60-40 Republican majority"
                  value={politicalContext.partisanBalance}
                  onChange={(e) => setPoliticalContext(prev => ({
                    ...prev,
                    partisanBalance: e.target.value
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="recentElections">Recent Elections Context (Optional)</Label>
                <Input
                  id="recentElections"
                  placeholder="e.g., 2024 wave election favoring..."
                  value={politicalContext.recentElections}
                  onChange={(e) => setPoliticalContext(prev => ({
                    ...prev,
                    recentElections: e.target.value
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleBatchPrediction}
              disabled={isProcessing || !legislationIds.trim()}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Generate Predictions'}
            </Button>

            {results && (
              <Button
                variant="outline"
                onClick={downloadResults}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Results
              </Button>
            )}
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing predictions...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Batch Processing Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {results.processed}
                </div>
                <div className="text-sm text-green-700">Successful Predictions</div>
              </div>

              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {results.total - results.processed}
                </div>
                <div className="text-sm text-red-700">Failed Predictions</div>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {getSuccessRate()}%
                </div>
                <div className="text-sm text-blue-700">Success Rate</div>
              </div>
            </div>

            {/* Preview of Results */}
            <div className="space-y-4">
              <h4 className="font-semibold">Prediction Summary</h4>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {results.predictions.slice(0, 10).map((prediction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-600">
                        {prediction.legislationId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          prediction.prediction.outcome === 'pass' ? 'default' :
                          prediction.prediction.outcome === 'fail' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {prediction.prediction.outcome.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {prediction.prediction.confidence}% confidence
                      </span>
                    </div>
                  </div>
                ))}
                {results.predictions.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ... and {results.predictions.length - 10} more results
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
