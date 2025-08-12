'use client';

import {useState} from 'react';
import {ChevronDown, ChevronUp, Users} from 'lucide-react';
import {Legislation} from '@/types/legislation';
import {AnimatedSection} from '@/components/ui/AnimatedSection';
import Link from 'next/link';

interface CollapsibleSponsorsProps {
    sponsors: Legislation['sponsors'];
}

export function CollapsibleSponsors({sponsors}: CollapsibleSponsorsProps) {
    const [sponsorsOpen, setSponsorsOpen] = useState(false);

    if (!sponsors || sponsors.length === 0) {
        return null;
    }

    return (
        <div className="mt-6">
            <button
                onClick={() => setSponsorsOpen(!sponsorsOpen)}
                className="flex justify-between items-center w-full cursor-pointer hover:bg-muted/50 py-2 px-0 rounded-md transition-colors"
                aria-expanded={sponsorsOpen}
                aria-controls="sponsors-content"
            >
                <h3 className="text-xl font-semibold text-foreground flex items-center">
                    <Users className="mr-2 h-6 w-6 text-primary"/> Sponsors ({sponsors.length})
                </h3>
                {sponsorsOpen ? (
                    <ChevronUp className="h-5 w-5 text-primary"/>
                ) : (
                    <ChevronDown className="h-5 w-5 text-primary"/>
                )}
            </button>
            {sponsorsOpen && (
                <ul id="sponsors-content" className="space-y-2 mt-3">
                    {sponsors.map(sponsor => (
                        <AnimatedSection key={sponsor.id || sponsor.name}>
                            <li className="text-sm p-2 bg-muted/50 rounded-md">
                                {sponsor.id ? (
                                    <Link
                                        href={`/representatives/${
                                            sponsor.id.replace('/', '_')
                                        }`}
                                        className="text-primary hover:underline font-medium"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {sponsor.name}
                                    </Link>
                                ) : (
                                    sponsor.name
                                )} {" "}
                                ({sponsor.primary ? 'Primary' : 'Co-sponsor'}) - {sponsor.entityType}
                            </li>
                        </AnimatedSection>
                    ))}
                </ul>
            )}
        </div>
    );
}
