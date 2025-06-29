'use client';

import { useState } from 'react';
import { ListChecks, ChevronDown, ChevronUp } from 'lucide-react';
import { type Legislation } from '@/services/legislationService';

interface CollapsibleTimelineProps {
  historyEvents: Legislation['history'];
}

export function CollapsibleTimeline({ historyEvents }: CollapsibleTimelineProps) {
  const [timelineOpen, setTimelineOpen] = useState(false);

  if (!historyEvents || historyEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mt-6">
      <button
        onClick={() => setTimelineOpen(!timelineOpen)}
        className="flex justify-between items-center w-full cursor-pointer hover:bg-muted/50 py-2 px-0 rounded-md transition-colors"
        aria-expanded={timelineOpen}
        aria-controls="timeline-content"
      >
        <h3 className="text-xl font-semibold text-foreground flex items-center">
          <ListChecks className="mr-2 h-6 w-6 text-primary" /> Timeline ({historyEvents.length} events)
        </h3>
        {timelineOpen ? (
          <ChevronUp className="h-5 w-5 text-primary" />
        ) : (
          <ChevronDown className="h-5 w-5 text-primary" />
        )}
      </button>

      {timelineOpen && (
        <div id="timeline-content">
          {historyEvents.length === 0 ? (
            <p className="text-muted-foreground">No history events available for this legislation.</p>
          ) : (
            <ul className="list-none p-0 m-0">
              {historyEvents.map((event, index) => {
                const isLast = index === historyEvents.length - 1;

                return (
                  <li key={index} className="relative pl-8 pb-8">
                    {/* Vertical Connector Line - now correctly spans the full height */}
                    {!isLast && (
                      <div className="absolute left-[11px] top-3 h-full w-0.5 bg-primary" />
                    )}

                    {/* Timeline Dot */}
                    <div className="absolute left-[6px] top-3 h-3 w-3 rounded-full bg-primary border-2 border-background" />

                    <div className="bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="font-medium text-primary-foreground bg-primary px-3 py-2 rounded-t-md text-sm flex justify-between items-center -m-4 mb-3">
                        <span>{event.date ? new Date(event.date).toLocaleDateString() : 'Date N/A'}</span>
                        <span className="text-xs opacity-90">{event.actor || 'Unknown Actor'}</span>
                      </div>
                      <p className="text-sm text-foreground m-0">{event.action}</p>
                      {event.details && <p className="text-xs text-muted-foreground mt-1 mb-0">Details: {event.details}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
