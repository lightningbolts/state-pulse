import Link from 'next/link';
import { BellRing, LayoutDashboard, MapPin, Vote } from 'lucide-react';
import { Panel, PanelBody } from '@/components/layout/Panel';

const FEATURES = [
  {
    title: 'Interactive Dashboard',
    icon: LayoutDashboard,
    description:
      'Explore legislation activity on a live map. Click any state to see recent bills, key topics, and how your jurisdiction compares to others.',
    href: '/dashboard',
  },
  {
    title: 'Representative Connect',
    icon: MapPin,
    description:
      'Find the officials who represent your address or district, then follow them in one place. Open voting records, committee assignments, and contact channels.',
    href: '/representatives',
  },
  {
    title: 'Personalized Civic Alerts',
    icon: BellRing,
    description:
      'Subscribe to the issues, keywords, and bill stages that matter to you. When legislation moves in your districts, you get timely notifications.',
    href: '/tracker',
  },
  {
    title: 'Interactive Voting Resources',
    icon: Vote,
    description:
      'Compare where candidates stand on the themes you care about, with links to sources and context. See historical election outcomes where available.',
    href: '/civic',
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Browse or search',
    description: 'Start on the dashboard map or legislation feed. Filter by state, topic, status, or chamber to find bills that matter to you.',
  },
  {
    step: '2',
    title: 'Understand quickly',
    description: 'Every bill includes a plain-English summary, sponsor info, and status history so you do not have to parse statutory language on your own.',
  },
  {
    step: '3',
    title: 'Track and act',
    description: 'Bookmark bills, set up alerts, find your representatives, and follow legislation as it moves through committees and votes.',
  },
] as const;

const COMPARISONS = [
  {
    title: 'vs. government websites',
    description: 'Official portals are accurate but scattered across 50+ sites with inconsistent formats. StatePulse pulls it together in one searchable place with summaries and tracking.',
  },
  {
    title: 'vs. spreadsheets and manual tracking',
    description: 'Spreadsheets go stale the moment a bill moves. StatePulse updates from live data sources and notifies you when something changes.',
  },
  {
    title: 'vs. national news coverage',
    description: 'Most outlets focus on Congress and headline issues. StatePulse covers state and local legislation that directly affects your schools, taxes, and community.',
  },
] as const;

export function HomeFeatures() {
  return (
    <>
      <Panel title="Stay civically informed">
        <PanelBody>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            State and local governments make thousands of decisions every year that directly impact your life—from education funding and healthcare policies to transportation infrastructure and environmental regulations. Most of those decisions never make national headlines, but they shape your community every day.
          </p>
        </PanelBody>
      </Panel>

      <section className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.href}
              href={feature.href}
              prefetch
              className="group border border-border bg-surface p-6 transition-colors hover:bg-hover"
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-medium group-hover:text-primary">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <Panel title="How it works">
        <PanelBody>
          <div className="grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="border border-border bg-surface-elevated p-4">
                <span className="inline-flex h-7 w-7 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-3 font-medium">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <Panel title="Why not just use a spreadsheet?">
        <PanelBody>
          <div className="grid gap-4 md:grid-cols-3">
            {COMPARISONS.map((item) => (
              <div key={item.title} className="space-y-2">
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      <Panel title="What makes StatePulse different">
        <PanelBody className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            StatePulse is built for people who want to follow legislation without becoming policy analysts. You get live data from official sources, readable summaries on every bill, a map to see activity by jurisdiction, and tools to track what you care about over time.
          </p>
          <p>
            Unlike static trackers that dump raw bill text at you, StatePulse connects the pieces: who sponsored it, where it is in the process, what it would actually change, and who represents you if you want to weigh in.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
