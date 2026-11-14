import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Pool } from "pg";
import type { Config } from "../../../config/environment.js";
import { decryptMail } from "../application/auth.js";
import { authReady } from "../application/readiness.js";

type Message = {
  id: string;
  kind: "verify" | "recover" | "delete";
  ciphertext: string;
  lease_id: string;
  attempts: number;
};
export class MailWorker {
  private readonly transport;
  constructor(
    private readonly pool: Pool,
    private readonly config: Config,
  ) {
    this.transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_TLS === "implicit",
      requireTLS: config.SMTP_TLS === "starttls",
      ignoreTLS: config.SMTP_TLS === "local",
      ...(config.SMTP_USER
        ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
        : {}),
      connectionTimeout: 3000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      dnsTimeout: 2000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  async ready() {
    await authReady(this.pool);
  }
  async tick() {
    await this.pool
      .query(`UPDATE auth_mail SET status='failed',ciphertext=null,lease_id=null,lease_until=null,completed_at=clock_timestamp(),error_code='MAIL_EXPIRED_OR_EXHAUSTED'
      WHERE id IN (SELECT id FROM auth_mail WHERE status in ('queued','running') AND (expires_at<=clock_timestamp() OR (attempts>=5 AND (lease_until IS NULL OR lease_until<=clock_timestamp()))) ORDER BY expires_at LIMIT 100)`);
    const lease = randomUUID();
    const result = await this.pool.query<Message>(
      `WITH candidate AS (
      SELECT id FROM auth_mail WHERE expires_at>clock_timestamp() AND attempts<5 AND available_at<=clock_timestamp()
        AND (status='queued' OR (status='running' AND lease_until<=clock_timestamp())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE auth_mail m SET status='running',attempts=attempts+1,lease_id=$1,lease_until=clock_timestamp()+interval '60 seconds'
      FROM candidate c WHERE m.id=c.id RETURNING m.id,m.kind,m.ciphertext,m.lease_id,m.attempts`,
      [lease],
    );
    const message = result.rows[0];
    if (!message) return;
    try {
      const content = decryptMail(
        this.config.AUTH_SECRET!,
        message.id,
        message.ciphertext,
      );
      const action = {
        verify: "Verify your email",
        recover: "Reset your password",
        delete: "Delete your Rotavise account",
      }[message.kind];
      // No HTML or user-controlled headers. Only one recipient; the same Message-ID on retry.
      const sent = await this.transport.sendMail({
        from: this.config.MAIL_FROM,
        to: content.to,
        subject: `Rotavise: ${action}`,
        text: `${action}:\n${content.url}\n\nIf you did not request this, ignore this message.`,
        messageId: `<${message.id}@${this.config.MAIL_FROM!.split("@")[1]}>`,
      });
      if (sent.rejected?.length || !sent.accepted?.length)
        throw new Error("SMTP_REJECTED");
      await this.pool.query(
        `UPDATE auth_mail SET status='sent',ciphertext=null,lease_id=null,lease_until=null,completed_at=clock_timestamp(),error_code=null WHERE id=$1 AND lease_id=$2 AND status='running'`,
        [message.id, lease],
      );
    } catch {
      await this.pool.query(
        `UPDATE auth_mail SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'queued' END,
        ciphertext=CASE WHEN attempts>=5 THEN null ELSE ciphertext END,lease_id=null,lease_until=null,
        available_at=clock_timestamp()+make_interval(secs=>least(300, power(2, attempts)::int)),
        completed_at=CASE WHEN attempts>=5 THEN clock_timestamp() ELSE null END,error_code='MAIL_DELIVERY_FAILED'
        WHERE id=$1 AND lease_id=$2 AND status='running'`,
        [message.id, lease],
      );
      console.error("MAIL_DELIVERY_FAILED");
    }
  }
  async maintain() {
    await this.pool.query(
      "DELETE FROM auth_mail WHERE id IN (SELECT id FROM auth_mail WHERE completed_at<clock_timestamp()-interval '1 day' ORDER BY completed_at LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM auth_sessions WHERE id IN (SELECT id FROM auth_sessions WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM auth_verifications WHERE id IN (SELECT id FROM auth_verifications WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM auth_rate_limits WHERE id IN (SELECT id FROM auth_rate_limits WHERE last_request<(extract(epoch from clock_timestamp())*1000)-86400000 ORDER BY last_request LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM plan_quotas WHERE key_hash IN (SELECT key_hash FROM plan_quotas WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM auth_users WHERE id IN (SELECT id FROM auth_users WHERE NOT email_verified AND created_at<clock_timestamp()-interval '7 days' ORDER BY created_at LIMIT 100)",
    );
  }
  close() {
    this.transport.close();
  }
}
