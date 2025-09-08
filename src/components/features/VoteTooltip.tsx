import React from 'react';
import { MemberVote } from '@/types/legislation';

interface VoteTooltipProps {
  vote: MemberVote;
  x: number;
  y: number;
}

const VoteTooltip: React.FC<VoteTooltipProps> = ({ vote, x, y }) => {
  return (
    <div
      style={{ top: y, left: x, position: 'fixed' }}
      className="bg-gray-900 text-white text-sm rounded-lg py-1 px-2 shadow-lg z-10 pointer-events-none"
    >
      <div>{`${vote.firstName} ${vote.lastName}`}</div>
      <div>{`(${vote.voteParty}-${vote.voteState})`}</div>
      <div>Vote: {vote.voteCast}</div>
    </div>
  );
};

export default VoteTooltip;
