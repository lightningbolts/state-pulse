"use client";

import React from "react";
import Link from "next/link";

import PolicyUpdateCard from '@/components/features/PolicyUpdateCard';
import { PostCard } from '@/components/features/PostCard';
import RepresentativeCard from '@/components/features/RepresentativeCard';


import { useEffect, useState } from 'react';
import type { Legislation } from '@/types/legislation';
import type { Post } from '@/types/media';
import type { Representative } from '@/types/representative';

function useRecentData<T>(url: string, key: string): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((json) => setData(json[key] || json))
      .catch((e) => setError(e.message || 'Error fetching data'))
      .finally(() => setLoading(false));
  }, [url, key]);
  return { data, loading, error };
}


// Minimal state for PolicyUpdateCard (legislation)
const emptyFn = () => {};
const emptyArr: any[] = [];
const emptyRef = { current: 0 };
function truncate(str: string | undefined, n = 100) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '...' : str;
}

function getCard(card: any, idx: number, type: 'legislation' | 'post' | 'rep', updatesArr?: any[]) {
  switch (type) {
    case 'legislation': {
      // Truncate title, summary, geminiSummary
      const update = {
        ...card,
        title: truncate(card.title, 100),
        summary: truncate(card.summary, 100),
        geminiSummary: truncate(card.geminiSummary, 100),
      };
      return (
        <div className="w-80 min-w-80 mx-2 rounded-xl overflow-hidden">
          <PolicyUpdateCard
            update={update}
            idx={idx}
            updates={updatesArr || []}
            classification={card.classification?.[0] || ''}
            subject={card.subjects?.[0] || ''}
            setClassification={emptyFn}
            setSubject={emptyFn}
            setUpdates={emptyFn}
            setSkip={emptyFn}
            skipRef={emptyRef as React.MutableRefObject<number>}
            setHasMore={emptyFn}
            setLoading={emptyFn}
          />
        </div>
      );
    }
    case 'post': {
      // Truncate title/content
      const post = {
        ...card,
        title: truncate(card.title, 100),
        content: truncate(card.content, 100),
      };
      return (
        <div className="w-80 min-w-80 mx-2 rounded-xl overflow-hidden">
          <PostCard post={post} />
        </div>
      );
    }
    case 'rep':
      return (
        <div className="w-80 min-w-80 mx-2 rounded-xl overflow-hidden">
          <RepresentativeCard rep={card} />
        </div>
      );
    default:
      return null;
  }
}


export default function ParallaxShowcase() {
  // Fetch real data
  const { data: legislation, loading: loadingLeg, error: errorLeg } = useRecentData<Legislation>(
    '/api/legislation?limit=100&sortBy=updatedAt&sortDir=desc', 'legislations'
  );
  const { data: posts, loading: loadingPosts, error: errorPosts } = useRecentData<Post>(
    '/api/posts?limit=100', 'posts'
  );
  const { data: reps, loading: loadingReps, error: errorReps } = useRecentData<Representative>(
    '/api/representatives?pageSize=100&sortBy=name', 'representatives'
  );

  // Duplicate for seamless loop
  const legislationCards = [...legislation, ...legislation];
  const postCards = [...posts, ...posts];
  const repCards = [...reps, ...reps];

  // Animation speed: px/sec
  const CARD_HEIGHT = 336; // 320px card + 16px margin (mb-4)
  const SPEED = 40; // px/sec, adjust for desired scroll speed

  // Calculate duration based on total scroll distance (half the column)
  const getDuration = (cards: any[]) => {
    const totalHeight = cards.length * CARD_HEIGHT;
    return totalHeight / SPEED;
  };

  const legislationDuration = getDuration(legislationCards);
  const postDuration = getDuration(postCards);
  const repDuration = getDuration(repCards);

  return (
    <div className="relative w-full overflow-x-hidden py-12 bg-gradient-to-b from-background/80 to-muted/60 rounded-md overflow-hidden">
      <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center tracking-tight">See What’s Happening</h2>
      <div className="w-full flex flex-col md:flex-row items-stretch justify-center gap-8 max-w-6xl mx-auto">
        {/* Legislation Column */}
        <div className="flex-1 flex flex-col items-center rounded-xl overflow-hidden">
          <div className="relative h-96 w-full overflow-hidden">
            {loadingLeg ? (
              <div className="flex items-center justify-center h-full">Loading...</div>
            ) : errorLeg ? (
              <div className="text-red-500 text-center">{errorLeg}</div>
            ) : (
              <div
                className="absolute left-0 top-0 w-full animate-marquee-vert flex flex-col"
                style={{ animationDuration: `${legislationDuration}s` }}
              >
                {legislationCards.map((card, i) => (
                  <div key={i} className="mb-4 flex justify-center">
                    {getCard(card, i, 'legislation', legislation)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-center mt-2 font-semibold text-primary">Recent Legislation</div>
        </div>
        {/* Posts Column */}
        <div className="flex-1 flex flex-col items-center rounded-xl overflow-hidden">
          <div className="relative h-96 w-full overflow-hidden">
            {loadingPosts ? (
              <div className="flex items-center justify-center h-full">Loading...</div>
            ) : errorPosts ? (
              <div className="text-red-500 text-center">{errorPosts}</div>
            ) : (
              <div
                className="absolute left-0 top-0 w-full animate-marquee-vert-reverse flex flex-col"
                style={{ animationDuration: `${postDuration}s` }}
              >
                {postCards.map((card, i) => (
                  <div key={i} className="mb-4 flex justify-center">
                    {getCard(card, i, 'post')}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-center mt-2 font-semibold text-secondary">Community Posts</div>
        </div>
        {/* Representatives Column */}
        <div className="flex-1 flex flex-col items-center rounded-xl overflow-hidden">
          <div className="relative h-96 w-full overflow-hidden">
            {loadingReps ? (
              <div className="flex items-center justify-center h-full">Loading...</div>
            ) : errorReps ? (
              <div className="text-red-500 text-center">{errorReps}</div>
            ) : (
              <div
                className="absolute left-0 top-0 w-full animate-marquee-vert flex flex-col"
                style={{ animationDuration: `${repDuration}s` }}
              >
                {repCards.map((card, i) => (
                  <div key={i} className="mb-4 flex justify-center">
                    {getCard(card, i, 'rep')}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-center mt-2 font-semibold text-accent">Representatives</div>
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee-vert {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes marquee-vert-reverse {
          0% { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
        .animate-marquee-vert {
          animation-name: marquee-vert;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .animate-marquee-vert-reverse {
          animation-name: marquee-vert-reverse;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
