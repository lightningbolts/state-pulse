import { getLegislationById } from '@/services/legislationService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CalendarDays, FileText, Tag, Info } from 'lucide-react';
import Link from 'next/link';
import { CollapsibleSponsors } from '@/components/features/CollapsibleSponsors';
import { CollapsibleTimeline } from '@/components/features/CollapsibleTimeline';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import { BookmarkButton } from '@/components/features/BookmarkButton';
import { VotingPredictionSection } from '@/components/features/VotingPredictionSection';
import { generateLegislationMetadata } from '@/lib/metadata';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = await params;

  try {
    const legislation = await getLegislationById(id);
    if (!legislation) {
      return {
        title: 'Legislation Not Found | StatePulse',
        description: 'The requested legislation could not be found.',
      };
    }

    return generateLegislationMetadata(
      legislation.title || 'Unknown Bill',
      legislation.identifier || 'Unknown',
      legislation.geminiSummary || `${legislation.title} - Track this bill's progress and view detailed analysis.`
    );
  } catch (error) {
    return {
      title: 'Legislation Not Found | StatePulse',
      description: 'The requested legislation could not be found.',
    };
  }
}

export default async function LegislationDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  // Guard: check if id looks like a valid legislation id (basic check: must contain a dash or be longer than 10 chars)
  const isLikelyLegislationId = id.length > 10 || id.includes('-');
  if (!isLikelyLegislationId) {
    return (
      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-destructive">Invalid Legislation ID</CardTitle>
          <CardDescription>
            The ID <Badge variant="outline">{id}</Badge> does not appear to be a valid legislation ID.<br />
            You may have followed a broken or incorrect link.
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
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight break-words">{identifier}: {title}</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-sm mt-1 break-words">
                {session} - {jurisdictionName} {chamber && `(${chamber})`}
              </CardDescription>
            </div>
            <BookmarkButton legislationId={id} className="flex-shrink-0 self-start" />
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6 bg-background">
          <AnimatedSection className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 min-w-0">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Key Details
              </h3>
              {statusText && <div><Badge variant="secondary" className="text-sm break-words">{statusText}</Badge></div>}
              {classification && classification.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Type: <div className="flex flex-wrap gap-1 mt-1">{classification.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}</div>
                </div>
              )}
              {firstActionAt && (
                <p className="text-sm text-muted-foreground flex items-start">
                  <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>First Action: {firstActionAt.toLocaleDateString()}</span>
                </p>
              )}
              {latestActionAt && (
                <p className="text-sm text-muted-foreground flex items-start">
                  <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Latest Action: {latestActionAt.toLocaleDateString()}</span>
                </p>
              )}
              {latestActionDescription && <p className="text-sm text-muted-foreground break-words">Latest Action Detail: {latestActionDescription}</p>}
            </div>

            <div className="space-y-2 min-w-0">
              <h3 className="text-lg font-semibold text-foreground flex items-center">
                <Tag className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Subjects
              </h3>
              {subjects && subjects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subjects.map(subject => <Badge key={subject} variant="default" className="text-xs break-words">{subject}</Badge>)}
                </div>
              )}
              {(!subjects || subjects.length === 0) && (
                <p className="text-sm text-muted-foreground">No subjects available.</p>
              )}
            </div>
          </AnimatedSection>

          {/* Voting Prediction Section */}
          <AnimatedSection>
            <VotingPredictionSection legislationId={id} />
          </AnimatedSection>

          {openstatesUrl && (
            <AnimatedSection>
              <Link href={openstatesUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm break-all">
                <ExternalLink className="mr-2 h-4 w-4 flex-shrink-0" /> View on OpenStates
              </Link>
            </AnimatedSection>
          )}

          {/* Sponsors Section with Collapsible Functionality */}
          <AnimatedSection><CollapsibleSponsors sponsors={sponsors} /></AnimatedSection>

          {abstracts && abstracts.length > 0 && (
            <AnimatedSection>
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
                <FileText className="mr-2 h-6 w-6 text-primary flex-shrink-0" /> Abstracts
              </h3>
              {abstracts.map((abstract, index) => (
                <div key={index} className="p-3 border rounded-md bg-muted/50 mb-2">
                  <p className="text-sm text-foreground break-words">{abstract.abstract}</p>
                  {abstract.note && <p className="text-xs text-muted-foreground mt-1 break-words">Note: {abstract.note}</p>}
                </div>
              ))}
            </AnimatedSection>
          )}

          {geminiSummary && (
            <AnimatedSection className="p-4 border border-primary/30 rounded-lg bg-primary/5">
              <h3 className="text-xl font-semibold text-primary mb-3">AI Generated Summary</h3>
              <p className="text-sm text-muted-foreground italic break-words">{geminiSummary}</p>
            </AnimatedSection>
          )}

          {versions && versions.length > 0 && (
            <AnimatedSection>
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
                <FileText className="mr-2 h-6 w-6 text-primary flex-shrink-0" /> Versions & Documents
              </h3>
              <ul className="space-y-2">
                {versions.map((version, index) => (
                  <li key={index} className="p-3 border rounded-md bg-muted/50">
                    <p className="font-medium text-foreground break-words">{version.note}</p>
                    {version.date && <p className="text-xs text-muted-foreground">Date: {version.date.toLocaleDateString()}</p>}
                    {version.links && version.links.map((link: { url: string; media_type?: string | null }) => (
                      <Link key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm block mt-1 break-all">
                        <ExternalLink className="inline-block mr-1 h-3 w-3" /> {link.media_type || 'View Document'}
                      </Link>
                    ))}
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          )}

          {sources && sources.length > 0 && (
            <AnimatedSection>
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center">
                <ExternalLink className="mr-2 h-6 w-6 text-primary flex-shrink-0" /> Sources
              </h3>
              <ul className="space-y-1">
                {sources.map((source, index) => (
                  <li key={index}>
                    <Link href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm break-all">
                      {source.note || source.url}
                    </Link>
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          )}

          <AnimatedSection><CollapsibleTimeline historyEvents={history} /></AnimatedSection>
        </CardContent>
      </Card>
    </div>
  );
}