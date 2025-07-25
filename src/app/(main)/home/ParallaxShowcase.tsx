"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Landmark, User, MessageCircle } from 'lucide-react';

const mockLegislation = [
  { id: '1', title: 'CA AB123: Clean Energy Act', summary: 'Mandates 100% renewable energy by 2045.', link: '/legislation/ca-ab123' },
  { id: '2', title: 'NY SB456: Affordable Housing', summary: 'Expands affordable housing programs.', link: '/legislation/ny-sb456' },
  { id: '3', title: 'TX HB789: Education Reform', summary: 'Increases teacher salaries and funding.', link: '/legislation/tx-hb789' },
];

const mockPosts = [
  { id: '1', author: 'Jane Doe', content: 'Excited to see new climate legislation in CA!', link: '/posts/1' },
  { id: '2', author: 'Alex Smith', content: 'Affordable housing is a game changer for NY.', link: '/posts/2' },
  { id: '3', author: 'Sam Lee', content: 'Education reform is long overdue in Texas.', link: '/posts/3' },
];

const mockReps = [
  { id: '1', name: 'Rep. Maria Garcia', state: 'CA', link: '/representatives/1' },
  { id: '2', name: 'Sen. John Kim', state: 'NY', link: '/representatives/2' },
  { id: '3', name: 'Rep. Lisa Patel', state: 'TX', link: '/representatives/3' },
];

const allCards = [
  ...mockLegislation.map(l => ({ type: 'legislation', ...l })),
  ...mockPosts.map(p => ({ type: 'post', ...p })),
  ...mockReps.map(r => ({ type: 'rep', ...r })),
];

function getCard(card: any) {
  switch (card.type) {
    case 'legislation':
      return (
        <Card className="w-80 min-w-80 mx-2 bg-card/90 shadow-lg hover:shadow-xl transition-transform hover:-translate-y-1 border-primary border-opacity-20 border">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Landmark className="h-6 w-6 text-primary" />
            <CardTitle className="text-lg font-semibold truncate">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-2 line-clamp-2">{card.summary}</p>
            <Link href={card.link} className="text-primary font-medium flex items-center gap-1 hover:underline">
              View Bill <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      );
    case 'post':
      return (
        <Card className="w-80 min-w-80 mx-2 bg-card/90 shadow-lg hover:shadow-xl transition-transform hover:-translate-y-1 border-secondary border-opacity-20 border">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <MessageCircle className="h-6 w-6 text-secondary" />
            <CardTitle className="text-lg font-semibold truncate">Community Post</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-2 line-clamp-2">"{card.content}"</p>
            <span className="text-xs text-secondary-foreground">by {card.author}</span>
            <br />
            <Link href={card.link} className="text-secondary font-medium flex items-center gap-1 hover:underline">
              View Post <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      );
    case 'rep':
      return (
        <Card className="w-80 min-w-80 mx-2 bg-card/90 shadow-lg hover:shadow-xl transition-transform hover:-translate-y-1 border-accent border-opacity-20 border">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <User className="h-6 w-6 text-accent" />
            <CardTitle className="text-lg font-semibold truncate">{card.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-2">State: {card.state}</p>
            <Link href={card.link} className="text-accent font-medium flex items-center gap-1 hover:underline">
              View Profile <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      );
    default:
      return null;
  }
}

export default function ParallaxShowcase() {
  // Duplicate cards for seamless vertical loop
  const legislationCards = [...mockLegislation, ...mockLegislation];
  const postCards = [...mockPosts, ...mockPosts];
  const repCards = [...mockReps, ...mockReps];

  return (
    <div className="relative w-full overflow-x-hidden py-12 bg-gradient-to-b from-background/80 to-muted/60">
      <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center tracking-tight">See What’s Happening</h2>
      <div className="w-full flex flex-col md:flex-row items-stretch justify-center gap-8 max-w-6xl mx-auto">
        {/* Legislation Column */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative h-96 w-full overflow-hidden">
            <div className="absolute left-0 top-0 w-full animate-marquee-vert flex flex-col">
              {legislationCards.map((card, i) => (
                <div key={i} className="mb-4 flex justify-center">
                  {getCard({ type: 'legislation', ...card })}
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-2 font-semibold text-primary">Recent Legislation</div>
        </div>
        {/* Posts Column */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative h-96 w-full overflow-hidden">
            <div className="absolute left-0 top-0 w-full animate-marquee-vert-reverse flex flex-col">
              {postCards.map((card, i) => (
                <div key={i} className="mb-4 flex justify-center">
                  {getCard({ type: 'post', ...card })}
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-2 font-semibold text-secondary">Community Posts</div>
        </div>
        {/* Representatives Column */}
        <div className="flex-1 flex flex-col items-center">
          <div className="relative h-96 w-full overflow-hidden">
            <div className="absolute left-0 top-0 w-full animate-marquee-vert flex flex-col">
              {repCards.map((card, i) => (
                <div key={i} className="mb-4 flex justify-center">
                  {getCard({ type: 'rep', ...card })}
                </div>
              ))}
            </div>
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
          animation: marquee-vert 24s linear infinite;
        }
        .animate-marquee-vert-reverse {
          animation: marquee-vert-reverse 28s linear infinite;
        }
      `}</style>
    </div>
  );
}
