import "server-only";
import crypto from "crypto";
import { query } from "./db";

export type InternalEventType =
  | "cart_viewed"
  | "checkout_started"
  | "razorpay_opened"
  | "razorpay_dismissed"
  | "payment_failed"
  | "payment_success"
  | "checkout.abandoned"
  | "alternative_viewed"
  | "alternative_swapped"
  | "feedback_submitted"
  | "feedback.submitted"
  | "product.price_changed"
  | "coupon.created";

export interface RecordInternalEventInput {
  eventType: InternalEventType | string;
  attemptId?: string | null;
  orderId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface InternalEventRecord {
  id: string;
  eventType: string;
  attemptId: string | null;
  orderId: string | null;
  userId: string | null;
  sessionId: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

/**
 * Persists an authoritative internal tracking event to `internal_events`.
 * Designed to fail safely (logs error rather than throwing) so telemetry never breaks critical business flows.
 */
export async function recordInternalEvent(
  input: RecordInternalEventInput
): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const eventType = String(input.eventType || "").trim();
    if (!eventType) return null;

    const attemptId = input.attemptId ? String(input.attemptId).trim() : null;
    const orderId = input.orderId ? String(input.orderId).trim() : null;
    const userId = input.userId ? String(input.userId).trim() : null;
    const sessionId = input.sessionId ? String(input.sessionId).trim().slice(0, 100) : null;
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    await query(
      `INSERT INTO internal_events (
         id, event_type, attempt_id, order_id, user_id, session_id, metadata, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, eventType, attemptId, orderId, userId, sessionId, metadataJson]
    );

    return id;
  } catch (err: any) {
    console.error("[INTERNAL_EVENT_RECORD_ERROR]", err?.message || err);
    return null;
  }
}

/**
 * Retrieves internal events by attempt ID or event type.
 */
export async function getInternalEventsForAttempt(
  attemptId: string
): Promise<InternalEventRecord[]> {
  const cleanId = String(attemptId || "").trim();
  if (!cleanId) return [];

  const rows = await query<any[]>(
    `SELECT id, event_type, attempt_id, order_id, user_id, session_id, metadata, created_at
     FROM internal_events
     WHERE attempt_id = ?
     ORDER BY created_at ASC`,
    [cleanId]
  );

  return (rows || []).map((r) => ({
    id: r.id,
    eventType: r.event_type,
    attemptId: r.attempt_id || null,
    orderId: r.order_id || null,
    userId: r.user_id || null,
    sessionId: r.session_id || null,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata || null,
    createdAt: new Date(r.created_at),
  }));
}
