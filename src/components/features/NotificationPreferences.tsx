"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mail, Bell, Settings } from 'lucide-react';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

interface NotificationPreferences {
  emailNotifications: {
    sponsorshipAlerts: boolean;
    weeklyDigest: boolean;
  };
}

export function NotificationPreferences() {
  const { isSignedIn } = useUser();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: {
      sponsorshipAlerts: true,
      weeklyDigest: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      fetchPreferences();
    }
  }, [isSignedIn]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/notification-preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      setSaving(true);
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPreferences)
      });

      if (response.ok) {
        setPreferences(newPreferences);
        toast({
          title: "Settings saved",
          description: "Your notification preferences have been updated"
        });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSponsorshipAlertsChange = (enabled: boolean) => {
    const newPreferences = {
      ...preferences,
      emailNotifications: {
        ...preferences.emailNotifications,
        sponsorshipAlerts: enabled
      }
    };
    updatePreferences(newPreferences);
  };

  const handleWeeklyDigestChange = (enabled: boolean) => {
    const newPreferences = {
      ...preferences,
      emailNotifications: {
        ...preferences.emailNotifications,
        weeklyDigest: enabled
      }
    };
    updatePreferences(newPreferences);
  };

  if (!isSignedIn) {
    return (
      <AnimatedSection>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Settings className="h-8 w-8 mx-auto mb-2" />
              <p>Please sign in to manage your notification preferences</p>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>
    );
  }

  if (loading) {
    return (
      <AnimatedSection>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Loading notification preferences...</p>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Manage how you receive updates about the representatives you follow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium">Email Notifications</h4>
            </div>

            <div className="space-y-4 pl-6">
              {/* Sponsorship Alerts */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">Sponsorship Alerts</div>
                  <div className="text-sm text-muted-foreground">
                    Get notified when representatives you follow sponsor new legislation
                  </div>
                </div>
                <Switch
                  checked={preferences.emailNotifications.sponsorshipAlerts}
                  onCheckedChange={handleSponsorshipAlertsChange}
                  disabled={saving}
                />
              </div>

              {/* Weekly Digest */}
              <div className="flex items-center justify-between space-x-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">Weekly Digest</div>
                  <div className="text-sm text-muted-foreground">
                    Receive a weekly summary of activity from your followed representatives
                  </div>
                </div>
                <Switch
                  checked={preferences.emailNotifications.weeklyDigest}
                  onCheckedChange={handleWeeklyDigestChange}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="border-t pt-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                • Sponsorship alerts are sent when representatives you follow introduce or co-sponsor new legislation
              </p>
              <p>
                • You can unsubscribe from emails at any time using the link in any notification email
              </p>
              <p>
                • Notifications are only sent for representatives you actively follow
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </AnimatedSection>
  );
}
