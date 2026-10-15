import "server-only";
import crypto from "crypto";
import { query } from "./db";

export type ConsentChannel = "email" | "whatsapp" | "sms";

export interface RecordConsentInput {
  userId?: string | null;
  attemptId?: string | null;
  channel: ConsentChannel;
  contactValue: string;
  consentText: string;
  source?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface NotificationConsentRecord {
  id: string;
  userId: string | null;
  attemptId: string | null;
  channel: ConsentChannel;
  contactValue: string;
  consentText: string;
  source: string;
  isWithdrawn: boolean;
  withdrawnAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ConsentValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ConsentValidationError";
    this.statusCode = statusCode;
  }
}

/**
 * Validates channel contact value format.
 */
function validateContactValue(channel: ConsentChannel, value: string): string {
  const clean = (value || "").trim();
  if (!clean) {
    throw new ConsentValidationError(`Contact value is required for ${channel}`, 400);
  }

  if (channel === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      throw new ConsentValidationError("Invalid email address format", 400);
    }
    return clean.toLowerCase();
  }

  if (channel === "whatsapp" || channel === "sms") {
    // Indian mobile numbers (10 digits starting with 6-9, optionally prefixed with +91)
    const digits = clean.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    if (last10.length !== 10 || !/^[6-9]\d{9}$/.test(last10)) {
      throw new ConsentValidationError(
        `Invalid mobile phone number format for ${channel}. Must be a valid 10-digit Indian mobile number.`,
        400
      );
    }
    return `+91${last10}`;
  }

  throw new ConsentValidationError(`Unsupported notification channel '${channel}'`, 400);
}

/**
 * Persists customer opt-in notification consent (data-only).
 *
 * Guarantees:
 * 1. Explicit consent text is stored verbatim.
 * 2. Unchecked by default; caller must submit explicitly opted channels.
 * 3. Channel and contact value validation.
 * 4. STRICTLY DATA ONLY: Absolutely NO external notification provider is called.
 */
