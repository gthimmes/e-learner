import "server-only";
import nodemailer from "nodemailer";

export type Attachment = { filename: string; content: string; contentType: string };
export type Mail = { to: string; subject: string; text: string; html?: string; attachments?: Attachment[] };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Development mailer: prints the message to the server console. */
class ConsoleMailer implements Mailer {
  async send(mail: Mail) {
    const att = mail.attachments?.length ? `\n   Attachments: ${mail.attachments.map((a) => a.filename).join(", ")}` : "";
    console.log(`\n✉  MAIL → ${mail.to}\n   Subject: ${mail.subject}\n${mail.text.split("\n").map((l) => "   " + l).join("\n")}${att}\n`);
  }
}

class SmtpMailer implements Mailer {
  private transport = nodemailer.createTransport(process.env.SMTP_URL);
  async send(mail: Mail) {
    await this.transport.sendMail({ from: process.env.MAIL_FROM || "e-learner <no-reply@localhost>", ...mail });
  }
}

export const mailer: Mailer = process.env.SMTP_URL ? new SmtpMailer() : new ConsoleMailer();

export const appUrl = (path: string) => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}${path}`;
