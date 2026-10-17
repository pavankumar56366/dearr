import "server-only";
import crypto from "crypto";
import { Resend } from "resend";
import { query } from "./db";

// =============================================================================
// Constants & Configuration
// =============================================================================

export const DEFAULT_SENDER = "Dearr <notifications@dearr.in>";
export const DEFAULT_SUPPORT_EMAIL = "support@dearr.in";
export const DEFAULT_DAILY_BUDGET_CAP = 80; // Buffer for 100/day free-tier allowance

export type TransactionalEmailType = "password_reset_otp" | "payment_confirmation";

export interface PasswordResetEmailParams {
  email: string;
  fullName?: string;
  otp: string;
}

export interface PaymentConfirmationEmailParams {
  email: string;
  customerName?: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  itemsSummary?: Array<{ title: string; quantity: number; price: number }>;
}

export interface EmailDispatchResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  budgetExceeded?: boolean;
  disabled?: boolean;
}

export function isEmailSendingEnabled(): boolean {
  return process.env.RESEND_EMAILS_ENABLED === "true";
}

let cachedResendClient: any = null;

export function setResendClientForTesting(client: any): void {
  cachedResendClient = client;
}

function getResendClient(): Resend | null {
  if (cachedResendClient) {
    return cachedResendClient;
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  cachedResendClient = new Resend(apiKey);
  return cachedResendClient;
}

/**
 * Escapes dynamic content for safe HTML interpolation to prevent HTML/XSS injection.
 */
export function escapeHtml(unsafe: string): string {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Returns current UTC date string in YYYY-MM-DD format for budget accounting.
 */
function getUtcDayString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Checks and records daily email usage against the configured free-tier budget cap.
 * Concurrency-safe: uses atomic single-statement update to strictly prevent exceeding the daily cap.
 */
async function checkAndRecordBudget(): Promise<{ allowed: boolean; count: number; cap: number }> {
  const cap = parseInt(process.env.RESEND_DAILY_BUDGET_CAP || String(DEFAULT_DAILY_BUDGET_CAP), 10);
  const dayKey = `resend:budget:${getUtcDayString()}`;
  const now = new Date();
  const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

  try {
    // 1. Ensure daily budget tracking row exists without InnoDB gap-lock deadlocks
    await query(
      `INSERT INTO rate_limits (rate_key, hits, reset_at)
       VALUES (?, 0, ?)
       ON DUPLICATE KEY UPDATE rate_key = rate_key`,
      [dayKey, nextUtcMidnight]
    );

    // 2. Atomically increment only if current hits are strictly under the budget cap
    const updateRes: any = await query(
      `UPDATE rate_limits
       SET hits = hits + 1
       WHERE rate_key = ? AND hits < ?`,
      [dayKey, cap]
    );

    const affected = updateRes?.affectedRows ?? 0;

    // 3. Query current hits for accurate reporting / logging
    const countRows = await query<any[]>(
      `SELECT hits FROM rate_limits WHERE rate_key = ? LIMIT 1`,
      [dayKey]
    );
    const currentHits = Number(countRows?.[0]?.hits ?? 0);

    if (affected === 0) {
      console.warn(`[Resend Safeguard] Daily email budget reached: ${currentHits}/${cap} for UTC date ${getUtcDayString()}`);
      return { allowed: false, count: currentHits, cap };
    }

    return { allowed: true, count: currentHits, cap };
  } catch (err: any) {
    console.warn("[Resend Safeguard] Budget tracking check error (failing open for safety):", err?.message);
    return { allowed: true, count: 1, cap };
  }
}

// =============================================================================
// Email Templates
// =============================================================================

export function renderPasswordResetOtpTemplate(params: {
  fullName?: string;
  otp: string;
}): { subject: string; text: string; html: string } {
  const safeName = params.fullName ? escapeHtml(params.fullName) : "Customer";
  const safeOtp = escapeHtml(params.otp);
  const supportEmail = escapeHtml(process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL);

  const subject = `Your Dearr Password Reset Code: ${safeOtp}`;

  const text = `Hello ${params.fullName || "Customer"},

You recently requested to reset your password for your Dearr account.

Your verification code is: ${params.otp}

This code is valid for 10 minutes and can only be used once. For your security, never share this code with anyone.

If you did not request a password reset, you can safely ignore this email.

Need assistance? Contact our support team at ${supportEmail}.

Warm regards,
The Dearr Team
https://dearr.in
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F7F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E1E1E; }
    .container { max-width: 560px; margin: 40px auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E5E3DC; overflow: hidden; }
    .header { background: #1E1E1E; padding: 24px 32px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #A2CB8B; letter-spacing: 0.5px; }
    .body { padding: 32px; }
    .greeting { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .intro { font-size: 14px; line-height: 1.6; color: #4A4A4A; margin-bottom: 24px; }
    .otp-box { background: #F4F1E8; border: 2px dashed #A2CB8B; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; color: #555555; margin-bottom: 6px; }
    .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E1E1E; font-family: 'Courier New', Courier, monospace; margin: 0; }
    .notice { font-size: 12px; line-height: 1.5; color: #767676; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E3DC; }
    .footer { background: #FAFAF8; padding: 20px 32px; text-align: center; font-size: 11px; color: #888888; border-top: 1px solid #EEEEEE; }
    .footer a { color: #555555; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DEARR</h1>
    </div>
    <div class="body">
      <div class="greeting">Hello ${safeName},</div>
      <div class="intro">
        You recently requested to reset the password for your Dearr account. Enter the verification code below on the password reset page to choose a new password.
      </div>
      <div class="otp-box">
        <div class="otp-label">Verification Code</div>
        <p class="otp-code">${safeOtp}</p>
      </div>
      <div class="notice">
        <strong>Security Notice:</strong> This code expires in 10 minutes and can only be used once. If you did not make this request, your account is still secure and you can safely disregard this email.
      </div>
    </div>
    <div class="footer">
      Questions? Reach us at <a href="mailto:${supportEmail}">${supportEmail}</a><br>
      © 2026 Dearr • 3D Printed Collectibles & Custom Artifacts • <a href="https://dearr.in">dearr.in</a>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

export function renderPaymentConfirmationTemplate(params: {
  customerName?: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  itemsSummary?: Array<{ title: string; quantity: number; price: number }>;
}): { subject: string; text: string; html: string } {
  const safeName = params.customerName ? escapeHtml(params.customerName) : "Customer";
  const safeOrderNumber = escapeHtml(params.orderNumber);
  const safeOrderId = escapeHtml(params.orderId);
  const currency = params.currency || "INR";
  const currencySymbol = currency === "INR" ? "₹" : `${currency} `;
  const formattedAmount = `${currencySymbol}${params.amount.toFixed(2)}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://dearr.in").replace(/\/$/, "");
  const orderUrl = `${appUrl}/orders/${encodeURIComponent(params.orderId)}`;
  const supportEmail = escapeHtml(process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL);
  const formattedDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const subject = `Payment Confirmed: Order #${safeOrderNumber} — Dearr`;

  let itemsText = "";
  let itemsHtml = "";
  if (params.itemsSummary && params.itemsSummary.length > 0) {
    itemsText = "\nItems Ordered:\n" + params.itemsSummary
      .map((item) => `- ${item.title} (x${item.quantity}) — ${currencySymbol}${(item.price * item.quantity).toFixed(2)}`)
      .join("\n") + "\n";

    itemsHtml = `
      <div style="margin: 20px 0; border: 1px solid #E5E3DC; border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="background: #FAFAF8; border-bottom: 1px solid #E5E3DC;">
            <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #555555;">Item</th>
            <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #555555;">Qty</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #555555;">Price</th>
          </tr>
          ${params.itemsSummary.map((item) => `
            <tr style="border-bottom: 1px solid #EEEEEE;">
              <td style="padding: 10px 12px; color: #1E1E1E;">${escapeHtml(item.title)}</td>
              <td style="padding: 10px 12px; text-align: center; color: #555555;">${item.quantity}</td>
              <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: #1E1E1E;">${currencySymbol}${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  const text = `Hello ${params.customerName || "Customer"},

Thank you for your order! Your payment has been successfully confirmed.

Order Summary:
- Order Number: #${params.orderNumber}
- Amount Paid: ${formattedAmount}
- Date: ${formattedDate}
- Status: Confirmed & Queued for Workshop Production
${itemsText}
You can track your order progress anytime at:
${orderUrl}

If you have any questions about your order, simply reply to this email or reach our workshop team at ${supportEmail}.

Warm regards,
The Dearr Team
https://dearr.in
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F7F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E1E1E; }
    .container { max-width: 580px; margin: 40px auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E5E3DC; overflow: hidden; }
    .header { background: #1E1E1E; padding: 24px 32px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #A2CB8B; letter-spacing: 0.5px; }
    .body { padding: 32px; }
    .badge { display: inline-block; background: #E9F4E3; color: #2E6B18; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; color: #1E1E1E; }
    .subtitle { font-size: 14px; color: #555555; margin-bottom: 24px; line-height: 1.5; }
    .order-card { background: #FAFAF8; border: 1px solid #E5E3DC; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
    .order-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .order-row-label { color: #666666; }
    .order-row-val { font-weight: 600; color: #1E1E1E; text-align: right; }
    .order-total { border-top: 1px solid #E5E3DC; margin-top: 8px; padding-top: 10px; font-size: 15px; font-weight: 700; color: #1E1E1E; }
    .action-btn { display: block; text-align: center; background: #A2CB8B; color: #1E1E1E; font-weight: 700; font-size: 14px; padding: 14px 24px; border-radius: 10px; text-decoration: none; margin: 28px 0 16px 0; }
    .footer { background: #FAFAF8; padding: 20px 32px; text-align: center; font-size: 11px; color: #888888; border-top: 1px solid #EEEEEE; }
    .footer a { color: #555555; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DEARR</h1>
    </div>
    <div class="body">
      <div class="badge">✓ Payment Received</div>
      <h2 class="title">Thank you for your order, ${safeName}!</h2>
      <p class="subtitle">
        Your payment of <strong>${formattedAmount}</strong> has been successfully captured. We've queued your custom 3D printed artifacts for precision production.
      </p>

      <div class="order-card">
        <div class="order-row">
          <span class="order-row-label">Order Number:</span>
          <span class="order-row-val">#${safeOrderNumber}</span>
        </div>
        <div class="order-row">
          <span class="order-row-label">Payment Date:</span>
          <span class="order-row-val">${formattedDate}</span>
        </div>
        <div class="order-row">
          <span class="order-row-label">Payment Method:</span>
          <span class="order-row-val">Online (Razorpay Verified)</span>
        </div>
        <div class="order-row order-total">
          <span class="order-row-label">Total Amount Paid:</span>
          <span class="order-row-val">${formattedAmount}</span>
        </div>
      </div>

      ${itemsHtml}

      <a href="${orderUrl}" class="action-btn">Track Order Progress →</a>

      <p style="font-size: 12px; color: #767676; text-align: center; margin: 0;">
        You can review your order and download VAT/GST tax receipts at any time from your customer dashboard.
      </p>
    </div>
    <div class="footer">
      Questions? Reach our workshop team at <a href="mailto:${supportEmail}">${supportEmail}</a><br>
      © 2026 Dearr • 3D Printed Collectibles & Custom Artifacts • <a href="https://dearr.in">dearr.in</a>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

// =============================================================================
// Core Service Sending Functions
// =============================================================================

/**
 * Sends a password reset OTP transactional email through Resend.
 */
export async function sendPasswordResetOtp(
  params: PasswordResetEmailParams
): Promise<EmailDispatchResult> {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Valid recipient email address is required" };
  }

  const { subject, text, html } = renderPasswordResetOtpTemplate({
    fullName: params.fullName,
    otp: params.otp,
  });

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_SENDER;
  if (!isEmailSendingEnabled()) {
    console.log(`[EmailService:Simulated] (RESEND_EMAILS_ENABLED=false) Password reset OTP for ${cleanEmail} generated and suppressed safely.`);
    return {
      ok: false,
      skipped: true,
      disabled: true,
      error: "Transactional email sending is disabled (RESEND_EMAILS_ENABLED !== true)",
    };
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn("[EmailService] RESEND_API_KEY is not configured; email dispatch suppressed safely.");
    return { ok: false, error: "Resend API key is not configured on the server" };
  }

  // Budget safeguard check
  const budget = await checkAndRecordBudget();
  if (!budget.allowed) {
    return { ok: false, budgetExceeded: true, error: "Daily email budget allowance reached" };
  }

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: [cleanEmail],
      replyTo: process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
      subject,
      text,
      html,
    });

    if (response.error) {
      console.error("[EmailService] Resend provider returned error:", response.error.message);
      return { ok: false, error: response.error.message };
    }

    return { ok: true, messageId: response.data?.id };
  } catch (err: any) {
    console.error("[EmailService] Resend network/unexpected dispatch error:", err?.message || err);
    return { ok: false, error: err?.message || "Failed to dispatch email via provider" };
  }
}

/**
 * Sends an order payment confirmation transactional email through Resend.
 * Uses a stable idempotency key to prevent duplicate provider dispatches on retries.
 */
export async function sendPaymentConfirmation(
  params: PaymentConfirmationEmailParams,
  idempotencyKey?: string
): Promise<EmailDispatchResult> {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Valid recipient email address is required" };
  }

  const { subject, text, html } = renderPaymentConfirmationTemplate(params);

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_SENDER;
  if (!isEmailSendingEnabled()) {
    console.log(`[EmailService:Simulated] (RESEND_EMAILS_ENABLED=false) Payment confirmation for order ${params.orderNumber} suppressed safely.`);
    return {
      ok: false,
      skipped: true,
      disabled: true,
      error: "Transactional email sending is disabled (RESEND_EMAILS_ENABLED !== true)",
    };
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn("[EmailService] RESEND_API_KEY is not configured; email dispatch suppressed safely.");
    return { ok: false, error: "Resend API key is not configured on the server" };
  }

  // Budget safeguard check
  const budget = await checkAndRecordBudget();
  if (!budget.allowed) {
    return { ok: false, budgetExceeded: true, error: "Daily email budget allowance reached" };
  }

  try {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const response = await resend.emails.send({
      from: fromEmail,
      to: [cleanEmail],
      replyTo: process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
      subject,
      text,
      html,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (response.error) {
      console.error("[EmailService] Resend provider returned error:", response.error.message);
      return { ok: false, error: response.error.message };
    }

    return { ok: true, messageId: response.data?.id };
  } catch (err: any) {
    console.error("[EmailService] Resend network/unexpected dispatch error:", err?.message || err);
    return { ok: false, error: err?.message || "Failed to dispatch email via provider" };
  }
}

// =============================================================================
// Durable Outbox & Retry Mechanism
// =============================================================================

export interface QueueEmailOutboxParams {
  eventType: TransactionalEmailType;
  idempotencyKey: string;
  recipientEmail: string;
  recipientName?: string;
  orderId?: string;
  payload: Record<string, any>;
}

/**
 * Atomically queues an email into the database-backed email_outbox table.
 * Database-level uniqueness on idempotency_key prevents duplicate logical jobs.
 */
export async function queueEmailOutboxJob(
  params: QueueEmailOutboxParams,
  conn?: any
): Promise<{ id: string; isDuplicate: boolean }> {
  const jobId = crypto.randomUUID();
  const cleanEmail = params.recipientEmail.trim().toLowerCase();
  const queryFn = conn ? conn.execute.bind(conn) : query;

  try {
    const sql = `
      INSERT INTO email_outbox (
        id, event_type, idempotency_key, recipient_email, recipient_name,
        order_id, payload, status, attempts, next_retry_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NOW(), NOW(), NOW())
    `;

    await queryFn(sql, [
      jobId,
      params.eventType,
      params.idempotencyKey,
      cleanEmail,
      params.recipientName || null,
      params.orderId || null,
      JSON.stringify(params.payload || {}),
    ]);

    return { id: jobId, isDuplicate: false };
  } catch (err: any) {
    if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
      const existing: any = await queryFn(
        "SELECT id FROM email_outbox WHERE idempotency_key = ? LIMIT 1",
        [params.idempotencyKey]
      );
      const rows = Array.isArray(existing) && Array.isArray(existing[0]) ? existing[0] : existing;
      const existingId = rows?.[0]?.id || jobId;
      return { id: existingId, isDuplicate: true };
    }
    console.error("[queueEmailOutboxJob] Failed to enqueue email job:", err?.message);
    throw err;
  }
}

/**
 * Dispatches a single queued outbox job by ID.
 * Non-blocking safe: network failure updates status to 'failed' and schedules exponential backoff.
 * Concurrency-safe: atomically transitions status to 'processing' to prevent race-condition double dispatches.
 * Crash-recovery: automatically reclaims jobs left in 'processing' by worker crashes older than 5 minutes.
 */
export async function dispatchEmailOutboxJob(jobId: string): Promise<EmailDispatchResult> {
  // If email sending is disabled, never claim or mark outbox jobs as sent.
  // The job remains safely in 'pending' status without incrementing attempts or setting backoff.
  if (!isEmailSendingEnabled()) {
    console.log(`[EmailService:Simulated] (RESEND_EMAILS_ENABLED=false) Outbox dispatch for job ${jobId} suppressed safely; remaining in pending status.`);
    // If the job was somehow stuck in 'processing' (e.g. from an ungraceful crash), safely revert to 'pending'
    await query(
      `UPDATE email_outbox
       SET status = 'pending', updated_at = NOW()
       WHERE id = ? AND status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
      [jobId]
    ).catch(() => {});

    return {
      ok: false,
      skipped: true,
      disabled: true,
      error: "Transactional email sending is disabled (RESEND_EMAILS_ENABLED !== true)",
    };
  }

  // 1. Atomically claim the job to prevent concurrent workers from sending duplicate emails
  const claimResult: any = await query(
    `UPDATE email_outbox
     SET status = 'processing', updated_at = NOW()
     WHERE id = ? AND (
       status IN ('pending', 'failed')
       OR (status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
     )`,
    [jobId]
  );

  const affected = claimResult?.affectedRows ?? 0;
  if (affected === 0) {
    // Check if the job was already completed
    const existing = await query<any[]>(
      `SELECT status, provider_message_id FROM email_outbox WHERE id = ? LIMIT 1`,
      [jobId]
    );
    if (existing && existing.length > 0 && existing[0].status === "sent") {
      return { ok: true, messageId: existing[0].provider_message_id, skipped: true };
    }
    // Another worker is currently processing this job
    return { ok: true, skipped: true };
  }

  // 2. Load the claimed job payload
  const rows = await query<any[]>(
    `SELECT * FROM email_outbox WHERE id = ? LIMIT 1`,
    [jobId]
  );

  if (!rows || rows.length === 0) {
    return { ok: false, error: "Outbox job not found" };
  }

  const job = rows[0];

  let payload: any = {};
  try {
    payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload || {};
  } catch {
    payload = {};
  }

  let result: EmailDispatchResult;
  if (job.event_type === "payment_confirmation") {
    result = await sendPaymentConfirmation(
      {
        email: job.recipient_email,
        customerName: job.recipient_name || undefined,
        orderId: job.order_id || payload.orderId,
        orderNumber: payload.orderNumber || "UNKNOWN",
        amount: Number(payload.amount || 0),
        currency: payload.currency || "INR",
        itemsSummary: payload.itemsSummary,
      },
      job.idempotency_key
    );
  } else if (job.event_type === "password_reset_otp") {
    result = await sendPasswordResetOtp({
      email: job.recipient_email,
      fullName: job.recipient_name || undefined,
      otp: payload.otp,
    });
  } else {
    return { ok: false, error: `Unsupported email event_type: ${job.event_type}` };
  }

  // Defense-in-depth: if sending was disabled or skipped, never mark as sent; revert to 'pending'
  if (result.skipped || result.disabled) {
    await query(
      `UPDATE email_outbox
       SET status = 'pending',
           updated_at = NOW()
       WHERE id = ?`,
      [jobId]
    );
    return result;
  }

  // Real confirmed provider delivery
  if (result.ok && result.messageId) {
    await query(
      `UPDATE email_outbox
       SET status = 'sent',
           provider_message_id = ?,
           sent_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [result.messageId, jobId]
    );
    return result;
  }

  // Failed send: calculate exponential backoff (e.g. 60s, 120s, 240s, capped at 1h)
  const nextAttempts = Number(job.attempts || 0) + 1;
  const backoffSeconds = Math.min(3600, 60 * Math.pow(2, nextAttempts - 1));

  await query(
    `UPDATE email_outbox
     SET status = 'failed',
         attempts = ?,
         next_retry_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
         last_error = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [nextAttempts, backoffSeconds, result.error?.slice(0, 500) || "Unknown dispatch failure", jobId]
  );

  return result;
}

/**
 * Retries eligible failed, pending, or crash-orphaned email jobs up to max_attempts.
 * Protected administrative or cron worker utility.
 */
export async function retryPendingEmailOutboxJobs(limit = 20): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  skipped?: number;
}> {
  if (!isEmailSendingEnabled()) {
    // When sending is disabled, safely reclaim any stale crashed processing jobs back to pending
    const reclaimRes: any = await query(
      `UPDATE email_outbox
       SET status = 'pending', updated_at = NOW()
       WHERE status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
    ).catch(() => ({ affectedRows: 0 }));

    const reclaimed = Number(reclaimRes?.affectedRows ?? 0);
    console.log("[EmailService:Simulated] (RESEND_EMAILS_ENABLED=false) Outbox retry worker skipped; sending is disabled.");
    return {
      processed: reclaimed,
      succeeded: 0,
      failed: 0,
      skipped: reclaimed,
    };
  }

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));

  const jobs = await query<any[]>(
    `SELECT id FROM email_outbox
     WHERE (
       (status IN ('pending', 'failed') AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
       OR (status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
     )
       AND attempts < max_attempts
     ORDER BY created_at ASC
     LIMIT ?`,
    [safeLimit]
  );

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const res = await dispatchEmailOutboxJob(job.id);
    if (res.ok) succeeded++;
    else failed++;
  }

  return {
    processed: jobs.length,
    succeeded,
    failed,
  };
}
