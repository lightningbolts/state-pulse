"use client";

import { useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';

export function UserSyncComponent() {
  const { userId, isSignedIn, isLoaded, getToken } = useAuth();
  const { session } = useClerk();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    const storageKey = `sp-user-synced:${userId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {
      // sessionStorage can throw in private browsing; continue with sync.
    }

    const syncUser = async () => {
      try {
        const token = session ? await session.getToken() : null;

        const response = await fetch('/api/auth/sync-user', {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          credentials: 'include',
        });

        if (!response.ok) {
          console.error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          try {
            sessionStorage.setItem(storageKey, '1');
          } catch {
            // ignore quota / private browsing
          }
        } else {
          const errorMessage = data.error || 'Unknown error occurred';
          console.error('Error syncing user:', errorMessage);

          toast({
            title: "Sync Error",
            description: `There was an issue syncing your profile: ${errorMessage}. Some features may be limited.`,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('Error syncing user:', error.message);

        toast({
          title: "Connection Error",
          description: `Failed to connect to the server: ${error.message}. Some features may be limited.`,
          variant: "destructive",
        });
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId, toast, session]);

  // This component doesn't render anything visible
  return null;
}
