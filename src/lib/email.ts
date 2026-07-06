import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;

  if (!smtpUser || !smtpPass || !smtpFrom || !smtpHost || !smtpPort) {
    throw new Error(
      'Missing SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_HOST, or SMTP_PORT in environment variables',
    );
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const smtpFrom = process.env.SMTP_FROM;
  if (!smtpFrom) {
    throw new Error('Missing SMTP_FROM in environment variables');
  }

  const mailOptions = {
    from: smtpFrom,
    to,
    subject,
    html,
    text,
  };

  return getTransporter().sendMail(mailOptions);
}
