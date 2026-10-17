import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import { getStoreSettings, checkRateLimit } from "./settings";
import { recordInternalEvent } from "./events";

export interface SubmitFeedbackInput {
  attemptId: string;
  userId?: string | null;
  guestIdentifier?: string | null;
  reasons?: string[];
  comment?: string | null;
  skipped?: boolean;
  ipAddress?: string | null;
}

export interface CheckoutFeedbackRecord {
  id: string;
  feedbackId?: string;
  attemptId: string;
  userId: string | null;
  guestIdentifier: string | null;
  reasons: string[];
  comment: string | null;
  skipped: boolean;
  ipAddress: string | null;
  createdAt: Date;
}

export class FeedbackValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "FeedbackValidationError";
    this.statusCode = statusCode;
  }
}

/**
 * Sanitizes customer comment text.
 * Limits to 300 characters and removes dangerous HTML/script tags.
 */
export function sanitizeFeedbackComment(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const stripped = raw
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, 300);
}

/**
 * Persists customer checkout abandonment feedback.
 *
 * Guarantees:
 * 1. Rate limiting: Max 10 feedback submissions per 15 minutes per IP.
 * 2. Attempt validation: Verifies checkout attempt exists.
 * 3. Unique guard: Enforces one submission per attempt (subsequent calls rejected with 409 Conflict).
 * 4. Reason validation: Validates against store-configured allowed reasons unless skipped.
 * 5. Sanitizes comment (max 300 chars, neutralizes HTML).
 * 6. Records `feedback_submitted` in `internal_events`.
 */
export async function submitCheckoutFeedback(
  input: SubmitFeedbackInput
): Promise<CheckoutFeedbackRecord> {
  const cleanAttemptId = String(input.attemptId || "").trim();
  if (!cleanAttemptId) {
    throw new FeedbackValidationError("Attempt ID is required", 400);
  }

  // 1. Rate limiting check (using persistent rate_limits table from Migration 007)
  const clientIp = input.ipAddress?.trim() || "127.0.0.1";
  const rateLimitKey = `feedback:${clientIp}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 10, 15 * 60);
  if (!rateLimitResult.allowed) {
    throw new FeedbackValidationError("Too many feedback submissions. Please try again later.", 429);
  }

  // 2. Check store settings to verify feedback feature is enabled
  const settings = await getStoreSettings();
  if (settings.feedbackEnabled === false) {
    throw new FeedbackValidationError("Feedback collection is currently disabled", 400);
  }

  // 3. Verify attempt existence and ensure feedback hasn't already been submitted
  const attemptRows = await query<any[]>(
    "SELECT id, user_id FROM checkout_attempts WHERE id = ? LIMIT 1",
    [cleanAttemptId]
  );
  if (!attemptRows || attemptRows.length === 0) {
    throw new FeedbackValidationError("Checkout attempt not found", 404);
  }
  const attempt = attemptRows[0];
  if (!input.userId) {
    throw new FeedbackValidationError("Authentication required to submit feedback", 401);
  }
  if (attempt.user_id && attempt.user_id !== input.userId) {
    throw new FeedbackValidationError("Forbidden: Unauthorized attempt access", 403);
  }

  const existingFeedback = await query<any[]>(
    "SELECT id FROM checkout_feedback WHERE attempt_id = ? LIMIT 1",
    [cleanAttemptId]
  );
  if (existingFeedback && existingFeedback.length > 0) {
    throw new FeedbackValidationError("Feedback has already been submitted for this checkout attempt", 409);
  }

  const isSkipped = Boolean(input.skipped);
  let reasons: string[] = [];

  if (!isSkipped) {
    if (!Array.isArray(input.reasons) || input.reasons.length === 0) {
      throw new FeedbackValidationError("Please select at least one reason, or choose Skip", 400);
    }

    const allowedReasons = new Set<string>(
      (settings.feedbackReasons || []).map((r) => r.trim().toLowerCase())
    );

    for (const r of input.reasons) {
      const cleanR = String(r || "").trim();
      if (!cleanR) continue;
      if (!allowedReasons.has(cleanR.toLowerCase())) {
        throw new FeedbackValidationError(`Invalid feedback reason: '${cleanR}'`, 400);
      }
      reasons.push(cleanR);
    }

    if (reasons.length === 0) {
      throw new FeedbackValidationError("At least one valid reason must be selected", 400);
    }
  }

  const sanitizedComment = sanitizeFeedbackComment(input.comment);
  if (input.comment && typeof input.comment === "string" && input.comment.trim().length > 300) {
    throw new FeedbackValidationError("Comment cannot exceed 300 characters", 400);
  }

  const id = crypto.randomUUID();
  const userId = input.userId ? String(input.userId).trim() : attempt.user_id || null;

  await query(
    `INSERT INTO checkout_feedback (
       id, attempt_id, user_id, reasons, comment, skipped, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      id,
      cleanAttemptId,
      userId,
      JSON.stringify(reasons),
      sanitizedComment,
      isSkipped ? 1 : 0,
    ]
  );

  await recordInternalEvent({
    eventType: "feedback_submitted",
    attemptId: cleanAttemptId,
    userId,
    metadata: {
      skipped: isSkipped,
      reasonsCount: reasons.length,
      hasComment: Boolean(sanitizedComment),
    },
  });

  await recordInternalEvent({
    eventType: "feedback.submitted",
    attemptId: cleanAttemptId,
    userId,
    metadata: {
      skipped: isSkipped,
      reasonsCount: reasons.length,
      hasComment: Boolean(sanitizedComment),
    },
  });

  return {
    id,
    feedbackId: id,
    attemptId: cleanAttemptId,
    userId,
    guestIdentifier: null,
    reasons,
    comment: sanitizedComment,
    skipped: isSkipped,
    ipAddress: clientIp,
    createdAt: new Date(),
  };
}

/**
 * Retrieves feedback record for a specific attempt.
 */
export async function getFeedbackForAttempt(
  attemptId: string,
  userId?: string
): Promise<CheckoutFeedbackRecord | null> {
  const cleanId = String(attemptId || "").trim();
  if (!cleanId) return null;

  const rows = await query<any[]>(
    "SELECT * FROM checkout_feedback WHERE attempt_id = ? LIMIT 1",
    [cleanId]
  );
  if (!rows || rows.length === 0) return null;

  const row = rows[0];
  if (userId && row.user_id && row.user_id !== userId) {
    return null;
  }
  let parsedReasons: string[] = [];
  try {
    parsedReasons = typeof row.reasons === "string" ? JSON.parse(row.reasons) : row.reasons || [];
  } catch {}

  return {
    id: row.id,
    attemptId: row.attempt_id,
    userId: row.user_id || null,
    guestIdentifier: null,
    reasons: parsedReasons,
    comment: row.comment || null,
    skipped: Boolean(row.skipped === 1 || row.skipped === true),
    ipAddress: null,
    createdAt: new Date(row.created_at),
  };
}

export async function getAttemptFeedback(
  attemptId: string
): Promise<CheckoutFeedbackRecord[]> {
  const fb = await getFeedbackForAttempt(attemptId);
  return fb ? [fb] : [];
}
