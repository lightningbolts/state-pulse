"use client"
import React, { useState, useEffect } from 'react';
import ParliamentChart from './ParliamentChart';
import {LoadingOverlay} from "@/components/ui/LoadingOverlay";

interface VotingBillPositionsProps {
  billId: string;
}

interface VotingRecordResponse {
  votingRecords: any[];
  recordsByChamber: Record<string, any[]>;
  chambers: string[];
}

const VotingBillPositions: React.FC<VotingBillPositionsProps> = ({ billId }) => {
  const [votingData, setVotingData] = useState<VotingRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChamber, setSelectedChamber] = useState<string>('all');

  useEffect(() => {
    if (!billId) return;

    const fetchVotingRecord = async () => {
      try {
        const res = await fetch(`/api/legislation/${billId}/bill-voting-info`);
        if (!res.ok) {
          setError(`Failed to fetch voting record: ${res.status} ${res.statusText}`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setVotingData(data);
        // Default to showing all chambers if multiple exist, or the single chamber
        setSelectedChamber(data.chambers.length > 1 ? 'all' : data.chambers[0]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchVotingRecord();
  }, [billId]);

  if (loading) {
    return <LoadingOverlay text={"Loading voting positions..."}/>;
  }

  if (error) {
    return <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-800 dark:text-red-200">{error}</div>;
  }

  if (!votingData || !votingData.votingRecords || votingData.votingRecords.length === 0) {
    return <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-gray-600 dark:text-gray-300">No voting records available for this bill.</div>;
  }

  // Get votes for selected chamber or all chambers
  const getVotesForDisplay = () => {
    if (selectedChamber === 'all') {
      return votingData.votingRecords.flatMap(record => record.memberVotes);
    }
    const chamberRecords = votingData.recordsByChamber[selectedChamber] || [];
    return chamberRecords.flatMap(record => record.memberVotes);
  };

  // Get vote context (question and result) for the selected chamber
  const getVoteContext = () => {
    if (selectedChamber === 'all') {
      // For all chambers, use the first available vote question
      const firstRecord = votingData.votingRecords[0];
      return firstRecord ? {
        voteQuestion: firstRecord.voteQuestion,
        result: firstRecord.result
      } : undefined;
    }
    const chamberRecords = votingData.recordsByChamber[selectedChamber] || [];
    const firstRecord = chamberRecords[0];
    return firstRecord ? {
      voteQuestion: firstRecord.voteQuestion,
      result: firstRecord.result
    } : undefined;
  };

  const displayVotes = getVotesForDisplay();
  const voteContext = getVoteContext();

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 my-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 md:mb-0">Bill Voting Positions</h2>

        {votingData.chambers.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChamber('all')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedChamber === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All Chambers
            </button>
            {votingData.chambers.map(chamber => (
              <button
                key={chamber}
                onClick={() => setSelectedChamber(chamber)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedChamber === chamber
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {chamber}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {displayVotes.length} votes
          {selectedChamber !== 'all' && ` from ${selectedChamber}`}
          {votingData.chambers.length > 1 && selectedChamber === 'all' && ` from ${votingData.chambers.length} chambers`}
        </div>
        {voteContext?.voteQuestion && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100">Vote Question:</div>
            <div className="text-sm text-blue-800 dark:text-blue-200 mt-1">{voteContext.voteQuestion}</div>
            {voteContext.result && (
              <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Result: {voteContext.result}</div>
            )}
          </div>
        )}
      </div>

      <ParliamentChart 
        votes={displayVotes} 
        chamber={selectedChamber} 
      />
    </div>
  );
};

export default VotingBillPositions;
