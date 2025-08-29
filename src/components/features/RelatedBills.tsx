import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CalendarDays, MapPin, Link2 } from 'lucide-react';
import Link from 'next/link';

interface RelatedBill {
  id: string;
  identifier: string;
  title: string;
  jurisdictionName: string;
  chamber?: string;
  latestActionAt?: Date;
  geminiSummary?: string;
  subjects?: string[];
  score: number;
}

interface RelatedBillsProps {
  relatedBills: RelatedBill[];
}

const formatDateUTC = (date: Date) => 
  date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    timeZone: 'UTC' 
  });

export function RelatedBills({ relatedBills }: RelatedBillsProps) {
  if (!relatedBills || relatedBills.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
        <Link2 className="mr-2 h-6 w-6 text-primary flex-shrink-0" /> Related Bills
      </h3>
      <div className="space-y-4">
        {relatedBills.map((bill, index) => (
          <div
            key={bill.id}
            className="p-4 border rounded-md bg-muted/50 hover:bg-muted/70 transition-colors"
          >
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/legislation/${bill.id}`}
                  className="text-primary hover:underline font-medium text-base leading-tight block break-words"
                >
                  {bill.identifier}: {bill.title}
                </Link>
                
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <MapPin className="mr-1 h-4 w-4 flex-shrink-0" />
                    <span>{bill.jurisdictionName}{bill.chamber && ` (${bill.chamber})`}</span>
                  </div>
                  
                  {bill.latestActionAt && (
                    <div className="flex items-center">
                      <CalendarDays className="mr-1 h-4 w-4 flex-shrink-0" />
                      <span>{formatDateUTC(new Date(bill.latestActionAt))}</span>
                    </div>
                  )}
                </div>

                {bill.subjects && bill.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {bill.subjects.slice(0, 3).map(subject => (
                      <Badge 
                        key={subject} 
                        variant="default" 
                        className="text-xs break-words"
                      >
                        {subject}
                      </Badge>
                    ))}
                    {bill.subjects.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{bill.subjects.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {bill.geminiSummary && (
                  <p className="text-sm text-muted-foreground mt-2 break-words">
                    {bill.geminiSummary.length > 150 
                      ? `${bill.geminiSummary.substring(0, 150)}...` 
                      : bill.geminiSummary
                    }
                  </p>
                )}
              </div>

              <div className="flex-shrink-0">
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                >
                  {Math.round(bill.score)}% match
                </Badge>
              </div>
            </div>
          </div>
        ))}

        {relatedBills.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No related bills found based on current criteria.
          </p>
        )}
      </div>
    </div>
  );
}
