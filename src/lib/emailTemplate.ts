// Branded email template generator for StatePulse
// Usage: import { renderBrandedEmail } from '@/lib/emailTemplate';

export function renderBrandedEmail({
  heading,
  message,
  ctaUrl,
  ctaText,
}: {
  heading: string;
  message: string;
  ctaUrl?: string;
  ctaText?: string;
}) {
  // Updated to match StatePulse theme
  const brandColor = '#73A3A1'; // StatePulse primary (#73A3A1)
  // Geist for headings, Inter for body
  const geistFont = 'Geist, Arial, sans-serif';
  const interFont = 'Inter, Arial, sans-serif';
  const logoUrl = 'https://statepulse.me/logo.png'; // Update if you have a logo

  return `
  <div style="background:${brandColor};padding:40px 0;min-height:100vh;font-family:${interFont};color:#222;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px #0001;padding:32px 24px 24px 24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <img src="${logoUrl}" alt="StatePulse" style="height:48px;margin-bottom:8px;"/>
        <h1 style="color:#222;font-size:2rem;margin:0 0 8px 0;font-family:${geistFont};">${heading}</h1>
      </div>
      <div style="font-size:1.1rem;line-height:1.7;margin-bottom:32px;font-family:${interFont};color:#222;">
        ${message}
      </div>
      ${ctaUrl && ctaText ? `<div style="text-align:center;margin-bottom:16px;"><a href="${ctaUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:1rem;font-family:${geistFont};">${ctaText}</a></div>` : ''}
      <div style="text-align:center;color:#888;font-size:0.95rem;margin-top:32px;font-family:${interFont};">StatePulse &mdash; Stay informed. Stay engaged.</div>
    </div>
  </div>
  `;
}
