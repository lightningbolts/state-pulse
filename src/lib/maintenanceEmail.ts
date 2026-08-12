import { EMAIL_BRAND } from '@/lib/emailBrand';
import { renderBrandedEmail } from '@/lib/emailTemplate';

export type BroadcastTemplate = 'downtime' | 'restored';

export const DEFAULT_MAINTENANCE_SUBJECT =
  'StatePulse is temporarily down — back in 1–2 weeks';

export const DEFAULT_MAINTENANCE_HEADING =
  'StatePulse is temporarily unavailable';

export const DEFAULT_RESTORED_SUBJECT =
  "StatePulse is back online — thanks for your patience";

export const DEFAULT_RESTORED_HEADING = "We're back online";

export function buildMaintenanceMessage({
  returnWindow = 'a week or two',
  extraNote,
}: {
  returnWindow?: string;
  extraNote?: string;
} = {}): string {
  const b = EMAIL_BRAND;
  return `
    <p style="margin:0 0 16px 0;">Hi there,</p>
    <p style="margin:0 0 16px 0;">
      We're writing to let you know that <strong>StatePulse is currently down</strong> for maintenance
      and infrastructure work. The site and related services will be unavailable for about
      <strong>${returnWindow}</strong>.
    </p>
    <div style="background:${b.panel};border:1px solid ${b.border};border-radius:${b.radiusLg};padding:16px;margin:0 0 16px 0;">
      <p style="margin:0 0 8px 0;font-family:${b.fontHeadline};font-weight:600;color:${b.foreground};">What this means</p>
      <ul style="margin:0;padding-left:18px;color:${b.secondary};">
        <li style="margin-bottom:6px;">The website at statepulse.me may be unreachable or show errors</li>
        <li style="margin-bottom:6px;">Daily and weekly legislative email digests are paused during the outage</li>
        <li style="margin-bottom:0;">Your tracked topics, follows, and preferences are safe and will return with the site</li>
      </ul>
    </div>
    <p style="margin:0 0 16px 0;">
      We'll be back online as soon as we can — typically within ${returnWindow}.
      Thank you for your patience and for staying engaged with state legislation.
    </p>
    ${
      extraNote
        ? `<p style="margin:0 0 16px 0;">${extraNote}</p>`
        : ''
    }
    <p style="margin:0;">
      Questions? Reply to this email or write us at
      <a href="mailto:${b.contactEmail}" style="color:${b.primary};">${b.contactEmail}</a>.
    </p>
  `;
}

export function buildRestoredMessage({
  extraNote,
}: {
  extraNote?: string;
} = {}): string {
  const b = EMAIL_BRAND;
  return `
    <p style="margin:0 0 16px 0;">Hi there,</p>
    <p style="margin:0 0 16px 0;">
      Good news — <strong>StatePulse is back online</strong>. Maintenance is complete and the site
      is available again at
      <a href="${b.siteUrl}" style="color:${b.primary};">${b.siteUrl.replace(/^https?:\/\//, '')}</a>.
    </p>
    <div style="background:${b.panel};border:1px solid ${b.border};border-radius:${b.radiusLg};padding:16px;margin:0 0 16px 0;">
      <p style="margin:0 0 8px 0;font-family:${b.fontHeadline};font-weight:600;color:${b.foreground};">What's working again</p>
      <ul style="margin:0;padding-left:18px;color:${b.secondary};">
        <li style="margin-bottom:6px;">Browse and search legislation across all states</li>
        <li style="margin-bottom:6px;">Daily and weekly email digests will resume on their normal schedule</li>
        <li style="margin-bottom:0;">Your tracked topics, follows, and preferences are intact</li>
      </ul>
    </div>
    <p style="margin:0 0 16px 0;">
      Thanks for sticking with us through the downtime. We're glad to have you back.
    </p>
    ${
      extraNote
        ? `<p style="margin:0 0 16px 0;">${extraNote}</p>`
        : ''
    }
    <p style="margin:0;">
      Questions? Reply to this email or write us at
      <a href="mailto:${b.contactEmail}" style="color:${b.primary};">${b.contactEmail}</a>.
    </p>
  `;
}

export function renderMaintenanceAnnouncementEmail({
  template = 'downtime',
  heading,
  returnWindow,
  extraNote,
  messageHtml,
}: {
  template?: BroadcastTemplate;
  heading?: string;
  returnWindow?: string;
  extraNote?: string;
  /** Override the full message body HTML if provided */
  messageHtml?: string;
} = {}) {
  const resolvedHeading =
    heading ||
    (template === 'restored' ? DEFAULT_RESTORED_HEADING : DEFAULT_MAINTENANCE_HEADING);

  const message =
    messageHtml ||
    (template === 'restored'
      ? buildRestoredMessage({ extraNote })
      : buildMaintenanceMessage({ returnWindow, extraNote }));

  return renderBrandedEmail({
    heading: resolvedHeading,
    message,
    ctaUrl: EMAIL_BRAND.siteUrl,
    ctaText: template === 'restored' ? 'Open StatePulse' : 'Visit StatePulse',
    preheader:
      template === 'restored'
        ? 'StatePulse is back online. Digests resume and your tracked topics are intact.'
        : 'StatePulse is temporarily down for maintenance and will be back in a week or two.',
    footerNote: `This is a service announcement from StatePulse.<br/><a href="mailto:${EMAIL_BRAND.contactEmail}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;">Contact us</a>`,
  });
}

export function getBroadcastDefaults(template: BroadcastTemplate = 'downtime') {
  if (template === 'restored') {
    return {
      template: 'restored' as const,
      subject: DEFAULT_RESTORED_SUBJECT,
      heading: DEFAULT_RESTORED_HEADING,
      returnWindow: '',
      confirmPhrase: 'SEND RESTORED',
    };
  }
  return {
    template: 'downtime' as const,
    subject: DEFAULT_MAINTENANCE_SUBJECT,
    heading: DEFAULT_MAINTENANCE_HEADING,
    returnWindow: 'a week or two',
    confirmPhrase: 'SEND DOWNTIME',
  };
}
