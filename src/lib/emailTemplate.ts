import {
  EMAIL_BRAND,
  EMAIL_FONTS_LINK,
} from '@/lib/emailBrand';

export function renderBrandedEmail({
  heading,
  message,
  ctaUrl,
  ctaText,
  preheader,
  footerNote,
}: {
  heading: string;
  message: string;
  ctaUrl?: string;
  ctaText?: string;
  /** Hidden inbox preview text */
  preheader?: string;
  /** Extra footer HTML (defaults to manage-preferences link) */
  footerNote?: string;
}) {
  const b = EMAIL_BRAND;
  const manageUrl = b.trackerUrl;
  const defaultFooter = `You're receiving this because you follow legislation on StatePulse.<br/><a href="${manageUrl}" style="color:${b.primary};text-decoration:underline;">Manage email preferences</a> · <a href="mailto:${b.contactEmail}" style="color:${b.primary};text-decoration:underline;">Contact us</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${heading}</title>
  <link rel="stylesheet" href="${EMAIL_FONTS_LINK}"/>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${b.background};color:${b.foreground};">
  ${
    preheader
      ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>`
      : ''
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${b.background};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${b.card};border:1px solid ${b.border};border-radius:${b.radiusLg};overflow:hidden;">
          <tr>
            <td style="background:${b.primary};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:36px;height:36px;background:${b.primaryForeground};border-radius:${b.radius};text-align:center;vertical-align:middle;">
                    <span style="display:inline-block;font-family:${b.fontHeadline};font-size:14px;font-weight:700;color:${b.primary};line-height:36px;letter-spacing:0.02em;">SP</span>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <span style="font-family:${b.fontHeadline};font-size:20px;font-weight:600;color:${b.primaryForeground};letter-spacing:-0.01em;">StatePulse</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px 28px;">
              <h1 style="margin:0 0 20px 0;font-family:${b.fontHeadline};font-size:26px;line-height:1.3;font-weight:600;color:${b.foreground};">${heading}</h1>
              <div style="font-family:${b.fontBody};font-size:16px;line-height:1.65;color:${b.foreground};">
                ${message}
              </div>
            </td>
          </tr>
          ${
            ctaUrl && ctaText
              ? `<tr>
            <td style="padding:8px 28px 28px 28px;text-align:center;">
              <a href="${ctaUrl}" style="display:inline-block;background:${b.primary};color:${b.primaryForeground};text-decoration:none;padding:12px 28px;border-radius:${b.radius};font-weight:600;font-size:15px;font-family:${b.fontBody};">${ctaText}</a>
            </td>
          </tr>`
              : `<tr><td style="padding-bottom:20px;"></td></tr>`
          }
          <tr>
            <td style="padding:20px 28px;border-top:1px solid ${b.border};background:${b.surface};">
              <p style="margin:0 0 10px 0;text-align:center;font-family:${b.fontBody};font-size:13px;line-height:1.55;color:${b.mutedForeground};">
                ${footerNote || defaultFooter}
              </p>
              <p style="margin:0;text-align:center;font-family:${b.fontBody};font-size:12px;color:${b.mutedForeground};">
                StatePulse — Stay informed. Stay engaged.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
