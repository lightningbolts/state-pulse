'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/features/BookmarkButton";
import { ExternalLink, CalendarDays, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { Legislation } from '@/services/legislationService';

export function BookmarksList() {
  const [bookmarkedLegislation, setBookmarkedLegislation] = useState<Legislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      fetchBookmarkedLegislation();
    } else if (isLoaded && !user) {
      setLoading(false);
    }
  }, [isLoaded, user]);

  const fetchBookmarkedLegislation = async () => {
    try {
      setLoading(true);

      // Fetch the user's bookmarks from the new API
      const bookmarksResponse = await fetch('/api/bookmarks');
      if (!bookmarksResponse.ok) {
        throw new Error('Failed to fetch bookmarks');
      }

      const bookmarksData = await bookmarksResponse.json();
      const bookmarks = bookmarksData.bookmarks; // Array of bookmark objects with legislationId

      if (bookmarks.length === 0) {
        setBookmarkedLegislation([]);
        setLoading(false);
        return;
      }

      // Extract unique legislation IDs from bookmark objects
      const uniqueLegislationIds = [...new Set(bookmarks.map((bookmark: any) => bookmark.legislationId))];

      console.log('Fetching legislation for IDs:', uniqueLegislationIds);

      // Then fetch the details for each unique bookmarked legislation
      const legislationPromises = uniqueLegislationIds.map(async (id: string) => {
        try {
          const response = await fetch(`/api/legislation/${id}`);
          if (response.ok) {
            return response.json();
          }
          console.warn(`Failed to fetch legislation ${id}:`, response.status);
          return null;
        } catch (error) {
          console.error(`Error fetching legislation ${id}:`, error);
          return null;
        }
      });

      const legislationResults = await Promise.all(legislationPromises);
      const validLegislation = legislationResults.filter(item => item !== null);

      // Remove any duplicates based on legislation ID
      const uniqueLegislation = validLegislation.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
      );

      console.log('Fetched unique legislation:', uniqueLegislation.length, 'items');
      setBookmarkedLegislation(uniqueLegislation);
    } catch (err) {
      console.error('Error fetching bookmarked legislation:', err);
      setError('Failed to load bookmarked legislation');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-lg text-muted-foreground">Loading your bookmarks...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold mb-2">Sign in to view your bookmarks</h3>
        <p className="text-muted-foreground mb-4">
          You need to be signed in to save and view bookmarked legislation.
        </p>
        <Link href="/signin">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-destructive mb-2">Error</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchBookmarkedLegislation}>Try Again</Button>
      </div>
    );
  }

  if (bookmarkedLegislation.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold mb-2">No bookmarks yet</h3>
        <p className="text-muted-foreground mb-4">
          Start bookmarking legislation to see them here. Browse legislation and click the bookmark button to save them.
        </p>
        <Link href="/legislation">
          <Button>Browse Legislation</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        {bookmarkedLegislation.length} bookmarked item{bookmarkedLegislation.length !== 1 ? 's' : ''}
      </div>

      {bookmarkedLegislation.map((legislation) => (
        <Card key={legislation.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg md:text-xl mb-2 break-words">
                  <Link
                    href={`/legislation/${legislation.id}`}
                    className="hover:text-primary transition-colors"
                  >
                    {legislation.identifier}: {legislation.title}
                  </Link>
                </CardTitle>
                <div className="flex flex-wrap gap-2 mb-2">
                  {legislation.statusText && (
                    <Badge variant="secondary" className="text-xs">{legislation.statusText}</Badge>
                  )}
                  {legislation.classification?.map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground break-words">
                  {legislation.session} - {legislation.jurisdictionName}
                  {legislation.chamber && ` (${legislation.chamber})`}
                </p>
              </div>
              <BookmarkButton
                legislationId={legislation.id}
                className="flex-shrink-0 self-start"
              />
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {legislation.firstActionAt && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  First Action: {new Date(legislation.firstActionAt).toLocaleDateString()}
                </div>
              )}

              {legislation.latestActionAt && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Latest Action: {new Date(legislation.latestActionAt).toLocaleDateString()}
                </div>
              )}

              {legislation.sponsors && legislation.sponsors.length > 0 && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 h-4 w-4" />
                  {legislation.sponsors.length} sponsor{legislation.sponsors.length !== 1 ? 's' : ''}
                </div>
              )}

              {legislation.abstracts && legislation.abstracts.length > 0 && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <FileText className="mr-2 h-4 w-4" />
                  {legislation.abstracts.length} abstract{legislation.abstracts.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {legislation.subjects && legislation.subjects.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Subjects:</h4>
                <div className="flex flex-wrap gap-1">
                  {legislation.subjects.map((subject) => (
                    <Badge key={subject} variant="default" className="text-xs">
                      {subject}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {legislation.geminiSummary && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                <h4 className="text-sm font-medium text-primary mb-2">AI Summary:</h4>
                <p className="text-sm text-muted-foreground">
                  {legislation.geminiSummary.length > 200
                    ? `${legislation.geminiSummary.substring(0, 200)}...`
                    : legislation.geminiSummary
                  }
                </p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <Link href={`/legislation/${legislation.id}`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>

              {legislation.openstatesUrl && (
                <Link
                  href={legislation.openstatesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center text-sm"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  OpenStates
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
