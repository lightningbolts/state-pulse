import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { BookmarkButton } from "@/components/features/BookmarkButton";

export interface PolicyUpdate {
  id: string;
  title?: string;
  jurisdictionName?: string;
  session?: string;
  subjects?: string[];
  createdAt?: string;
  summary?: string;
  geminiSummary?: string;
  classification?: string[];
  openstatesUrl?: string;
  latestActionDescription?: string;
  sources?: { url: string; note?: string | null }[];
  sponsors?: { name: string }[];
  lastActionAt?: string | null;
  identifier?: string;
  history?: { date: string; action: string }[];
  firstActionAt?: string | null;
  versions?: { date: string; note?: string; classification?: string | null; links?: any[] }[];
}

interface PolicyUpdateCardProps {
  update: PolicyUpdate;
  idx: number;
  updates: PolicyUpdate[];
  classification: string;
  subject: string;
  setClassification: (c: string) => void;
  setSubject: (s: string) => void;
  setUpdates: (u: PolicyUpdate[]) => void;
  setSkip: (n: number) => void;
  skipRef: React.MutableRefObject<number>;
  setHasMore: (b: boolean) => void;
  setLoading: (b: boolean) => void;
}

const PolicyUpdateCard: React.FC<PolicyUpdateCardProps> = ({
  update, idx, updates, classification, subject, setClassification, setSubject, setUpdates, setSkip, skipRef, setHasMore, setLoading
}) => {
  const getFormattedDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return typeof window !== 'undefined'
      ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : date.toISOString().slice(0, 10);
  };

  // --- Introduction Date Logic ---
  let introDate: Date | null = null;
  if (update.firstActionAt) {
    introDate = new Date(update.firstActionAt);
  } else if (Array.isArray(update.history) && update.history.length > 0) {
    const sortedHistory = [...update.history]
      .filter(h => h.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sortedHistory.length > 0 && sortedHistory[0].date) {
      introDate = new Date(sortedHistory[0].date);
    }
  }
  if ((!introDate || isNaN(introDate.getTime())) && update.createdAt) {
    introDate = new Date(update.createdAt);
  }
  const formattedIntroDate = introDate && !isNaN(introDate.getTime()) ? getFormattedDate(introDate.toISOString()) : '';

  // --- Last Action Date & Description Logic ---
  let lastActionDate: Date | null = update.lastActionAt ? new Date(update.lastActionAt) : null;
  let lastActionDescription = update.latestActionDescription;

  if (Array.isArray(update.history) && update.history.length > 0) {
    const sortedHistory = [...update.history]
      .filter(h => h.date && h.action)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sortedHistory.length > 0) {
      const latestHistoryAction = sortedHistory[0];
      const latestHistoryDate = new Date(latestHistoryAction.date);

      if (latestHistoryDate && !isNaN(latestHistoryDate.getTime())) {
        if (!lastActionDate || isNaN(lastActionDate.getTime()) || latestHistoryDate > lastActionDate) {
          lastActionDate = latestHistoryDate;
          lastActionDescription = latestHistoryAction.action;
        }
      }
    }
  }
  const formattedLastActionDate = lastActionDate && !isNaN(lastActionDate.getTime()) ? getFormattedDate(lastActionDate.toISOString()) : null;

  const stateUrl = update.sources && update.sources.length > 0 ? update.sources[0].url : update.openstatesUrl;
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
  const uniqueKey = update.id && updates.filter(u => u.id === update.id).length === 1 ? update.id : `${update.id || 'no-id'}-${idx}`;

  return (
    <AnimatedSection key={uniqueKey}>
      <div
        className="mb-4 p-4 border rounded-lg bg-background transition hover:bg-accent/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary h-full relative"
      >
        <div className="flex flex-col h-full">
          {/* Clickable area for navigation */}
          <Link
            href={`/legislation/${update.id}`}
            className="block flex-1"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <div className="font-bold text-lg mb-1 text-left">{update.identifier ? `${update.identifier} - ${update.title}` : update.title}</div>
              <div className="text-sm text-muted-foreground mb-1 text-left">
                {update.jurisdictionName} • {update.session}
              </div>
              {update.classification && update.classification.length > 0 && (
                <div className="mb-1">
                  {update.classification.map((c, i) => (
                    <Badge
                      key={c + i}
                      variant={classification === c.toLowerCase() ? "default" : "secondary"}
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (classification !== c.toLowerCase()) {
                          setClassification(c.toLowerCase());
                          setUpdates([]);
                          setSkip(0);
                          skipRef.current = 0;
                          setHasMore(true);
                          setLoading(true);
                        }
                      }}
                      className="mr-1 cursor-pointer"
                    >
                      {capitalize(c)}
                    </Badge>
                  ))}
                </div>
              )}
              {update.subjects && update.subjects.length > 0 && (
                <div className="mb-1">
                  {update.subjects.map((s, i) => (
                    <Badge
                      key={s + i}
                      variant={subject === s ? "default" : "outline"}
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newSubject = subject === s ? "" : s;
                        if (subject !== newSubject) {
                          setSubject(newSubject);
                          setUpdates([]);
                          setSkip(0);
                          skipRef.current = 0;
                          setHasMore(true);
                          setLoading(true);
                        }
                      }}
                      className="mr-1 cursor-pointer"
                    >
                      #{capitalize(s)}
                    </Badge>
                  ))}
                </div>
              )}
              {formattedIntroDate && (
                <div className="text-sm text-muted-foreground mb-1">
                  <span className="font-semibold">Introduced: </span>{formattedIntroDate}
                </div>
              )}
              {(lastActionDescription || formattedLastActionDate) && (
                <div className="text-sm text-muted-foreground mb-1 text-left">
                  <span className="font-semibold">Last Action: </span>{lastActionDescription || 'N/A'}
                  {formattedLastActionDate && (
                    <span className="ml-2">({formattedLastActionDate})</span>
                  )}
                </div>
              )}
              {update.sponsors && update.sponsors.length > 0 && (
                <div className="mb-1 text-xs text-muted-foreground">
                  <span className="font-semibold">Sponsors: </span>
                  {update.sponsors.map((sp, i) => (
                    <span key={`${sp.name || ''}-${i}`}>{sp.name}{i < (update.sponsors?.length || 0) - 1 ? ', ' : ''}</span>
                  ))}
                </div>
              )}
              {update.geminiSummary && (
                <div className="mt-2 text-sm text-left">{update.geminiSummary}</div>
              )}
              {!update.geminiSummary && update.summary && (
                <div className="mt-2 text-sm text-left">{update.summary}</div>
              )}
            </div>
          </Link>

          {/* Bottom buttons section */}
          <div className="mt-auto pt-4 flex justify-between items-center gap-2">
            <button
              type="button"
              className="h-10 px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-1 transition-colors"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                window.open(stateUrl, '_blank', 'noopener');
              }}
            >
              {update.sources && update.sources.length > 0 ? 'Official Link' : 'OpenStates Link'}
            </button>

            <div onClick={e => e.stopPropagation()}>
              <BookmarkButton
                legislationId={update.id}
                className="h-10 px-3 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default PolicyUpdateCard;
