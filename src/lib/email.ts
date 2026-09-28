import nodemailer from "nodemailer";

// Two ways to send:
// - BREVO_API_KEY: Brevo's HTTPS API. Railway blocks outbound SMTP on the
//   Free, Trial and Hobby plans, so this is the one that works there.
// - SMTP_HOST (+ SMTP_PORT/USER/PASS): any SMTP server, for Pro plans or
//   other hosts.
// With neither set, emails are logged and skipped.

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

const DEFAULT_FROM = "Rocket League Team <no-reply@example.com>";

// Splits "RL Team Hub <team@gmail.com>" into its name and address.
export function parseFrom(from: string): { name?: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (!m) return { email: from.trim() };
  const name = m[1].replace(/^"|"$/g, "").trim();
  return name ? { name, email: m[2] } : { email: m[2] };
}

async function sendWithBrevo(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendEmail(to: string, subject: string, html: string) {
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  const brevoKey = process.env.BREVO_API_KEY;
  const t = brevoKey ? null : getTransporter();
  if (!brevoKey && !t) {
    console.warn(`[email] No email service configured, skipping email to ${to}: ${subject}`);
    return;
  }
  try {
    if (brevoKey) await sendWithBrevo(brevoKey, from, to, subject, html);
    else await t!.sendMail({ from, to, subject, html });
    console.log(`[email] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err);
  }
}
