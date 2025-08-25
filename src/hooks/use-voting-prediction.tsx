import { useState, useEffect, useRef } from 'react';
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
  canRefresh: boolean;
  timeUntilCanRefresh: number;
}

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

export function useVotingPrediction({
  legislationId,
  politicalContext,
  autoFetch = true
}: UseVotingPredictionOptions): UseVotingPredictionReturn {
  const [prediction, setPrediction] = useState<VotingPrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [timeUntilCanRefresh, setTimeUntilCanRefresh] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user can refresh based on local rate limiting
  const canRefresh = lastRefreshTime === null || (Date.now() - lastRefreshTime) >= RATE_LIMIT_WINDOW;

  // Update countdown timer
  useEffect(() => {
    if (lastRefreshTime && !canRefresh) {
      const updateTimer = () => {
        const timeSinceLastRefresh = Date.now() - lastRefreshTime;
        const remaining = RATE_LIMIT_WINDOW - timeSinceLastRefresh;

        if (remaining <= 0) {
          setTimeUntilCanRefresh(0);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          setTimeUntilCanRefresh(Math.ceil(remaining / 1000));
        }
      };

      updateTimer();
      intervalRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      setTimeUntilCanRefresh(0);
    }
  }, [lastRefreshTime, canRefresh]);

  const fetchPrediction = async (forceRefresh: boolean = false) => {
    if (!legislationId) return;

    // Frontend rate limiting check
    if (forceRefresh && !canRefresh) {
      setError(`Please wait ${timeUntilCanRefresh} seconds before refreshing again`);
      return;
    }

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

      if (response.status === 429) {
        const errorData = await response.json();
        setLastRefreshTime(Date.now());
        setError(errorData.message || 'Rate limit exceeded. Please wait before trying again.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }

      const data = await response.json();
      setPrediction(data);

      // Update last refresh time only for force refresh requests
      if (forceRefresh) {
        setLastRefreshTime(Date.now());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction');
      console.error('Error fetching voting prediction:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrediction = async (context?: any) => {
    if (!legislationId) return;

    // Frontend rate limiting check
    if (!canRefresh) {
      setError(`Please wait ${timeUntilCanRefresh} seconds before generating another prediction`);
      return;
    }

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

      if (response.status === 429) {
        const errorData = await response.json();
        setLastRefreshTime(Date.now());
        setError(errorData.message || 'Rate limit exceeded. Please wait before trying again.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to generate prediction: ${response.statusText}`);
      }

      const data = await response.json();
      setPrediction(data);
      setLastRefreshTime(Date.now());
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

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    prediction,
    isLoading,
    error,
    refetch: fetchPrediction,
    generatePrediction,
    canRefresh,
    timeUntilCanRefresh
  };
}
