"use client";

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';

// Memoize followed IDs fetch across hook instances
let followedRepIdsPromise: Promise<string[]> | null = null;
const getFollowedRepIds = async (): Promise<string[]> => {
  if (!followedRepIdsPromise) {
    followedRepIdsPromise = fetch('/api/representatives/followed')
      .then(response => response.ok ? response.json() : { representatives: [] })
      .then(data => data.representatives.map((rep: any) => rep.id))
      .catch(error => {
        console.error('Error fetching followed representatives:', error);
        return [];
      });
  }
  return followedRepIdsPromise;
};

export function useFollowRepresentative(repId: string, initialIsFollowed?: boolean) {
  const { isSignedIn } = useUser();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowed ?? false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if representative is followed only if initialIsFollowed is not provided
  const checkFollowStatus = useCallback(async () => {
    if (!isSignedIn || !repId || initialIsFollowed !== undefined) return;

    try {
      const followedIds = await getFollowedRepIds();
      setIsFollowing(followedIds.includes(repId));
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }, [isSignedIn, repId, initialIsFollowed]);

  useEffect(() => {
    if (initialIsFollowed !== undefined) {
      setIsFollowing(initialIsFollowed);
    } else {
      checkFollowStatus();
    }
  }, [checkFollowStatus, initialIsFollowed]);

  const toggleFollow = useCallback(async () => {
    if (!isSignedIn) {
      toast({
        title: "Sign in required",
        description: "Please sign in to follow representatives.",
        variant: "destructive",
      });
      return;
    }

    if (!repId) return;

    setIsLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/representatives/${repId}/follow`, {
        method,
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        toast({
          title: isFollowing ? "Unfollowed" : "Following",
          description: isFollowing
            ? "You are no longer following this representative."
            : "You are now following this representative.",
        });
      } else {
        console.error('Failed to update follow status', response);
        toast({
          title: "Error",
          description: "Failed to update follow status. Please try again.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, repId, isFollowing, toast]);

  return {
    isFollowing,
    isLoading,
    toggleFollow,
    isSignedIn,
  };
}

export function useFollowedRepresentatives() {
  const { isSignedIn } = useUser();
  const [followedReps, setFollowedReps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFollowedReps = useCallback(async () => {
    if (!isSignedIn) {
      setFollowedReps([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/representatives/followed');
      if (response.ok) {
        const data = await response.json();
        setFollowedReps(data.representatives || []);
      }
    } catch (error) {
      console.error('Error fetching followed representatives:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    fetchFollowedReps();
  }, [fetchFollowedReps]);

  return {
    followedReps,
    isLoading,
    refetch: fetchFollowedReps,
  };
}
