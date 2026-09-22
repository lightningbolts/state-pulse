"use client";

import { useEffect, useRef } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';

export function UserSyncComponent() {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const { session } = useClerk();
  const { toast } = useToast();
  const inFlightSyncs = useRef(new Set<string>());

  useEffect(() => {
    // Only attempt to sync user when they're signed in
    if (isLoaded && isSignedIn && userId) {
      const syncKey = `statepulse:user-sync:${userId}`;
      try {
        if (sessionStorage.getItem(syncKey) === '1') return;
      } catch {
        // Storage can be unavailable in hardened/private browser contexts.
      }
      if (inFlightSyncs.current.has(syncKey)) return;
      inFlightSyncs.current.add(syncKey);

      const syncUser = async () => {
        try {
          // Get the session token
          const token = session ? await session.getToken() : null;

          const response = await fetch('/api/auth/sync-user', {
            headers: {
              'Content-Type': 'application/json',
              // Include the session token if available
              ...(token && { Authorization: `Bearer ${token}` })
            },
            // Include credentials for cookies
            credentials: 'include',
          });

          if (!response.ok) {
            console.error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            try {
              sessionStorage.setItem(syncKey, '1');
            } catch {
              // The sync succeeded; storage persistence is only an optimization.
            }
          } else {
            // Include the error message from the API response
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
        } finally {
          inFlightSyncs.current.delete(syncKey);
        }
      };

      syncUser();
    }
  }, [isLoaded, isSignedIn, userId, toast, session]);

  // This component doesn't render anything visible
  return null;
}
