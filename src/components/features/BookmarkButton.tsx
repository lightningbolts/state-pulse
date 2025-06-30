'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

// Create a context to share bookmarks data across all BookmarkButton instances
const BookmarksContext = createContext<{
  bookmarks: string[];
  updateBookmarks: (bookmarks: string[]) => void;
  loading: boolean;
}>({
  bookmarks: [],
  updateBookmarks: () => {},
  loading: true,
});

// Provider component to wrap the app/page
export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      fetchBookmarks();
    } else if (isLoaded && !user) {
      setLoading(false);
      setBookmarks([]);
    }
  }, [isLoaded, user]);

  const fetchBookmarks = async () => {
    try {
      const response = await fetch('/api/bookmarks');
      if (response.ok) {
        const data = await response.json();
        // Extract legislation IDs from bookmark objects
        const legislationIds = data.bookmarks.map((bookmark: any) => bookmark.legislationId);
        setBookmarks(legislationIds);
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookmarks = (newBookmarks: string[]) => {
    setBookmarks(newBookmarks);
  };

  return (
    <BookmarksContext.Provider value={{ bookmarks, updateBookmarks, loading }}>
      {children}
    </BookmarksContext.Provider>
  );
}

interface BookmarkButtonProps {
  legislationId: string;
  className?: string;
}

export function BookmarkButton({ legislationId, className = '' }: BookmarkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, isLoaded } = useUser();
  const { bookmarks, updateBookmarks, loading } = useContext(BookmarksContext);

  const isBookmarked = bookmarks.includes(legislationId);

  const handleBookmarkToggle = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to bookmark legislation.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let response;

      if (isBookmarked) {
        // DELETE request - pass legislationId as query parameter
        response = await fetch(`/api/bookmarks?legislationId=${legislationId}`, {
          method: 'DELETE',
        });
      } else {
        // POST request - pass legislationId in body
        response = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ legislationId }),
        });
      }

      if (response.ok) {
        // Update the shared bookmarks state
        const newBookmarks = isBookmarked
          ? bookmarks.filter(id => id !== legislationId)
          : [...bookmarks, legislationId];
        updateBookmarks(newBookmarks);

        toast({
          title: isBookmarked ? "Bookmark removed" : "Bookmarked",
          description: isBookmarked
            ? "Legislation removed from your bookmarks."
            : "Legislation added to your bookmarks.",
        });
      } else {
        const error = await response.json();
        // Handle 409 (already bookmarked) as a success case
        if (response.status === 409 && !isBookmarked) {
          // Item is already bookmarked, just update the UI
          const newBookmarks = [...bookmarks, legislationId];
          updateBookmarks(newBookmarks);
          toast({
            title: "Already bookmarked",
            description: "This legislation was already in your bookmarks.",
          });
        } else {
          throw new Error(error.error || 'Failed to update bookmark');
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to update bookmark. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Bookmark className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant={isBookmarked ? "default" : "outline"}
      size="sm"
      onClick={handleBookmarkToggle}
      disabled={isLoading}
      className={cn(
        "transition-all duration-200",
        isBookmarked
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-4 w-4 mr-1" />
      ) : (
        <Bookmark className="h-4 w-4 mr-1" />
      )}
      {isBookmarked ? 'Bookmarked' : 'Bookmark'}
    </Button>
  );
}
