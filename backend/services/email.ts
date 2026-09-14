import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || "";
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;

export const isEmailConfigured = Boolean(
  SMTP_HOST &&
  SMTP_USER &&
  SMTP_PASSWORD &&
  MAIL_FROM
);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    })
  : null;

export async function sendVerificationCodeEmail(
  recipient: string,
  code: string
): Promise<void> {
  if (!transporter || !MAIL_FROM) {
    throw new Error(
      "Email delivery is not configured. Add SMTP settings to the environment."
    );
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject: "JOOUST voting identity verification code",
    text: `Your JOOUST voting verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <p>Your JOOUST voting verification code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this message.</p>
    `,
  });
}

export async function sendPasswordResetCodeEmail(
  recipient: string,
  code: string
): Promise<void> {
  if (!transporter || !MAIL_FROM) {
    throw new Error(
      "Email delivery is not configured. Add SMTP settings to the environment."
    );
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject: "JOOUST voting password reset code",
    text: `Your JOOUST voting password reset code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your JOOUST voting password reset code is:</p><p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
}
