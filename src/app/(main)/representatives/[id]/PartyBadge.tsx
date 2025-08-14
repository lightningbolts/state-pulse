"use client";

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface PartyBadgeProps {
  party: string;
}

export function PartyBadge({ party }: PartyBadgeProps) {
  const [partyHover, setPartyHover] = useState(false);

  return (
    <Badge
      className="text-white border-black text-base font-semibold px-4 py-1 mt-2 sm:mt-0 sm:ml-4 whitespace-nowrap mx-auto sm:mx-0"
      style={{
        minWidth: 64,
        textAlign: 'center',
        backgroundColor: partyHover
          ? party.toLowerCase().includes('republican')
            ? '#C81E1E' // Red
            : party.toLowerCase().includes('democrat')
              ? '#1e96ffff' // Blue
              : '#222' // Default dark
          : '#000',
        borderColor: '#000',
      }}
      onMouseEnter={() => setPartyHover(true)}
      onMouseLeave={() => setPartyHover(false)}
    >
      {party}
    </Badge>
  );
}
