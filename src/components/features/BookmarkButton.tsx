'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';

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
        setBookmarks(data.bookmarks || []);
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
      const method = isBookmarked ? 'DELETE' : 'POST';
      const response = await fetch('/api/bookmarks', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ legislationId }),
      });

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
        throw new Error(error.error);
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
      className={className}
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
