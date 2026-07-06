import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelBody } from '@/components/layout/Panel';

const learnCards = [
  {
    href: '/learn/legislation',
    title: 'What is Legislation?',
    desc: 'How laws are made, types of legislation, and the journey from idea to law.',
  },
  {
    href: '/learn/chambers',
    title: 'How Chambers Work',
    desc: 'Understand the House, Senate, and state legislatures—roles, structure, and process.',
  },
  {
    href: '/learn/faq',
    title: 'FAQ',
    desc: 'Answers to common questions about StatePulse and the legislative process.',
  },
];

export default function LearnLandingPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Learn"
        subtitle="Demystify the legislative process. Explore how laws are made, how government chambers work, and get answers to your questions—all in one place."
      />
      <Panel>
        <PanelBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {learnCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                prefetch
                className="group border border-border bg-surface p-6 transition-colors hover:bg-hover"
              >
                <h2 className="font-medium group-hover:text-primary">{card.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{card.desc}</p>
                <span className="mt-4 inline-block text-xs font-medium text-primary">Explore →</span>
              </Link>
            ))}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
