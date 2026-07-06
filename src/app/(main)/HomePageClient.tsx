"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, Landmark, Newspaper } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import { DataCard } from '@/components/layout/DataCard';
import { Panel, PanelBody } from '@/components/layout/Panel';
import type { HomepageExamples, HomepageStats } from '@/lib/homepage';
import StatisticsShowcase from './StatisticsShowcase';
import ImportanceShowcase from './ImportanceShowcase';

const ExamplesShowcase = dynamic(() => import('./ExamplesShowcase'), { ssr: false });

const FEATURES = [
  {
    icon: Newspaper,
    title: 'Quick Updates',
    description: 'Access the latest information on bills, resolutions, and policy changes as they happen.',
  },
  {
    icon: Landmark,
    title: 'Comprehensive Coverage',
    description: 'Track legislation across multiple states and jurisdictions from a single platform.',
  },
  {
    icon: BarChart3,
    title: 'Insightful Analytics',
    description: 'Understand trends and impacts with our data visualization tools.',
  },
];

interface HomePageClientProps {
  initialStats: HomepageStats | null;
  initialExamples: HomepageExamples;
}

export default function HomePageClient({ initialStats, initialExamples }: HomePageClientProps) {
  const { isSignedIn } = useUser();

  return (
    <div className="animate-content-in space-y-8">
      <section className="border border-border bg-surface-elevated p-8 text-center sm:p-12">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Civic Data Dashboard
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          StatePulse
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Fast legislative tracking and policy analysis across every state. Stay informed, take action.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!isSignedIn ? (
            <Button asChild size="lg">
              <Link href="/sign-up" prefetch>
                Join Us Today <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/tracker" prefetch>
                Jump Right Back In <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href="/about" prefetch>Who We Are</Link>
          </Button>
        </div>
      </section>

      {initialStats ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DataCard label="Total Bills" value={initialStats.legislation.total.toLocaleString()} />
          <DataCard label="Active Bills" value={initialStats.legislation.active.toLocaleString()} />
          <DataCard label="Representatives" value={initialStats.representatives.total.toLocaleString()} />
          <DataCard label="Jurisdictions" value={initialStats.jurisdictions.toLocaleString()} />
        </section>
      ) : null}

      <Panel title="Why StatePulse?">
        <PanelBody>
          <div className="grid gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="border border-border bg-surface p-4">
                <Icon className="mb-3 h-6 w-6 text-primary" />
                <h3 className="font-medium text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <StatisticsShowcase initialStats={initialStats} />
      <ExamplesShowcase initialExamples={initialExamples} />
      <ImportanceShowcase />

      <section className="border border-border bg-panel p-8 text-center">
        <h2 className="text-2xl font-semibold">Ready to Dive In?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Start exploring legislation now or sign up for personalized alerts and features.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!isSignedIn ? (
            <Button asChild size="lg">
              <Link href="/sign-up" prefetch>Create a Free Account</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/posts" prefetch>View Community Posts</Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard" prefetch>View Dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
