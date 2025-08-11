import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;

if (!smtpUser || !smtpPass || !smtpFrom || !smtpHost || !smtpPort) {
    throw new Error('Missing SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_HOST, or SMTP_PORT in environment variables');
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for 587
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const mailOptions = {
    from: smtpFrom,
    to,
    subject,
    html,
    text,
  };
  return transporter.sendMail(mailOptions);
}
