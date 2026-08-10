import { EMAIL_BRAND } from '@/lib/emailBrand';
import { renderBrandedEmail } from '@/lib/emailTemplate';

export const DEFAULT_MAINTENANCE_SUBJECT =
  'StatePulse is temporarily down — back in 1–2 weeks';

export const DEFAULT_MAINTENANCE_HEADING =
  'StatePulse is temporarily unavailable';

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

export function renderMaintenanceAnnouncementEmail({
  heading = DEFAULT_MAINTENANCE_HEADING,
  returnWindow,
  extraNote,
  messageHtml,
}: {
  heading?: string;
  returnWindow?: string;
  extraNote?: string;
  /** Override the full message body HTML if provided */
  messageHtml?: string;
} = {}) {
  const message =
    messageHtml ||
    buildMaintenanceMessage({ returnWindow, extraNote });

  return renderBrandedEmail({
    heading,
    message,
    ctaUrl: EMAIL_BRAND.siteUrl,
    ctaText: 'Visit StatePulse',
    preheader:
      'StatePulse is temporarily down for maintenance and will be back in a week or two.',
    footerNote: `This is a service announcement from StatePulse.<br/><a href="mailto:${EMAIL_BRAND.contactEmail}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;">Contact us</a>`,
  });
}
