import { useState, useEffect, useRef } from 'react';

interface UseDetailedAISummaryOptions {
  legislationId: string;
  autoFetch?: boolean;
}

interface UseDetailedAISummaryReturn {
  summary: string | null;
  isLoading: boolean;
  error: string | null;
  generateSummary: (forceRefresh?: boolean) => Promise<void>;
  canRefresh: boolean;
  timeUntilCanRefresh: number;
}

const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

export function useDetailedAISummary({
  legislationId,
  autoFetch = true
}: UseDetailedAISummaryOptions): UseDetailedAISummaryReturn {
  const [summary, setSummary] = useState<string | null>(null);
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

  const generateSummary = async (forceRefresh: boolean = false) => {
    if (!legislationId) return;

    // Frontend rate limiting check
    if (forceRefresh && !canRefresh) {
      setError(`Please wait ${timeUntilCanRefresh} seconds before generating another summary`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', 'true');

      const response = await fetch(
        `/api/legislation/${legislationId}/detailed-summary?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 429) {
        const errorData = await response.json();
        // Use server time if available for better sync
        const serverTime = errorData.serverTime || Date.now();
        const timeUntilReset = errorData.timeUntilReset || 0;
        setLastRefreshTime(serverTime - (RATE_LIMIT_WINDOW - (timeUntilReset * 1000)));
        setError(errorData.message || 'Rate limit exceeded. Please wait before trying again.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || `Failed to generate detailed summary: ${response.statusText}`);
        return;
      }

      const data = await response.json();
      setSummary(data.summary);

      // Update last refresh time
      setLastRefreshTime(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate detailed summary');
      console.error('Error generating detailed AI summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch summary on mount if autoFetch is enabled
  useEffect(() => {
    if (autoFetch && legislationId) {
      generateSummary();
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
    summary,
    isLoading,
    error,
    generateSummary,
    canRefresh,
    timeUntilCanRefresh
  };
}