'use client';

import * as React from 'react';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { BroadcastTemplate } from '@/lib/maintenanceEmail';

type PreviewResponse = {
  adminEmail: string;
  recipientCount: number;
  recipients: Array<{ email: string; sources: string[] }>;
  defaults: {
    template: BroadcastTemplate;
    subject: string;
    heading: string;
    returnWindow: string;
    confirmPhrase: string;
  };
  previewHtml: string;
  smtpFrom: string | null;
  error?: string;
};

type SendResponse = {
  ok?: boolean;
  dryRun?: boolean;
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  previewHtml?: string;
  errors?: Array<{ email: string; error: string }>;
  error?: string;
};

export default function AdminEmailsClient() {
  const { user, isLoaded } = useUser();
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    '';

  const [loading, setLoading] = React.useState(true);
  const [forbidden, setForbidden] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [template, setTemplate] = React.useState<BroadcastTemplate>('restored');
  const [subject, setSubject] = React.useState('');
  const [heading, setHeading] = React.useState('');
  const [returnWindow, setReturnWindow] = React.useState('a week or two');
  const [extraNote, setExtraNote] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<SendResponse | null>(null);
  const [confirmText, setConfirmText] = React.useState('');

  const confirmPhrase =
    template === 'restored' ? 'SEND RESTORED' : 'SEND DOWNTIME';

  const loadPreview = React.useCallback(
    async (nextTemplate: BroadcastTemplate) => {
      setLoading(true);
      setStatus(null);
      try {
        const res = await fetch(
          `/api/admin/emails/broadcast?template=${nextTemplate}`,
        );
        if (res.status === 403 || res.status === 401) {
          setForbidden(true);
          return;
        }
        const data = (await res.json()) as PreviewResponse;
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setPreview(data);
        setTemplate(data.defaults.template);
        setSubject(data.defaults.subject);
        setHeading(data.defaults.heading);
        setReturnWindow(data.defaults.returnWindow || 'a week or two');
        setConfirmText('');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!isLoaded || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/emails/broadcast?template=restored');
        if (res.status === 403 || res.status === 401) {
          if (!cancelled) setForbidden(true);
          return;
        }
        const data = (await res.json()) as PreviewResponse;
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        if (cancelled) return;
        setPreview(data);
        setTemplate(data.defaults.template);
        setSubject(data.defaults.subject);
        setHeading(data.defaults.heading);
        setReturnWindow(data.defaults.returnWindow || 'a week or two');
      } catch (err) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  async function runBroadcast(dryRun: boolean) {
    setSending(true);
    setStatus(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/admin/emails/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          confirm: !dryRun,
          template,
          subject,
          heading,
          returnWindow: template === 'downtime' ? returnWindow : undefined,
          extraNote: extraNote.trim() || undefined,
          replyTo: primaryEmail || 'timberlake2025@gmail.com',
        }),
      });
      const data = (await res.json()) as SendResponse;
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setLastResult(data);
      if (data.previewHtml) {
        setPreview((prev) =>
          prev ? { ...prev, previewHtml: data.previewHtml! } : prev,
        );
      }
      setStatus(
        dryRun
          ? `Dry run: would send to ${data.totalRecipients} recipients.`
          : `Sent ${data.sent} of ${data.totalRecipients} emails (${data.failed} failed).`,
      );
      if (!dryRun) setConfirmText('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <SignedOut>
        <div className="rounded border border-border bg-surface p-6 text-sm text-muted-foreground">
          <p className="mb-3">Sign in with your admin Gmail to send broadcasts.</p>
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading broadcast tools…</p>
        )}

        {forbidden && (
          <div className="rounded border border-border bg-surface p-6 text-sm">
            <p className="font-medium text-foreground">Access restricted</p>
            <p className="mt-2 text-muted-foreground">
              Signed in as <span className="text-foreground">{primaryEmail || 'unknown'}</span>.
              Only the StatePulse owner account can send list broadcasts.
            </p>
          </div>
        )}

        {!loading && !forbidden && preview && (
          <div className="space-y-8">
            <div className="grid gap-4 rounded border border-border bg-surface p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">From (Brevo SMTP)</p>
                <p className="mt-1 font-medium text-foreground">{preview.smtpFrom || 'SMTP_FROM not set'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reply-To</p>
                <p className="mt-1 font-medium text-foreground">{primaryEmail}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recipients</p>
                <p className="mt-1 font-medium text-foreground">{preview.recipientCount} on email list</p>
              </div>
            </div>

            <div className="space-y-4 rounded border border-border bg-card p-5">
              <div className="space-y-2">
                <Label htmlFor="template">Announcement type</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={template === 'restored' ? 'default' : 'outline'}
                    size="sm"
                    disabled={sending}
                    onClick={() => void loadPreview('restored')}
                  >
                    Back online
                  </Button>
                  <Button
                    type="button"
                    variant={template === 'downtime' ? 'default' : 'outline'}
                    size="sm"
                    disabled={sending}
                    onClick={() => void loadPreview('downtime')}
                  >
                    Downtime
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heading">Heading</Label>
                <Input
                  id="heading"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                />
              </div>
              {template === 'downtime' && (
                <div className="space-y-2">
                  <Label htmlFor="returnWindow">Return window phrasing</Label>
                  <Input
                    id="returnWindow"
                    value={returnWindow}
                    onChange={(e) => setReturnWindow(e.target.value)}
                    placeholder="a week or two"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="extraNote">Optional extra note (HTML allowed)</Label>
                <Textarea
                  id="extraNote"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Follow @mystatepulse on Instagram for status updates."
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending}
                  onClick={() => runBroadcast(true)}
                >
                  Dry-run & refresh preview
                </Button>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <Label htmlFor="confirm">
                  Type{' '}
                  <span className="font-semibold text-foreground">{confirmPhrase}</span>{' '}
                  to enable send
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
                <Button
                  type="button"
                  disabled={sending || confirmText !== confirmPhrase}
                  onClick={() => runBroadcast(false)}
                >
                  {sending ? 'Sending…' : `Send to ${preview.recipientCount} recipients`}
                </Button>
              </div>

              {status && (
                <p className="text-sm text-foreground">{status}</p>
              )}
              {lastResult?.errors && lastResult.errors.length > 0 && (
                <ul className="max-h-40 overflow-auto text-xs text-muted-foreground">
                  {lastResult.errors.map((err) => (
                    <li key={err.email}>
                      {err.email}: {err.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="font-headline text-lg font-semibold text-foreground">
                Template preview
              </h2>
              <p className="text-xs text-muted-foreground">
                Click “Dry-run & refresh preview” to render the form fields above.
              </p>
              <iframe
                title="Email preview"
                className="h-[640px] w-full rounded border border-border bg-background"
                srcDoc={preview.previewHtml}
              />
            </div>

            <div className="space-y-3">
              <h2 className="font-headline text-lg font-semibold text-foreground">
                Email list ({preview.recipientCount})
              </h2>
              <ul className="max-h-64 overflow-auto rounded border border-border bg-surface p-3 text-xs text-muted-foreground">
                {preview.recipients.map((r) => (
                  <li key={r.email} className="border-b border-border/60 py-1 last:border-0">
                    <span className="text-foreground">{r.email}</span>
                    <span className="ml-2">({r.sources.join(', ')})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SignedIn>
    </>
  );
}
