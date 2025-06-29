import { getLegislationById, type Legislation } from '@/services/legislationService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CalendarDays, FileText, Tag, Info } from 'lucide-react';
import Link from 'next/link';
import { CollapsibleSponsors } from '@/components/features/CollapsibleSponsors';
import { CollapsibleTimeline } from '@/components/features/CollapsibleTimeline';
import { BookmarkButton } from '@/components/features/BookmarkButton';

export default async function LegislationDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  // console.log(params, "Params in LegislationDetailPage");
  const legislation = await getLegislationById(id);

  if (!legislation) {
    return (
      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive">Legislation Not Found</CardTitle>
          <CardDescription>
            The legislation with ID <Badge variant="outline">{id}</Badge> could not be found.
            It might have been removed or the ID is incorrect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/legislation" className="text-primary hover:underline flex items-center">
            <ExternalLink className="mr-2 h-4 w-4" /> Go back to legislation search
          </Link>
        </CardContent>
      </Card>
    );
  }

  const {
    identifier,
    title,
    session,
    jurisdictionName,
    chamber,
    classification,
    subjects,
    statusText,
    sponsors,
    history,
    versions,
    sources,
    abstracts,
    openstatesUrl,
    firstActionAt,
    latestActionAt,
    latestActionDescription,
    geminiSummary,
  } = legislation;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="w-full max-w-4xl mx-auto shadow-xl rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-700 text-primary-foreground p-6">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">{identifier}: {title}</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-sm mt-1">
                {session} - {jurisdictionName} {chamber && `(${chamber})`}
              </CardDescription>
            </div>
            <BookmarkButton legislationId={id} className="ml-4 flex-shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Info className="mr-2 h-5 w-5 text-primary" /> Key Details
              </h3>
              {statusText && <div><Badge variant="secondary" className="text-sm">{statusText}</Badge></div>}
              {classification && classification.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Type: {classification.map(c => <Badge key={c} variant="outline" className="mr-1">{c}</Badge>)}
                </div>
              )}
              {firstActionAt && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <CalendarDays className="mr-2 h-4 w-4" /> First Action: {firstActionAt.toLocaleDateString()}
                </p>
              )}
              {latestActionAt && (
                <p className="text-sm text-muted-foreground flex items-center">
                  <CalendarDays className="mr-2 h-4 w-4" /> Latest Action: {latestActionAt.toLocaleDateString()}
                </p>
              )}
              {latestActionDescription && <p className="text-sm text-muted-foreground">Latest Action Detail: {latestActionDescription}</p>}
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Tag className="mr-2 h-5 w-5 text-primary" /> Subjects
              </h3>
              {subjects && subjects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subjects.map(subject => <Badge key={subject} variant="default">{subject}</Badge>)}
                </div>
              )}
              {(!subjects || subjects.length === 0) && (
                <p className="text-sm text-muted-foreground">No subjects available.</p>
              )}
            </div>
          </div>

          {openstatesUrl && (
            <div className="mt-4">
              <Link href={openstatesUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm">
                <ExternalLink className="mr-2 h-4 w-4" /> View on OpenStates
              </Link>
            </div>
          )}

          {/* Sponsors Section with Collapsible Functionality */}
          <CollapsibleSponsors sponsors={sponsors} />

          {abstracts && abstracts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
                <FileText className="mr-2 h-6 w-6 text-primary" /> Abstracts
              </h3>
              {abstracts.map((abstract, index) => (
                <div key={index} className="p-3 border rounded-md bg-muted/50 mb-2">
                  <p className="text-sm text-foreground">{abstract.abstract}</p>
                  {abstract.note && <p className="text-xs text-muted-foreground mt-1">Note: {abstract.note}</p>}
                </div>
              ))}
            </div>
          )}

          {geminiSummary && (
            <div className="mt-6 p-4 border border-primary/30 rounded-lg bg-primary/5">
              <h3 className="text-xl font-semibold text-primary mb-3">AI Generated Summary</h3>
              <p className="text-sm text-muted-foreground italic">{geminiSummary}</p>
            </div>
          )}

          {versions && versions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
                <FileText className="mr-2 h-6 w-6 text-primary" /> Versions & Documents
              </h3>
              <ul className="space-y-2">
                {versions.map((version, index) => (
                  <li key={index} className="p-3 border rounded-md bg-muted/50">
                    <p className="font-medium text-foreground">{version.note}</p>
                    {version.date && <p className="text-xs text-muted-foreground">Date: {version.date.toLocaleDateString()}</p>}
                    {version.links && version.links.map((link: { url: string; media_type?: string | null }) => (
                      <Link key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm block mt-1">
                        <ExternalLink className="inline-block mr-1 h-3 w-3" /> {link.media_type || 'View Document'}
                      </Link>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sources && sources.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
                <ExternalLink className="mr-2 h-6 w-6 text-primary" /> Sources
              </h3>
              <ul className="space-y-1">
                {sources.map((source, index) => (
                  <li key={index}>
                    <Link href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                      {source.note || source.url}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <CollapsibleTimeline historyEvents={history} />
        </CardContent>
      </Card>
    </div>
  );
}