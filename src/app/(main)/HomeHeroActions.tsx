"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

export function HomeHeroActions() {
  const { isSignedIn } = useUser();

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href={isSignedIn ? '/legislation' : '/sign-up'} prefetch>
          {isSignedIn ? 'Browse bills' : 'Get started'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/dashboard" prefetch>Open dashboard</Link>
      </Button>
    </div>
  );
}
