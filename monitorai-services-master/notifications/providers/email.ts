import "@dotenvx/dotenvx/config";
import nodemailer from "nodemailer";
import log from "encore.dev/log";

export const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT
    ? parseInt(process.env.EMAIL_SMTP_PORT)
    : 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
  from: process.env.EMAIL_FROM,
});

export async function sendMail(details: {
  to: string;
  cc?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: any[];
}) {
  try {
    mailer.sendMail({
      to: details.to,
      cc: details.cc,
      subject: details.subject || `Уведомление из ${process.env.DIRECTUS_URL}`,
      text: details.text, // plain‑text body
      attachments: details.attachments,
      html: details.html,
    });
  } catch (e) {
    log.error(e);
  }
}
