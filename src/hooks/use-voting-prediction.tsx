import { useState, useEffect } from 'react';
import { VotingPrediction } from '@/services/votingPredictionService';

interface UseVotingPredictionOptions {
  legislationId: string;
  politicalContext?: {
    controllingParty?: string;
    partisanBalance?: string;
    recentElections?: string;
  };
  autoFetch?: boolean;
}

interface UseVotingPredictionReturn {
  prediction: VotingPrediction | null;
  isLoading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  generatePrediction: (context?: any) => Promise<void>;
}

export function useVotingPrediction({
  legislationId,
  politicalContext,
  autoFetch = true
}: UseVotingPredictionOptions): UseVotingPredictionReturn {
  const [prediction, setPrediction] = useState<VotingPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async (forceRefresh: boolean = false) => {
    if (!legislationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', 'true');
      if (politicalContext?.controllingParty) params.set('controllingParty', politicalContext.controllingParty);
      if (politicalContext?.partisanBalance) params.set('partisanBalance', politicalContext.partisanBalance);
      if (politicalContext?.recentElections) params.set('recentElections', politicalContext.recentElections);

      const response = await fetch(
        `/api/legislation/${legislationId}/prediction?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }

      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction');
      console.error('Error fetching voting prediction:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrediction = async (context?: any) => {
    if (!legislationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/legislation/${legislationId}/prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          politicalContext: context || politicalContext
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate prediction: ${response.statusText}`);
      }

      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prediction');
      console.error('Error generating voting prediction:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && legislationId) {
      fetchPrediction();
    }
  }, [legislationId, autoFetch]);

  return {
    prediction,
    isLoading,
    error,
    refetch: fetchPrediction,
    generatePrediction
  };
}
