import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP not configured, skipping email to ${to}: ${subject}`);
    return;
  }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || "Rocket League Team <no-reply@example.com>",
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err);
  }
}
