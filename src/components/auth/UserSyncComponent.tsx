"use client";

import { useEffect } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';

export function UserSyncComponent() {
  const { userId, isSignedIn, isLoaded, getToken } = useAuth();
  const { session } = useClerk();
  const { toast } = useToast();

  useEffect(() => {
    // Only attempt to sync user when they're signed in
    if (isLoaded && isSignedIn && userId) {
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
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();

          if (data.success) {
            // console.log('User synced with MongoDB:', data);
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
        }
      };

      syncUser();
    }
  }, [isLoaded, isSignedIn, userId, toast, session]);

  // This component doesn't render anything visible
  return null;
}
