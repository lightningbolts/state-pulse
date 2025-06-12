import { getLegislationById, type Legislation } from '@/services/legislationService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CalendarDays, Users, FileText, Tag, Info, ListChecks } from 'lucide-react';
import Link from 'next/link';

// Placeholder for a more sophisticated timeline component
const LegislationTimeline = ({ historyEvents }: { historyEvents: Legislation['history'] }) => {
  if (!historyEvents || historyEvents.length === 0) {
    return <p className="text-muted-foreground">No history events available for this legislation.</p>;
  }
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground mb-2">Timeline</h3>
      <ul className="list-none p-0 space-y-3">
        {historyEvents.map((event, index) => (
          <li key={index} className="border-l-2 border-primary pl-4 py-2 bg-card rounded-md shadow-sm">
            <p className="font-medium text-primary-foreground bg-primary px-2 py-1 rounded-t-md text-sm">
              {event.date ? new Date(event.date).toLocaleDateString() : 'Date N/A'} - {event.actor || 'Unknown Actor'}
            </p>
            <div className="p-2">
              <p className="text-sm text-foreground">{event.action}</p>
              {event.details && <p className="text-xs text-muted-foreground mt-1">Details: {event.details}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default async function LegislationDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const legislation = await getLegislationById(id);
  if (!legislation) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The requested legislation could not be found.</p>
          <Link href="/legislation" className="text-primary hover:underline mt-4 block">
            Back to legislation list
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex justify-between items-start">
            <div>
              <Badge variant="secondary" className="mb-2">{legislation.jurisdictionName || 'N/A'}</Badge>
              <CardTitle className="text-3xl font-bold text-primary mb-1">{legislation.title || 'No Title Available'}</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">{legislation.identifier || 'No Bill Number'}</CardDescription>
            </div>
            {legislation.openstatesUrl && (
              <a
                href={legislation.openstatesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
                title="View on OpenStates.org"
              >
                OpenStates.org <ExternalLink className="ml-1.5 h-4 w-4" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center"><Info className="mr-2 h-5 w-5 text-primary" />Details</h3>
              <p><strong className="font-medium">Status:</strong> {legislation.statusText || 'N/A'}</p>
              <p><strong className="font-medium">Session:</strong> {legislation.session || 'N/A'}</p>
              <p><strong className="font-medium">Chamber:</strong> {legislation.chamber || 'N/A'}</p>
              {legislation.classification && legislation.classification.length > 0 && (
                <p><strong className="font-medium">Type:</strong> {legislation.classification.join(', ')}</p>
              )}
            </div>
            <div className="space-y-3">
               <h3 className="text-lg font-semibold text-foreground flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary" />Key Dates</h3>
              <p>
                <strong className="font-medium">Introduced:</strong>
                {legislation.firstActionAt ? new Date(legislation.firstActionAt).toLocaleDateString() : ' N/A'}
              </p>
              <p>
                <strong className="font-medium">Last Action:</strong>
                {legislation.latestActionAt ? new Date(legislation.latestActionAt).toLocaleDateString() : ' N/A'}
              </p>
              {legislation.latestActionDescription && (
                <p><strong className="font-medium">Last Action Desc:</strong> {legislation.latestActionDescription}</p>
              )}
            </div>
          </div>

          {legislation.summary && (
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2"><FileText className="mr-2 h-5 w-5 text-primary" />Summary</h3>
              <p className="text-muted-foreground leading-relaxed bg-muted/50 p-4 rounded-md">{legislation.summary}</p>
            </div>
          )}

          {legislation.sponsors && legislation.sponsors.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2"><Users className="mr-2 h-5 w-5 text-primary" />Sponsors</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                {legislation.sponsors.map((sponsor, index) => (
                  <li key={index}>{sponsor.name} {sponsor.primary ? <Badge variant="outline" className="ml-1">Primary</Badge> : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {legislation.subjects && legislation.subjects.length > 0 && (
             <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2"><Tag className="mr-2 h-5 w-5 text-primary" />Subjects</h3>
              <div className="flex flex-wrap gap-2">
                {legislation.subjects.map((subject, index) => (
                  <Badge key={index} variant="secondary">{subject}</Badge>
                ))}
              </div>
            </div>
          )}

          {legislation.versions && legislation.versions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2"><ListChecks className="mr-2 h-5 w-5 text-primary" />Versions</h3>
              <ul className="space-y-2">
                {legislation.versions.map((version, index) => (
                  <li key={index} className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/20">
                    <span className="font-medium text-foreground">{version.name || 'Unnamed Version'}</span>
                    {version.date && ` - ${new Date(version.date).toLocaleDateString()}`}
                    {version.url && (
                       <a href={version.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">
                         View Document <ExternalLink className="inline h-3 w-3" />
                       </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <LegislationTimeline historyEvents={legislation.history} />

        </CardContent>
      </Card>
    </div>
  );
}