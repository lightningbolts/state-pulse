'use client';

import { useEffect, useState } from 'react';
import VotingBillPositions from './VotingBillPositions';
import { VotingBillPositionsLoading } from './VotingBillPositionsLoading';

interface VotingBillPositionsLoaderProps {
  billId: string;
}

interface VotingRecordResponse {
  votingRecords: any[];
  recordsByChamber: Record<string, any[]>;
  chambers: string[];
}

export function VotingBillPositionsLoader({ billId }: VotingBillPositionsLoaderProps) {
  const [votingData, setVotingData] = useState<VotingRecordResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadVotingData() {
      setIsLoading(true);
      try {
        let response = await fetch(`/api/legislation/${billId}/bill-voting-info`);

        if (response.status === 404) {
          response = await fetch(`/api/legislation/${billId}/bill-voting-info?sync=true`);
        }

        if (!response.ok) {
          if (!cancelled) setVotingData(null);
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setVotingData(data);
        }
      } catch {
        if (!cancelled) {
          setVotingData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadVotingData();

    return () => {
      cancelled = true;
    };
  }, [billId]);

  if (isLoading) {
    return <VotingBillPositionsLoading />;
  }

  if (!votingData?.votingRecords?.length) {
    return null;
  }

  return <VotingBillPositions votingData={votingData} />;
}
