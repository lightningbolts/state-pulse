import React from 'react';
import { ExecutiveOrder } from '@/types/executiveOrder';
import { Badge } from '../ui/badge';
import { ExternalLink, Calendar, User, MapPin } from 'lucide-react';

interface ExecutiveOrderCardProps {
  order: ExecutiveOrder;
}

export function ExecutiveOrderCard({ order }: ExecutiveOrderCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(date));
  };

  const getSourceBadgeColor = (sourceType: string) => {
    return sourceType === 'federal_register' || sourceType === 'whitehouse_website' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className="mb-4 p-4 border rounded-lg bg-background transition hover:bg-accent/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary h-full relative">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start gap-4 mb-3">
          <h3 className="font-bold text-lg leading-tight">
            {order.title}
          </h3>
          <Badge
            variant="secondary"
            className={getSourceBadgeColor(order.source_type)}
          >
            {order.source_type === 'federal_register' || order.source_type === 'whitehouse_website' ? 'Federal' : 'State'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
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

        {/* AI Summary */}
        {order.geminiSummary && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">AI Summary</h4>
            <p className="text-sm text-foreground leading-relaxed">
              {order.geminiSummary}
            </p>
          </div>
        )}

        {/* Original Summary (if different from AI) */}
        {order.summary && order.summary !== order.geminiSummary && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Official Summary</h4>
            <p className="text-sm text-foreground leading-relaxed">
              {order.summary}
            </p>
          </div>
        )}

        {/* Topics */}
        {order.topics && order.topics.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-muted-foreground mb-2">Topics</h4>
            <div className="flex flex-wrap gap-1">
              {order.topics.map((topic, index) => (
                <Badge key={index} variant="secondary" className="text-xs capitalize">
                  {topic.replace(/-/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
            Added {formatDate(order.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
