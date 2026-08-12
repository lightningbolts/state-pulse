import React from 'react';
import { ExecutiveOrder } from '@/types/executiveOrder';
import { Badge } from '../ui/badge';
import { ExternalLink, Calendar, User, MapPin } from 'lucide-react';
import { AnimatedSection } from '../ui/AnimatedSection';
import { STATE_MAP } from '@/types/geo';

interface ExecutiveOrderCardProps {
  order: ExecutiveOrder;
  compact?: boolean;
  onTopicClick?: (topic: string) => void;
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

function formatShortDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function isFederal(sourceType: ExecutiveOrder['source_type']) {
  return sourceType === 'federal_register' || sourceType === 'whitehouse_website';
}

function jurisdictionAbbr(state: string) {
  if (state === 'United States') return 'US';
  return STATE_MAP[state] || state.substring(0, 2).toUpperCase();
}

function formatTopic(topic: string) {
  return topic.replace(/-/g, ' ');
}

export function ExecutiveOrderCard({ order, compact = false, onTopicClick }: ExecutiveOrderCardProps) {
  const federal = isFederal(order.source_type);

  if (compact) {
    return (
      <AnimatedSection>
        <a
          href={order.full_text_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 border rounded-md bg-background transition hover:bg-accent/50 hover:border-primary/30 text-sm h-full flex flex-col"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm leading-tight mb-1 line-clamp-2">
                {order.number ? `#${order.number} — ${order.title}` : order.title}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                  {jurisdictionAbbr(order.state)}
                </span>
                <span className="capitalize font-medium">{federal ? 'Federal' : 'State'}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 flex-1">
            <div>Signed: {formatShortDate(order.date_signed)}</div>
            <div className="truncate">By: {order.governor_or_president}</div>
          </div>

          {order.topics && order.topics.length > 0 && (
            <div className="mt-auto pt-2 flex flex-wrap gap-1">
              {order.topics.slice(0, 2).map((topic, i) => (
                <span
                  key={topic + i}
                  className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-medium capitalize"
                >
                  #{formatTopic(topic)}
                </span>
              ))}
              {order.topics.length > 2 && (
                <span className="text-xs text-muted-foreground font-medium">
                  +{order.topics.length - 2}
                </span>
              )}
            </div>
          )}
        </a>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <div className="mb-0 p-4 border rounded-lg bg-background transition hover:bg-accent/50 h-full relative flex flex-col">
        <div className="flex justify-between items-start gap-4 mb-3">
          <h3 className="font-bold text-lg leading-tight line-clamp-3">
            {order.title}
          </h3>
          <Badge
            variant="secondary"
            className={
              federal
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 shrink-0'
                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 shrink-0'
            }
          >
            {federal ? 'Federal' : 'State'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{order.governor_or_president}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{order.state}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(order.date_signed)}</span>
          </div>
          {order.number && (
            <Badge variant="outline" className="font-mono text-xs">
              #{order.number}
            </Badge>
          )}
        </div>

        {order.geminiSummary && (
          <div className="mb-4 flex-1">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">AI Summary</h4>
            <p className="text-sm text-foreground leading-relaxed line-clamp-5">
              {order.geminiSummary}
            </p>
          </div>
        )}

        {!order.geminiSummary && order.summary && (
          <div className="mb-4 flex-1">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Summary</h4>
            <p className="text-sm text-foreground leading-relaxed line-clamp-5">
              {order.summary}
            </p>
          </div>
        )}

        {order.topics && order.topics.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Topics</h4>
            <div className="flex flex-wrap gap-1">
              {order.topics.map((topic, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={`text-xs capitalize ${onTopicClick ? 'cursor-pointer' : ''}`}
                  onClick={(e) => {
                    if (!onTopicClick) return;
                    e.preventDefault();
                    onTopicClick(topic);
                  }}
                >
                  #{formatTopic(topic)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-4 border-t">
          <a
            href={order.full_text_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View Full Text
          </a>
          <span className="text-xs text-muted-foreground">
            Added {formatShortDate(order.createdAt)}
          </span>
        </div>
      </div>
    </AnimatedSection>
  );
}
