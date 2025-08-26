import React from 'react';
import { ExecutiveOrder } from '../../types/executiveOrder';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ExternalLink, Calendar, User, MapPin } from 'lucide-react';

interface ExecutiveOrdersListProps {
  orders: ExecutiveOrder[];
  loading?: boolean;
  error?: string;
}

export function ExecutiveOrdersList({ orders, loading, error }: ExecutiveOrdersListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="text-red-600 text-center">
            <p className="font-medium">Error loading executive orders</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <p className="font-medium">No executive orders found</p>
            <p className="text-sm mt-1">Try adjusting your search criteria</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <ExecutiveOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

interface ExecutiveOrderCardProps {
  order: ExecutiveOrder;
}

function ExecutiveOrderCard({ order }: ExecutiveOrderCardProps) {
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="text-lg leading-tight">
            {order.title}
          </CardTitle>
          <Badge
            variant="secondary"
            className={getSourceBadgeColor(order.source_type)}
          >
            {order.source_type === 'federal_register' || order.source_type === 'whitehouse_website' ? 'Federal' : 'State'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
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
      </CardHeader>

      <CardContent>
        {/* AI Summary */}
        {order.geminiSummary && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">AI Summary</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {order.geminiSummary}
            </p>
          </div>
        )}

        {/* Original Summary (if different from AI) */}
        {order.summary && order.summary !== order.geminiSummary && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Official Summary</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {order.summary}
            </p>
          </div>
        )}

        {/* Topics */}
        {order.topics && order.topics.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Topics</h4>
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
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View Full Text
          </a>

          <span className="text-xs text-gray-400">
            Added {formatDate(order.createdAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
