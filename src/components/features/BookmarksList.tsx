'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/features/BookmarkButton";
import { ExternalLink, CalendarDays, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { Legislation } from '@/types/legislation';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

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
      const legislationPromises = uniqueLegislationIds.map((id: string) => fetch(`/api/legislation/${id}`).then(res => res.ok ? res.json() : null).catch(() => null));

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
    <div className="space-y-4">
      {loading ? (
        <p className="text-muted-foreground">Loading bookmarks...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : bookmarkedLegislation.length === 0 ? (
        <p className="text-muted-foreground">No bookmarked legislation found.</p>
      ) : (
        <ul className="space-y-4">
          {bookmarkedLegislation.map((legislation, i) => (
            <AnimatedSection
              key={legislation.id}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <li>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      {legislation.identifier && <span>{legislation.identifier}:</span>}
                      {legislation.title || 'Untitled Legislation'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {legislation.subjects?.map((subject: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">{subject}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <CalendarDays className="h-4 w-4" />
                      {legislation.latestActionAt ? new Date(legislation.latestActionAt).toLocaleDateString() : 'No date'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="h-4 w-4" />
                      {legislation.sponsors?.length || 0} sponsor{legislation.sponsors?.length === 1 ? '' : 's'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <FileText className="h-4 w-4" />
                      {legislation.jurisdictionName}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Link href={`/legislation/${legislation.id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-1" /> View Details
                        </Button>
                      </Link>
                      <BookmarkButton legislationId={legislation.id} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            </AnimatedSection>
          ))}
        </ul>
      )}
    </div>
  );
}
