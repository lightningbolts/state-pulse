/**
 * Email brand tokens aligned with the StatePulse website theme (globals.css).
 * Hex values are used because most email clients do not support CSS variables or HSL.
 */

export const EMAIL_BRAND = {
  background: '#f4f2ee',
  surface: '#faf9f7',
  card: '#ffffff',
  foreground: '#1a2332',
  primary: '#1e3a5f',
  primaryForeground: '#ffffff',
  secondary: '#3d4a5c',
  muted: '#e8e5df',
  mutedForeground: '#5c6573',
  border: '#d4d0c8',
  borderStrong: '#b8b2a8',
  panel: '#f0eeea',
  link: '#1e3a5f',
  summaryBg: '#eef2f7',
  summaryBorder: '#c5d0de',
  sponsorshipBg: '#f0f7f2',
  sponsorshipBorder: '#b7d4c0',
  sponsorshipAccent: '#166534',
  statusBg: '#f0eeea',
  radius: '4px',
  radiusLg: '6px',
  fontBody: "'DM Sans', Arial, Helvetica, sans-serif",
  fontHeadline: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  siteUrl: 'https://statepulse.me',
  trackerUrl: 'https://statepulse.me/tracker',
  contactEmail: 'contact@statepulse.me',
} as const;

export type EmailBrand = typeof EMAIL_BRAND;

/** Google Fonts link for clients that support linked stylesheets. */
export const EMAIL_FONTS_LINK =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap";

export function emailSectionHeading(title: string): string {
  const b = EMAIL_BRAND;
  return `<h2 style="margin:1.75em 0 0.85em 0;font-family:${b.fontHeadline};font-size:1.25em;font-weight:600;color:${b.primary};border-bottom:1px solid ${b.border};padding-bottom:10px;">${title}</h2>`;
}

export function emailSubheading(title: string): string {
  const b = EMAIL_BRAND;
  return `<h3 style="margin:1.35em 0 0.5em 0;font-family:${b.fontHeadline};font-size:1.05em;font-weight:600;color:${b.foreground};">${title}</h3>`;
}

export function emailMutedNote(text: string): string {
  const b = EMAIL_BRAND;
  return `<p style="margin:0 0 1em 0;font-size:0.9em;color:${b.mutedForeground};text-align:center;font-family:${b.fontBody};"><em>${text}</em></p>`;
}

export function emailSummaryBox(title: string, bodyHtml: string): string {
  const b = EMAIL_BRAND;
  return `
    <div style="background:${b.panel};border:1px solid ${b.border};border-radius:${b.radiusLg};padding:16px;margin-bottom:24px;text-align:center;font-family:${b.fontBody};">
      <h3 style="margin:0 0 8px 0;color:${b.foreground};font-size:1.05em;font-family:${b.fontHeadline};font-weight:600;">${title}</h3>
      <p style="margin:0;color:${b.mutedForeground};font-size:0.95em;line-height:1.55;">
        ${bodyHtml}
      </p>
    </div>
  `;
}

export function emailAiSummary(summary: string, accentColor?: string): string {
  const b = EMAIL_BRAND;
  const accent = accentColor || b.primary;
  const truncated =
    summary.length > 200 ? `${summary.substring(0, 200)}...` : summary;
  return `<div style="background:${b.summaryBg};border:1px solid ${b.summaryBorder};border-radius:${b.radiusLg};padding:12px;margin-bottom:10px;"><b style="color:${accent};font-family:${b.fontBody};">AI Summary:</b><br/><span style="font-size:0.97em;color:${b.foreground};font-family:${b.fontBody};line-height:1.5;">${truncated}</span></div>`;
}