export async function recordNotificationConsent(
  input: RecordConsentInput
): Promise<NotificationConsentRecord> {
  const channel = input.channel;
  if (channel !== "email" && channel !== "whatsapp" && channel !== "sms") {
    throw new ConsentValidationError("Valid channel ('email', 'whatsapp', or 'sms') is required", 400);
  }

  const cleanContact = validateContactValue(channel, input.contactValue);
  const consentText = (input.consentText || "").trim();
  if (consentText.length < 5 || consentText.length > 500) {
    throw new ConsentValidationError("Consent text must be between 5 and 500 characters", 400);
  }

  const id = crypto.randomUUID();
  const userId = input.userId ? String(input.userId).trim() : null;
  const attemptId = input.attemptId ? String(input.attemptId).trim() : null;

  if (attemptId && userId) {
    const attemptRows = await query<any[]>(
      "SELECT user_id FROM checkout_attempts WHERE id = ? LIMIT 1",
      [attemptId]
    );
    if (attemptRows && attemptRows.length > 0 && attemptRows[0].user_id && attemptRows[0].user_id !== userId) {
      throw new ConsentValidationError("Forbidden: Unauthorized attempt access", 403);
    }
  }

  const source = (input.source || "checkout_abandonment").trim().slice(0, 50);
  const ip = input.ipAddress ? String(input.ipAddress).trim().slice(0, 45) : null;
  const ua = input.userAgent ? String(input.userAgent).trim().slice(0, 255) : null;

  await query(
    `INSERT INTO notification_consents (
       id, user_id, attempt_id, channel, contact_value, consent_text,
       source, is_withdrawn, withdrawn_at, ip_address, user_agent, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NOW(), NOW())`,
    [id, userId, attemptId, channel, cleanContact, consentText, source, ip, ua]
  );

  return {
    id,
    userId,
    attemptId,
    channel,
    contactValue: cleanContact,
    consentText,
    source,
    isWithdrawn: false,
    withdrawnAt: null,
    ipAddress: ip,
    userAgent: ua,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Withdraws/unsubscribes customer notification consent.
 */
export async function withdrawNotificationConsent(params: {
  consentId?: string;
  userId?: string;
  contactValue?: string;
  channel?: ConsentChannel;
}): Promise<{ success: boolean; withdrawnCount: number }> {
  let sql = "UPDATE notification_consents SET is_withdrawn = 1, withdrawn_at = NOW(), updated_at = NOW() WHERE is_withdrawn = 0";
  const queryParams: any[] = [];

  if (params.consentId) {
    sql += " AND id = ?";
    queryParams.push(params.consentId);
    if (params.userId) {
      sql += " AND user_id = ?";
      queryParams.push(params.userId);
    }
  } else if (params.userId) {
    sql += " AND user_id = ?";
    queryParams.push(params.userId);
    if (params.channel) {
      sql += " AND channel = ?";
      queryParams.push(params.channel);
    }
  } else if (params.contactValue) {
    sql += " AND contact_value = ?";
    queryParams.push(params.contactValue.trim());
    if (params.channel) {
      sql += " AND channel = ?";
      queryParams.push(params.channel);
    }
  } else {
    throw new ConsentValidationError("A consentId, userId, or contactValue is required to withdraw consent", 400);
  }

  const result: any = await query(sql, queryParams);
  return {
    success: true,
    withdrawnCount: Number(result?.affectedRows || 0),
  };
}

/**
 * Retrieves consent records for a specific checkout attempt.
 */
export async function getConsentsForAttempt(
  attemptId: string,
  userId?: string
): Promise<NotificationConsentRecord[]> {
  const cleanId = String(attemptId || "").trim();
  if (!cleanId) return [];

  const sql = userId
    ? "SELECT * FROM notification_consents WHERE attempt_id = ? AND user_id = ? ORDER BY created_at ASC"
    : "SELECT * FROM notification_consents WHERE attempt_id = ? ORDER BY created_at ASC";
  const params = userId ? [cleanId, userId] : [cleanId];

  const rows = await query<any[]>(sql, params);

  return (rows || []).map((r) => ({
    id: r.id,
    userId: r.user_id || null,
    attemptId: r.attempt_id || null,
    channel: r.channel as ConsentChannel,
    contactValue: r.contact_value,
    consentText: r.consent_text,
    source: r.source,
    isWithdrawn: Boolean(r.is_withdrawn === 1 || r.is_withdrawn === true),
    withdrawnAt: r.withdrawn_at ? new Date(r.withdrawn_at) : null,
    ipAddress: r.ip_address || null,
    userAgent: r.user_agent || null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }));
}

export interface SubscribeNotificationConsentInput {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  channel: ConsentChannel;
  topic?: string;
  sourceAttemptId?: string | null;
  attemptId?: string | null;
  consentText?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function subscribeNotificationConsent(
  input: SubscribeNotificationConsentInput
): Promise<NotificationConsentRecord & { status: string }> {
  const contact =
    input.channel === "email"
      ? input.email || ""
      : input.phone || "";
  const consentText =
    input.consentText ||
    `Consent given to receive updates on ${input.channel} for ${input.topic || "cart recovery"}`;
  const record = await recordNotificationConsent({
    userId: input.userId,
    attemptId: input.sourceAttemptId || input.attemptId,
    channel: input.channel,
    contactValue: contact,
    consentText,
    source: input.topic || "cart_recovery",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return {
    ...record,
    status: "subscribed",
  };
}

export async function getNotificationConsentsForUser(
  userId: string
): Promise<NotificationConsentRecord[]> {
  const cleanId = String(userId || "").trim();
  if (!cleanId) return [];

  const rows = await query<any[]>(
    "SELECT * FROM notification_consents WHERE user_id = ? AND is_withdrawn = 0 ORDER BY created_at DESC",
    [cleanId]
  );

  return (rows || []).map((r) => ({
    id: r.id,
    userId: r.user_id || null,
    attemptId: r.attempt_id || null,
    channel: r.channel as ConsentChannel,
    contactValue: r.contact_value,
    consentText: r.consent_text,
    source: r.source,
    isWithdrawn: Boolean(r.is_withdrawn === 1 || r.is_withdrawn === true),
    withdrawnAt: r.withdrawn_at ? new Date(r.withdrawn_at) : null,
    ipAddress: r.ip_address || null,
    userAgent: r.user_agent || null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }));
}

export async function unsubscribeNotificationConsent(
  userId: string,
  channel?: ConsentChannel
): Promise<{ success: boolean; unsubscribed: boolean; withdrawnCount: number }> {
  const result = await withdrawNotificationConsent({ userId, channel });
  return {
    success: result.success,
    unsubscribed: true,
    withdrawnCount: result.withdrawnCount,
  };
}
