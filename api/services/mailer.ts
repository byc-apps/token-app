import { getEnv } from "../lib/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}
export type Sender = (m: MailMessage) => Promise<void>;

type Transport = { sendMail: (m: Record<string, unknown>) => Promise<unknown> };
let transport: Transport | undefined;

/** Sends through the SMTP relay. Throws if SMTP_HOST / MAIL_FROM are not set. */
export const sendMail: Sender = async (m) => {
  const smtp = getEnv().smtp;
  if (!smtp) throw new Error("SMTP is not configured");
  if (!transport) {
    const nodemailer = await import("nodemailer");
    transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    }) as unknown as Transport;
  }
  await transport.sendMail({ from: smtp.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
};