export function emailTopicBillCard(legislation: {
  id: string;
  identifier?: string;
  title?: string;
  statusText?: string;
  classification?: string[];
  session?: string;
  jurisdictionName?: string;
  chamber?: string;
  latestActionAt?: string | Date;
  geminiSummary?: string;
}): string {
  const b = EMAIL_BRAND;
  const url = `${b.siteUrl}/legislation/${legislation.id}`;
  const title = `${legislation.identifier || 'Bill'}: ${legislation.title || 'Untitled'}`;
  const types = (legislation.classification || [])
    .map(
      (type) =>
        `<span style="display:inline-block;border:1px solid ${b.border};border-radius:${b.radius};padding:2px 8px;font-size:0.85em;margin-right:4px;color:${b.secondary};">${type}</span>`,
    )
    .join('');

  return `
    <div style="border:1px solid ${b.border};border-radius:${b.radiusLg};padding:20px;margin-bottom:16px;background:${b.card};font-family:${b.fontBody};">
      <div style="margin-bottom:12px;">
        <a href="${url}" style="font-size:1.05em;font-weight:600;color:${b.link};text-decoration:none;font-family:${b.fontHeadline};">${title}</a>
      </div>
      <div style="margin-bottom:8px;">
        ${
          legislation.statusText
            ? `<span style="display:inline-block;background:${b.statusBg};color:${b.foreground};border-radius:${b.radius};padding:2px 8px;font-size:0.85em;margin-right:4px;">${legislation.statusText}</span>`
            : ''
        }
        ${types}
      </div>
      <div style="font-size:0.95em;color:${b.mutedForeground};margin-bottom:8px;">
        ${legislation.session || ''}${legislation.session && legislation.jurisdictionName ? ' — ' : ''}${legislation.jurisdictionName || ''}${legislation.chamber ? ` (${legislation.chamber})` : ''}
      </div>
      ${
        legislation.latestActionAt
          ? `<div style="font-size:0.9em;color:${b.foreground};margin-bottom:8px;"><strong>Last Action:</strong> ${new Date(legislation.latestActionAt).toLocaleDateString()}</div>`
          : ''
      }
      ${legislation.geminiSummary ? emailAiSummary(legislation.geminiSummary) : ''}
      <div style="margin-top:10px;">
        <a href="${url}" style="border:1px solid ${b.borderStrong};border-radius:${b.radius};padding:6px 14px;font-size:0.95em;color:${b.primary};text-decoration:none;background:${b.surface};display:inline-block;">View Details</a>
      </div>
    </div>
  `;
}

export function emailSponsorshipBillCard(legislation: {
  id: string;
  identifier?: string;
  title?: string;
  session?: string;
  jurisdictionName?: string;
  chamber?: string;
  date_signed?: string | Date;
  createdAt?: string | Date;
  geminiSummary?: string;
}): string {
  const b = EMAIL_BRAND;
  const url = `${b.siteUrl}/legislation/${legislation.id}`;
  const title = `${legislation.identifier || 'New Bill'}: ${legislation.title || 'Untitled'}`;
  const introduced = legislation.date_signed || legislation.createdAt;

  return `
    <div style="border:1px solid ${b.sponsorshipBorder};border-radius:${b.radiusLg};padding:20px;margin-bottom:16px;background:${b.sponsorshipBg};font-family:${b.fontBody};">
      <div style="margin-bottom:12px;">
        <a href="${url}" style="font-size:1.05em;font-weight:600;color:${b.sponsorshipAccent};text-decoration:none;font-family:${b.fontHeadline};">${title}</a>
      </div>
      <div style="font-size:0.95em;color:${b.mutedForeground};margin-bottom:8px;">
        ${legislation.session || ''}${legislation.session && legislation.jurisdictionName ? ' — ' : ''}${legislation.jurisdictionName || ''}${legislation.chamber ? ` (${legislation.chamber})` : ''}
      </div>
      ${
        introduced
          ? `<div style="font-size:0.9em;color:${b.foreground};margin-bottom:8px;"><strong>Date Introduced:</strong> ${new Date(introduced).toLocaleDateString()}</div>`
          : ''
      }
      ${legislation.geminiSummary ? emailAiSummary(legislation.geminiSummary, b.sponsorshipAccent) : ''}
      <div style="margin-top:10px;">
        <a href="${url}" style="border:1px solid ${b.sponsorshipAccent};border-radius:${b.radius};padding:6px 14px;font-size:0.95em;color:${b.sponsorshipAccent};text-decoration:none;background:${b.card};display:inline-block;">View Details</a>
      </div>
    </div>
  `;
}
