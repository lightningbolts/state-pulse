"use client"
import React, { useState } from 'react';
import ParliamentChart from './ParliamentChart';
import { Vote } from 'lucide-react';

interface VotingRecordResponse {
  votingRecords: any[];
  recordsByChamber: Record<string, any[]>;
  chambers: string[];
}

interface VotingBillPositionsProps {
  votingData: VotingRecordResponse;
}

const VotingBillPositions: React.FC<VotingBillPositionsProps> = ({ votingData }) => {
  // Default to showing all chambers if multiple exist, or the single chamber
  const [selectedChamber, setSelectedChamber] = useState<string>(
    votingData.chambers.length > 1 ? 'all' : votingData.chambers[0]
  );

  if (!votingData || !votingData.votingRecords || votingData.votingRecords.length === 0) {
    return null;
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
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
        <h3 className="text-xl font-semibold text-foreground mb-2 md:mb-0 flex items-center">
          <Vote className="mr-2 h-6 w-6 text-primary flex-shrink-0" /> Bill Voting Positions
        </h3>

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

      <div className="p-4 border rounded-md bg-muted/50">
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
    </div>
  );
};

export default VotingBillPositions;
