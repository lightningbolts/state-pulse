'use client';

import { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';

interface BookmarkButtonProps {
  legislationId: string;
  className?: string;
}

export function BookmarkButton({ legislationId, className = '' }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, isLoaded } = useUser();

  // Check if legislation is bookmarked on component mount
  useEffect(() => {
    if (isLoaded && user) {
      checkBookmarkStatus();
    }
  }, [isLoaded, user, legislationId]);

  const checkBookmarkStatus = async () => {
    try {
      const response = await fetch('/api/bookmarks');
      if (response.ok) {
        const data = await response.json();
        setIsBookmarked(data.bookmarks.includes(legislationId));
      }
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    }
  };

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
        setIsBookmarked(!isBookmarked);
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

  if (!isLoaded) {
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
