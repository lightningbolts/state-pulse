import React, { useState } from 'react';
import { MemberVote } from '@/types/legislation';
import VoteTooltip from './VoteTooltip';
import VoteCircle from './VoteCircle';

interface ParliamentChartProps {
  votes: MemberVote[];
}

const ParliamentChart: React.FC<ParliamentChartProps> = ({ votes }) => {
  const [tooltip, setTooltip] = useState<{ content: MemberVote; x: number; y: number } | null>(null);

  const voteCounts = votes.reduce((acc, vote) => {
    acc[vote.voteCast] = (acc[vote.voteCast] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalVotes = votes.length;
  const radius = 150;
  const numRows = 5;

  const renderCircles = () => {
    let circles: JSX.Element[] = [];
    let currentAngle = Math.PI;
    const angleStep = Math.PI / totalVotes;

    votes.forEach((vote, i) => {
      const row = Math.floor(i / (totalVotes / numRows));
      const r = radius - row * 25;
      const angle = currentAngle + (i % (totalVotes / numRows)) * angleStep * (numRows - row);

      const x = r * Math.cos(angle) + radius;
      const y = r * Math.sin(angle) + radius / 2;

      circles.push(
        <VoteCircle
          key={i}
          vote={vote}
          cx={x}
          cy={y}
          onMouseEnter={(e, v) => setTooltip({ content: v, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setTooltip(null)}
        />
      );
    });

    return circles;
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg width={radius * 2} height={radius} viewBox={`0 0 ${radius * 2} ${radius + 10}">
        {renderCircles()}
      </svg>
      {tooltip && <VoteTooltip vote={tooltip.content} x={tooltip.x} y={tooltip.y} />}
      <div className="flex justify-center space-x-4 mt-4">
        {Object.entries(voteCounts).map(([voteCast, count]) => (
          <div key={voteCast} className="flex items-center">
            <span className={`h-4 w-4 rounded-full mr-2 ${getVoteColor(voteCast)}`}></span>
            <span>{voteCast}: {count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function getVoteColor(vote: string) {
  switch (vote) {
    case 'Yea':
    case 'Yes':
      return 'bg-green-500';
    case 'Nay':
    case 'No':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

export default ParliamentChart;
