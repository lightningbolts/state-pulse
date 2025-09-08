"use client"
import React from 'react';
import { MemberVote } from '@/types/legislation';
import Link from 'next/link';

interface VoteCircleProps {
  vote: MemberVote;
  cx: number;
  cy: number;
  onMouseEnter: (e: React.MouseEvent<SVGCircleElement, MouseEvent>, vote: MemberVote) => void;
  onMouseLeave: () => void;
}

const VoteCircle: React.FC<VoteCircleProps> = ({ vote, cx, cy, onMouseEnter, onMouseLeave }) => {
  const getVoteColor = (vote: string) => {
    switch (vote) {
      case 'Yea':
      case 'Yes':
        return '#48bb78'; // green-500
      case 'Nay':
      case 'No':
        return '#f56565'; // red-500
      default:
        return '#a0aec0'; // gray-500
    }
  };

  return (
    <Link href={`/representatives/${vote.bioguideId}`} passHref>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={getVoteColor(vote.voteCast)}
        stroke="#fff"
        strokeWidth={1}
        onMouseEnter={(e) => onMouseEnter(e, vote)}
        onMouseLeave={onMouseLeave}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      />
    </Link>
  );
};

export default VoteCircle;
