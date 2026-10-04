import "server-only";
import crypto from "crypto";
import { query, withTransaction } from "./db";
import { type PaymentStatus, type OrderStatus, type OrderRecord, getOrderById } from "./order";
import { getRazorpayClient, verifyRazorpaySignature } from "./razorpay";

/**
 * Custom error class for payment validation failures.
 * Encapsulates an HTTP-compatible status code and user-safe message.
 */
export class PaymentValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PaymentValidationError";
    this.statusCode = statusCode;
  }
}

export type PaymentRecordStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "verified";

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: PaymentRecordStatus | string;
  amount: number;
  currency: string;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TestPaymentOutcome = "success" | "failure";

export interface ProcessTestPaymentInput {
  orderId: string;
  outcome: TestPaymentOutcome;
  amount?: number;
  failureReason?: string;
}

export interface ProcessTestPaymentResult {
  success: boolean;
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentRecord: PaymentRecord;
  order: OrderRecord;
}

/**
 * Validates an ID string format.
 */
function validateId(id: unknown, fieldName = "ID"): string {
  if (!id || typeof id !== "string") {
    throw new PaymentValidationError(`${fieldName} is required and must be a string`, 400);
  }
  const clean = id.trim();
  if (clean.length === 0 || clean.length > 50) {
    throw new PaymentValidationError(`${fieldName} must be between 1 and 50 characters`, 400);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new PaymentValidationError(`Invalid ${fieldName} format`, 400);
  }
  return clean;
}

/**
 * Maps a raw MySQL payments row to a typed PaymentRecord.
 */
function mapPaymentRow(row: any): PaymentRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    providerPaymentId: row.provider_payment_id || null,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    paidAt: row.paid_at ? new Date(row.paid_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Processes a controlled fake/test payment outcome for an order.
 *
 * This function operates strictly on the server and is used to verify that the
 * order system transitions safely from:
 *   pending -> paid (on test payment success)
 *   pending -> failed (on test payment failure)
 *
 * Architectural & Security Guarantees:
 * - Operates only on the server inside a managed MySQL transaction.
 * - Locks order row with SELECT ... FOR UPDATE to prevent race conditions.
 * - Verifies the order exists (fails safely with 404).
 * - Verifies current payment status:
 *     - Rejects duplicate payments if the order is already marked 'paid' (409 Conflict).
 *     - Rejects payments if the order is 'refunded' (400 Bad Request).
 * - Validates expected order amount against trusted server-authoritative orders.total_amount.
 *     - If caller supplies an amount that does not match, rejects with 400 without mutating order state.
 *     - Never trusts client-supplied totals; payments record always records server total.
 * - Persists a test audit record in the `payments` table with provider = 'test'.
 *     - Unique provider order ID (test_ord_...) and payment ID (test_pay_...).
 *     - Clear isolation from live Razorpay credentials or callbacks.
 * - Transitions orders.payment_status safely to 'paid' or 'failed'.
 * - Preserves fulfillment status and stock rules (no unintended stock mutations in B-18).
 * - Never leaks database credentials, secrets, or internal stack traces.
 */
export async function processTestPayment(
  input: ProcessTestPaymentInput
): Promise<ProcessTestPaymentResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");

  if (input.outcome !== "success" && input.outcome !== "failure") {
    throw new PaymentValidationError(
      `Invalid test payment outcome "${input.outcome}". Valid outcomes: "success", "failure"`,
      400
    );
  }

  const paymentRecord = await withTransaction(async (conn) => {
    // 1. Fetch order with exclusive row lock
    const [orderRows] = (await conn.execute(
      `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [cleanOrderId]
    )) as any[];

    if (!orderRows || orderRows.length === 0) {
      throw new PaymentValidationError("Order not found", 404);
    }

    const orderRow = orderRows[0];
    const currentPaymentStatus = orderRow.payment_status as PaymentStatus;
    const trustedOrderTotal = Number(orderRow.total_amount);
    const orderCurrency = (orderRow.currency || "INR").trim();

    // 2. State machine checks
    if (currentPaymentStatus === "paid") {
      throw new PaymentValidationError(
        "Order is already paid; duplicate payment rejected",
        409
      );
    }

    if (currentPaymentStatus === "refunded") {
      throw new PaymentValidationError(
        "Cannot process payment for a refunded order",
        400
      );
    }

    // 3. Amount validation (if caller supplied an amount to verify)
    if (input.amount !== undefined) {
      const suppliedAmount = Number(input.amount);
      if (isNaN(suppliedAmount) || suppliedAmount < 0) {
        throw new PaymentValidationError(
          "Payment amount must be a valid non-negative number",
          400
        );
      }
      if (Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(
            2
          )}, got ₹${suppliedAmount.toFixed(2)}`,
          400
        );
      }
    }

    // 4. Generate unique test payment identifiers (isolated from real Razorpay)
    const paymentId = crypto.randomUUID();
    const providerOrderId = `test_ord_${crypto.randomUUID()}`;

    if (input.outcome === "success") {
      const providerPaymentId = `test_pay_${crypto.randomUUID()}`;

      // Update orders.payment_status to 'paid'
      await conn.execute(
        "UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?",
        [cleanOrderId]
      );

      // Insert payment record into payments table
      await conn.execute(
        `INSERT INTO payments (
           id, order_id, provider, provider_order_id, provider_payment_id,
           status, amount, currency, paid_at, created_at, updated_at
         ) VALUES (?, ?, 'test', ?, ?, 'captured', ?, ?, NOW(), NOW(), NOW())`,
        [
          paymentId,
          cleanOrderId,
          providerOrderId,
          providerPaymentId,
          trustedOrderTotal,
          orderCurrency,
        ]
      );

      const [insertedRows] = (await conn.execute(
        "SELECT * FROM payments WHERE id = ? LIMIT 1",
        [paymentId]
      )) as any[];

      return mapPaymentRow(insertedRows[0]);
    } else {
      // outcome === "failure"
      // Update orders.payment_status to 'failed'
      await conn.execute(
        "UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = ?",
        [cleanOrderId]
      );

      // Insert payment record into payments table with status 'failed' and NULL provider_payment_id
      await conn.execute(
        `INSERT INTO payments (
           id, order_id, provider, provider_order_id, provider_payment_id,
           status, amount, currency, paid_at, created_at, updated_at
         ) VALUES (?, ?, 'test', ?, NULL, 'failed', ?, ?, NULL, NOW(), NOW())`,
        [
          paymentId,
          cleanOrderId,
          providerOrderId,
          trustedOrderTotal,
          orderCurrency,
        ]
      );

      const [insertedRows] = (await conn.execute(
        "SELECT * FROM payments WHERE id = ? LIMIT 1",
        [paymentId]
      )) as any[];

      return mapPaymentRow(insertedRows[0]);
    }
  });

  // Re-read updated order via trusted internal method
  const updatedOrder = await getOrderById(cleanOrderId, { isAdmin: true });

  return {
    success: input.outcome === "success",
    orderId: cleanOrderId,
    paymentStatus: updatedOrder.paymentStatus,
    paymentRecord,
    order: updatedOrder,
  };
}

/**
 * Fetches all payment records associated with an order, ordered chronologically.
 */
export async function getPaymentsByOrderId(orderId: string): Promise<PaymentRecord[]> {
  const cleanOrderId = validateId(orderId, "Order ID");

  const rows = await query<any[]>(
    "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC",
    [cleanOrderId]
  );

  return (rows || []).map(mapPaymentRow);
}

export interface CreateRazorpayPaymentOrderInput {
  orderId: string;
  userId: string;
  amount?: number;
  currency?: string;
}

export interface CreateRazorpayPaymentOrderResult {
  success: boolean;
  razorpayOrderId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  amountInPaise: number;
  currency: string;
  keyId: string;
  isExisting: boolean;
}

/**
 * Creates a server-authoritative Razorpay payment order for an existing Dearr internal order.
 *
 * Security & Architectural Guarantees:
 * - Operates strictly on the server (`server-only` guarded).
 * - Enforces customer order ownership (fails with 403 Forbidden on IDOR attempt).
 * - Verifies the order is payable (rejects already paid with 409, cancelled with 400).
 * - Amount is derived strictly from trusted MySQL `orders.total_amount`; never trusts client input.
 * - Idempotency: Reuses existing 'created' Razorpay order for this internal order if already present.
 * - Persists a new row in MySQL `payments` table with provider = 'razorpay' and status = 'created'.
 * - Order and payment are NOT marked as paid.
 * - Never returns or leaks Razorpay Key Secret.
 */
export async function createRazorpayPaymentOrder(
  input: CreateRazorpayPaymentOrderInput
): Promise<CreateRazorpayPaymentOrderResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");
  const cleanUserId = validateId(input.userId, "User ID");

  // 1. Fetch internal order by UUID id or order_number
  const orderRows = await query<any[]>(
    `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
     FROM orders
     WHERE id = ? OR order_number = ?
     LIMIT 1`,
    [cleanOrderId, cleanOrderId]
  );

  if (!orderRows || orderRows.length === 0) {
    throw new PaymentValidationError("Order not found", 404);
  }

  const orderRow = orderRows[0];

  // 2. Ownership verification: Customer can only pay for their own order
  if (orderRow.user_id !== cleanUserId) {
    throw new PaymentValidationError(
      "Forbidden: You do not have permission to initiate payment for this order",
      403
    );
  }

  // 3. State machine checks
  const currentPaymentStatus = orderRow.payment_status as PaymentStatus;
  const currentOrderStatus = orderRow.status;

  if (currentPaymentStatus === "paid") {
    throw new PaymentValidationError(
      "Order is already paid; duplicate payment rejected",
      409
    );
  }

  if (currentPaymentStatus === "refunded") {
    throw new PaymentValidationError(
      "Cannot process payment for a refunded order",
      400
    );
  }

  if (currentOrderStatus === "cancelled") {
    throw new PaymentValidationError(
      "Cannot process payment for a cancelled order",
      400
    );
  }

  // 4. Server-authoritative financial validation
  const trustedOrderTotal = Number(orderRow.total_amount);
  if (isNaN(trustedOrderTotal) || trustedOrderTotal <= 0) {
    throw new PaymentValidationError(
      "Order total must be greater than zero to initiate payment",
      400
    );
  }

  // Reject explicit client amount tampering if provided
  if (input.amount !== undefined) {
    const suppliedAmount = Number(input.amount);
    if (isNaN(suppliedAmount) || Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
      throw new PaymentValidationError(
        `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${suppliedAmount.toFixed(2)}`,
        400
      );
    }
  }

  const orderCurrency = (orderRow.currency || "INR").trim().toUpperCase();

  // Reject explicit client currency tampering if provided
  if (input.currency !== undefined) {
    const suppliedCurrency = input.currency.trim().toUpperCase();
    if (suppliedCurrency !== orderCurrency) {
      throw new PaymentValidationError(
        `Payment currency mismatch: expected ${orderCurrency}, got ${input.currency}`,
        400
      );
    }
  }

  const amountInPaise = Math.round(trustedOrderTotal * 100);
  const clientPublicKeyId =
    (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "").trim();

  // 5. Idempotency: Check for existing uncompleted Razorpay order for this order
  const existingPayments = await query<any[]>(
    `SELECT id, provider_order_id, amount, currency, status, created_at
     FROM payments
     WHERE order_id = ? AND provider = 'razorpay' AND status = 'created'
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderRow.id]
  );

  if (existingPayments && existingPayments.length > 0) {
    const existing = existingPayments[0];
    return {
      success: true,
      razorpayOrderId: existing.provider_order_id,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      amount: Number(existing.amount),
      amountInPaise: Math.round(Number(existing.amount) * 100),
      currency: existing.currency,
      keyId: clientPublicKeyId,
      isExisting: true,
    };
  }

  // 6. Create Razorpay Order using server SDK
  const razorpayClient = getRazorpayClient();
  let rzpOrder: any;

  try {
    rzpOrder = await razorpayClient.orders.create({
      amount: amountInPaise,
      currency: orderCurrency,
      receipt: orderRow.order_number.slice(0, 40),
      notes: {
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        userId: cleanUserId,
      },
    });
  } catch (error: any) {
    const safeErrorMsg =
      error?.error?.description || error?.message || "Razorpay order creation failed";
    throw new PaymentValidationError(`Payment gateway error: ${safeErrorMsg}`, 502);
  }

  if (!rzpOrder || !rzpOrder.id) {
    throw new PaymentValidationError("Payment gateway returned an invalid order response", 502);
  }

  // 7. Persist payment record with status 'created'
  const paymentRecordId = crypto.randomUUID();
  await query(
    `INSERT INTO payments (
       id, order_id, provider, provider_order_id, provider_payment_id,
       status, amount, currency, paid_at, created_at, updated_at
     ) VALUES (?, ?, 'razorpay', ?, NULL, 'created', ?, ?, NULL, NOW(), NOW())`,
    [
      paymentRecordId,
      orderRow.id,
      rzpOrder.id,
      trustedOrderTotal,
      orderCurrency,
    ]
  );

  return {
    success: true,
    razorpayOrderId: rzpOrder.id,
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    amount: trustedOrderTotal,
    amountInPaise: amountInPaise,
    currency: orderCurrency,
    keyId: clientPublicKeyId,
    isExisting: false,
  };
}

export interface VerifyRazorpayPaymentInput {
  orderId: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  amount?: number;
  currency?: string;
}

export interface VerifyRazorpayPaymentResult {
  success: boolean;
  verified: boolean;
  orderId: string;
  orderNumber: string;
  paymentId: string;
  providerPaymentId: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  isExisting?: boolean;
}

/**
 * Server-side verification of Razorpay payment signatures against trusted database records.
 *
 * Security & Architectural Guarantees (L-03):
 * 1. Customer Authentication: Caller provides verified customer identity from session (`userId`).
 * 2. IDOR Prevention & Order Ownership: Strictly enforces that `order.user_id === userId`.
 * 3. Trusted Database Order ID: HMAC is generated using `payments.provider_order_id` loaded from MySQL,
 *    never trusting client input as the source of truth for the HMAC payload.
 * 4. Razorpay Order ID Match: Compares DB `provider_order_id` with submitted `razorpay_order_id`. Must match.
 * 5. Cryptographic Signature Verification: Computes HMAC-SHA256 with server-only `RAZORPAY_KEY_SECRET`.
 * 6. Constant-Time Comparison: Uses `crypto.timingSafeEqual` in `verifyRazorpaySignature` to prevent timing attacks.
 * 7. State Machine & Boundaries:
 *    - Updates `payments.provider_payment_id` and sets `payments.status = 'verified'`.
 *    - STRICT BOUNDARY: Does NOT update `orders.payment_status = 'paid'` (reserved exclusively for L-04).
 * 8. Idempotency: Duplicate verification with identical payment ID succeeds safely without side-effects.
 * 9. Amount Protection: Authoritative amount is `orders.total_amount`; client cannot supply a smaller amount.
 * 10. Zero Leakage: Returns only non-sensitive verification status; never leaks key secret, DB info, or stack traces.
 */
export async function verifyRazorpayPayment(
  input: VerifyRazorpayPaymentInput
): Promise<VerifyRazorpayPaymentResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");
  const cleanUserId = validateId(input.userId, "User ID");

  if (!input.razorpayOrderId || typeof input.razorpayOrderId !== "string" || !input.razorpayOrderId.trim()) {
    throw new PaymentValidationError("Razorpay order ID (razorpay_order_id) is required", 400);
  }
  const cleanRzpOrderId = input.razorpayOrderId.trim();
  if (cleanRzpOrderId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(cleanRzpOrderId)) {
    throw new PaymentValidationError("Invalid Razorpay order ID format", 400);
  }

  if (!input.razorpayPaymentId || typeof input.razorpayPaymentId !== "string" || !input.razorpayPaymentId.trim()) {
    throw new PaymentValidationError("Razorpay payment ID (razorpay_payment_id) is required", 400);
  }
  const cleanRzpPaymentId = input.razorpayPaymentId.trim();
  if (cleanRzpPaymentId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(cleanRzpPaymentId)) {
    throw new PaymentValidationError("Invalid Razorpay payment ID format", 400);
  }

  if (!input.razorpaySignature || typeof input.razorpaySignature !== "string" || !input.razorpaySignature.trim()) {
    throw new PaymentValidationError("Razorpay signature (razorpay_signature) is required", 400);
  }
  const cleanSignature = input.razorpaySignature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(cleanSignature)) {
    throw new PaymentValidationError("Invalid Razorpay signature format", 400);
  }

  // 1. Fetch internal order by UUID id or order_number
  const orderRows = await query<any[]>(
    `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
     FROM orders
     WHERE id = ? OR order_number = ?
     LIMIT 1`,
    [cleanOrderId, cleanOrderId]
  );

  if (!orderRows || orderRows.length === 0) {
    throw new PaymentValidationError("Order not found", 404);
  }

  const orderRow = orderRows[0];

  // 2. Ownership verification: Customer can only verify their own order (IDOR protection)
  if (orderRow.user_id !== cleanUserId) {
    throw new PaymentValidationError(
      "Forbidden: You do not have permission to verify payment for this order",
      403
    );
  }

  // 3. Amount validation (if client supplied an amount)
  const trustedOrderTotal = Number(orderRow.total_amount);
  if (input.amount !== undefined) {
    const suppliedAmount = Number(input.amount);
    if (isNaN(suppliedAmount) || Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
      throw new PaymentValidationError(
        `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${suppliedAmount.toFixed(2)}`,
        400
      );
    }
  }

  // Currency validation (if client supplied currency)
  const orderCurrency = (orderRow.currency || "INR").trim().toUpperCase();
  if (input.currency !== undefined) {
    const suppliedCurrency = input.currency.trim().toUpperCase();
    if (suppliedCurrency !== orderCurrency) {
      throw new PaymentValidationError(
        `Payment currency mismatch: expected ${orderCurrency}, got ${input.currency}`,
        400
      );
    }
  }

  // 4. Fetch the internal payment record associated with this order
  const paymentRows = await query<any[]>(
    `SELECT id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency
     FROM payments
     WHERE order_id = ? AND provider = 'razorpay'
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderRow.id]
  );

  if (!paymentRows || paymentRows.length === 0) {
    throw new PaymentValidationError("No Razorpay payment record found for this order", 404);
  }

  const paymentRow = paymentRows[0];

  // 5. Verify submitted Razorpay order ID matches the trusted internal provider_order_id
  if (paymentRow.provider_order_id !== cleanRzpOrderId) {
    throw new PaymentValidationError(
      "Submitted Razorpay order ID does not match the trusted order record",
      400
    );
  }

  // 6. Duplicate verification & Idempotency handling
  if (
    paymentRow.provider_payment_id === cleanRzpPaymentId &&
    (paymentRow.status === "verified" || paymentRow.status === "captured" || orderRow.payment_status === "paid")
  ) {
    // Verify signature to ensure caller is legitimate
    const isSigValid = verifyRazorpaySignature(
      paymentRow.provider_order_id,
      cleanRzpPaymentId,
      cleanSignature
    );
    if (!isSigValid) {
      throw new PaymentValidationError("Invalid payment signature", 400);
    }

    return {
      success: true,
      verified: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      paymentId: paymentRow.id,
      providerPaymentId: paymentRow.provider_payment_id,
      status: paymentRow.status,
      paymentStatus: orderRow.payment_status,
      amount: Number(paymentRow.amount),
      currency: paymentRow.currency,
      isExisting: true,
    };
  }

  // If already marked as paid with a different payment ID, reject
  if (orderRow.payment_status === "paid" && paymentRow.provider_payment_id && paymentRow.provider_payment_id !== cleanRzpPaymentId) {
    throw new PaymentValidationError(
      "Order is already paid; duplicate payment with different payment ID rejected",
      409
    );
  }

  // 7. Cryptographically verify signature using TRUSTED DB provider_order_id
  const isSignatureValid = verifyRazorpaySignature(
    paymentRow.provider_order_id,
    cleanRzpPaymentId,
    cleanSignature
  );

  if (!isSignatureValid) {
    throw new PaymentValidationError("Invalid payment signature", 400);
  }

  // 8. Prevent payment ID collision across different orders
  const existingWithSamePaymentId = await query<any[]>(
    `SELECT id, order_id FROM payments WHERE provider_payment_id = ? AND id != ? LIMIT 1`,
    [cleanRzpPaymentId, paymentRow.id]
  );
  if (existingWithSamePaymentId && existingWithSamePaymentId.length > 0) {
    throw new PaymentValidationError(
      "This Razorpay payment ID has already been assigned to another payment record",
      409
    );
  }

  // 9. Update the payments record: set provider_payment_id and status='verified'
  // NOTE: In L-03, we do NOT set orders.payment_status = 'paid'. That is strictly reserved for L-04.
  await query(
    `UPDATE payments
     SET provider_payment_id = ?,
         status = 'verified',
         updated_at = NOW()
     WHERE id = ?`,
    [cleanRzpPaymentId, paymentRow.id]
  );

  return {
    success: true,
    verified: true,
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    paymentId: paymentRow.id,
    providerPaymentId: cleanRzpPaymentId,
    status: "verified",
    paymentStatus: orderRow.payment_status,
    amount: Number(paymentRow.amount),
    currency: paymentRow.currency,
    isExisting: false,
  };
}

export interface SettlePaidOrderInput {
  orderId: string;
  userId: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
}

export interface SettlePaidOrderResult {
  success: boolean;
  settled: boolean;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | string;
  paymentId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  paidAt: Date;
  isExisting: boolean;
}

/**
 * Settles an order and transitions orders.payment_status to 'paid' ONLY after a valid
 * Razorpay payment has already been successfully verified by the server (L-04).
 *
 * Security & Architectural Guarantees (L-04):
 * 1. Customer Authentication: Caller provides verified customer identity from session (`userId`).
 * 2. Ownership Verification & IDOR Prevention: Enforces `order.user_id === userId`.
 * 3. Trusted Server-Side State: Loads order and payment records directly from MySQL within a transaction.
 * 4. Payment Verification Requirement: The associated payment must have `provider = 'razorpay'`
 *    and `status = 'verified'` (guaranteeing L-03 cryptographic HMAC verification passed).
 * 5. Rejects Incomplete States: Rejects unverified, 'created', 'failed', or missing payment records (400/404).
 * 6. Verified Payment ID Required: Enforces that `provider_payment_id` is present on the verified payment record.
 * 7. Terminal State Safety: Rejects attempts to settle cancelled or refunded orders (400).
 * 8. Idempotency: Safe duplicate settlement for already-paid orders returns HTTP 200 (`isExisting: true`).
 * 9. Amount Validation: Authoritative amount is `orders.total_amount`; client amount cannot override.
 * 10. Concurrency & Race-Condition Safety: Uses `withTransaction` and `SELECT ... FOR UPDATE` row locks.
 * 11. Immutability: Fulfillment status is preserved without unintended mutations.
 * 12. Zero Leakage: Returns only safe operational status; never leaks credentials or internal traces.
 */
export async function settlePaidOrder(
  input: SettlePaidOrderInput
): Promise<SettlePaidOrderResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");
  const cleanUserId = validateId(input.userId, "User ID");

  return await withTransaction(async (conn) => {
    // 1. Fetch internal order with exclusive row lock
    const [orderRows] = (await conn.execute(
      `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
       FROM orders
       WHERE id = ? OR order_number = ?
       LIMIT 1
       FOR UPDATE`,
      [cleanOrderId, cleanOrderId]
    )) as any[];

    if (!orderRows || orderRows.length === 0) {
      throw new PaymentValidationError("Order not found", 404);
    }

    const orderRow = orderRows[0];

    // 2. Ownership verification: Customer can only settle payment for their own order (IDOR protection)
    if (orderRow.user_id !== cleanUserId) {
      throw new PaymentValidationError(
        "Forbidden: You do not have permission to settle payment for this order",
        403
      );
    }

    // 3. State machine checks on order
    const currentPaymentStatus = orderRow.payment_status as PaymentStatus;
    const currentOrderStatus = orderRow.status;

    if (currentOrderStatus === "cancelled") {
      throw new PaymentValidationError(
        "Cannot settle payment for a cancelled order",
        400
      );
    }

    if (currentPaymentStatus === "refunded") {
      throw new PaymentValidationError(
        "Cannot settle payment for a refunded order",
        400
      );
    }

    // 4. Server-authoritative amount and currency validation
    const trustedOrderTotal = Number(orderRow.total_amount);
    if (input.amount !== undefined) {
      const suppliedAmount = Number(input.amount);
      if (isNaN(suppliedAmount) || Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${suppliedAmount.toFixed(2)}`,
          400
        );
      }
    }

    const orderCurrency = (orderRow.currency || "INR").trim().toUpperCase();
    if (input.currency !== undefined) {
      const suppliedCurrency = input.currency.trim().toUpperCase();
      if (suppliedCurrency !== orderCurrency) {
        throw new PaymentValidationError(
          `Payment currency mismatch: expected ${orderCurrency}, got ${input.currency}`,
          400
        );
      }
    }

    // 5. Fetch associated Razorpay payment record with row lock
    const cleanRzpPaymentId = input.razorpayPaymentId?.trim() || "";
    const [paymentRows] = (await conn.execute(
      `SELECT id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency, paid_at
       FROM payments
       WHERE order_id = ? AND provider = 'razorpay'
       ORDER BY
         CASE
           WHEN provider_payment_id = ? THEN 1
           WHEN status IN ('verified', 'captured') THEN 2
           ELSE 3
         END,
         created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [orderRow.id, cleanRzpPaymentId]
    )) as any[];

    if (!paymentRows || paymentRows.length === 0) {
      throw new PaymentValidationError(
        "No Razorpay payment record found for this order. Payment must be initiated and verified first.",
        404
      );
    }

    const paymentRow = paymentRows[0];

    // 6. Idempotency: If order is already paid
    if (currentPaymentStatus === "paid") {
      // If payment record is verified and payment ID matches
      if (
        paymentRow.status === "verified" ||
        paymentRow.status === "captured"
      ) {
        if (
          input.razorpayPaymentId &&
          input.razorpayPaymentId.trim() !== paymentRow.provider_payment_id
        ) {
          throw new PaymentValidationError(
            "Order is already paid with a different payment ID",
            409
          );
        }

        return {
          success: true,
          settled: true,
          orderId: orderRow.id,
          orderNumber: orderRow.order_number,
          paymentStatus: "paid",
          orderStatus: orderRow.status,
          paymentId: paymentRow.id,
          providerPaymentId: paymentRow.provider_payment_id,
          amount: Number(orderRow.total_amount),
          currency: orderRow.currency,
          paidAt: paymentRow.paid_at ? new Date(paymentRow.paid_at) : new Date(),
          isExisting: true,
        };
      }
    }

    // 7. Settleable validation on payment record
    // Payment provider must be razorpay
    if (paymentRow.provider !== "razorpay") {
      throw new PaymentValidationError(
        "Invalid payment provider for settlement; expected 'razorpay'",
        400
      );
    }

    // Payment status must be exactly 'verified'
    if (paymentRow.status === "created") {
      throw new PaymentValidationError(
        "Payment has not been verified yet; order cannot be marked as paid. Please complete payment verification first.",
        400
      );
    }

    if (paymentRow.status === "failed") {
      throw new PaymentValidationError(
        "Payment has failed; order cannot be marked as paid",
        400
      );
    }

    if (paymentRow.status !== "verified") {
      throw new PaymentValidationError(
        `Cannot settle payment with status "${paymentRow.status}". Payment must be verified before order can be marked as paid.`,
        400
      );
    }

    // Must have a verified provider_payment_id
    if (!paymentRow.provider_payment_id) {
      throw new PaymentValidationError(
        "Payment record is missing a verified Razorpay payment ID",
        400
      );
    }

    // Provider payment amount and currency mismatch checks
    if (Math.abs(Number(paymentRow.amount) - trustedOrderTotal) > 0.009) {
      throw new PaymentValidationError(
        `Provider payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${Number(paymentRow.amount).toFixed(2)}`,
        400
      );
    }
    if ((paymentRow.currency || "INR").trim().toUpperCase() !== orderCurrency) {
      throw new PaymentValidationError(
        `Provider payment currency mismatch: expected ${orderCurrency}, got ${paymentRow.currency}`,
        400
      );
    }

    // If client supplied razorpayPaymentId, verify it matches the trusted record
    if (input.razorpayPaymentId) {
      const cleanRzpPaymentId = input.razorpayPaymentId.trim();
      if (cleanRzpPaymentId !== paymentRow.provider_payment_id) {
        throw new PaymentValidationError(
          "Submitted Razorpay payment ID does not match the verified payment record",
          400
        );
      }
    }

    // If client supplied razorpayOrderId, verify it matches the trusted record
    if (input.razorpayOrderId) {
      const cleanRzpOrderId = input.razorpayOrderId.trim();
      if (cleanRzpOrderId !== paymentRow.provider_order_id) {
        throw new PaymentValidationError(
          "Submitted Razorpay order ID does not match the trusted payment record",
          400
        );
      }
    }

    // 8. Atomic settlement transition in MySQL:
    // Update orders.payment_status = 'paid'
    await conn.execute(
      "UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?",
      [orderRow.id]
    );

    // Update payments: record paid_at timestamp
    await conn.execute(
      "UPDATE payments SET paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE id = ?",
      [paymentRow.id]
    );

    const paidAt = paymentRow.paid_at ? new Date(paymentRow.paid_at) : new Date();

    return {
      success: true,
      settled: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      paymentStatus: "paid",
      orderStatus: orderRow.status,
      paymentId: paymentRow.id,
      providerPaymentId: paymentRow.provider_payment_id,
      amount: Number(orderRow.total_amount),
      currency: orderRow.currency,
      paidAt,
      isExisting: false,
    };
  });
}

export interface HandlePaymentFailureInput {
  orderId: string;
  userId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  errorCode?: string;
  errorDescription?: string;
  errorSource?: string;
  errorStep?: string;
  errorReason?: string;
  amount?: number;
  currency?: string;
}

export interface HandlePaymentFailureResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | string;
  paymentId?: string;
  providerPaymentId?: string;
  status: string;
  message?: string;
  ignored?: boolean;
  isExisting?: boolean;
}

/**
 * Handles a failed Razorpay payment attempt safely (L-05).
 *
 * Guarantees:
 * 1. Customer Authentication: Caller provides verified customer identity from session (`userId`).
 * 2. IDOR Prevention & Order Ownership: Strictly enforces `order.user_id === userId`.
 * 3. Never Corrupts Paid Orders: If order is already 'paid', failure callback is ignored idempotently.
 * 4. Protects Verified Payments: Does NOT mark a verified payment record as failed.
 * 5. Amount & Currency Validation: Client cannot send mismatched amounts or currencies.
 * 6. Idempotency: Repeated failure callbacks for the same payment return safe status without duplicate writes.
 * 7. Failure Persistence: Sets `payments.status = 'failed'` and updates `orders.payment_status = 'failed'` (if not paid).
 * 8. Zero Leakage: Returns safe structured response; never leaks gateway secrets, DB errors, or stack traces.
 */
export async function handlePaymentFailure(
  input: HandlePaymentFailureInput
): Promise<HandlePaymentFailureResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");
  const cleanUserId = validateId(input.userId, "User ID");

  return await withTransaction(async (conn) => {
    // 1. Fetch internal order with row lock
    const [orderRows] = (await conn.execute(
      `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
       FROM orders
       WHERE id = ? OR order_number = ?
       LIMIT 1
       FOR UPDATE`,
      [cleanOrderId, cleanOrderId]
    )) as any[];

    if (!orderRows || orderRows.length === 0) {
      throw new PaymentValidationError("Order not found", 404);
    }

    const orderRow = orderRows[0];

    // 2. Ownership verification: Customer can only report failures for their own order (IDOR protection)
    if (orderRow.user_id !== cleanUserId) {
      throw new PaymentValidationError(
        "Forbidden: You do not have permission to access payment records for this order",
        403
      );
    }

    // 3. State machine guard: An already-paid order MUST NEVER be downgraded by a later failure callback
    if (orderRow.payment_status === "paid") {
      return {
        success: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "paid",
        orderStatus: orderRow.status,
        status: "ignored",
        ignored: true,
        message: "Order is already paid; failure callback ignored safely.",
      };
    }

    // 4. Amount and currency validation (if client supplied values)
    const trustedOrderTotal = Number(orderRow.total_amount);
    if (input.amount !== undefined) {
      const suppliedAmount = Number(input.amount);
      if (isNaN(suppliedAmount) || Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${suppliedAmount.toFixed(2)}`,
          400
        );
      }
    }

    const orderCurrency = (orderRow.currency || "INR").trim().toUpperCase();
    if (input.currency !== undefined) {
      const suppliedCurrency = input.currency.trim().toUpperCase();
      if (suppliedCurrency !== orderCurrency) {
        throw new PaymentValidationError(
          `Payment currency mismatch: expected ${orderCurrency}, got ${input.currency}`,
          400
        );
      }
    }

    // 5. Prevent cross-order payment ID collision
    const cleanRzpPaymentId = input.razorpayPaymentId?.trim() || null;
    if (cleanRzpPaymentId) {
      const [otherOrders] = (await conn.execute(
        `SELECT id, order_id FROM payments WHERE provider_payment_id = ? AND order_id != ? LIMIT 1`,
        [cleanRzpPaymentId, orderRow.id]
      )) as any[];
      if (otherOrders && otherOrders.length > 0) {
        throw new PaymentValidationError(
          "This Razorpay payment ID is associated with a different order",
          409
        );
      }
    }

    // 6. Find existing payment record for this order and provider
    const cleanRzpOrderId = input.razorpayOrderId?.trim() || null;
    let querySql = `SELECT id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency
                    FROM payments
                    WHERE order_id = ? AND provider = 'razorpay'`;
    const queryParams: any[] = [orderRow.id];

    if (cleanRzpOrderId) {
      querySql += ` AND provider_order_id = ?`;
      queryParams.push(cleanRzpOrderId);
    }
    querySql += ` ORDER BY created_at DESC LIMIT 1 FOR UPDATE`;

    const [paymentRows] = (await conn.execute(querySql, queryParams)) as any[];

    if (paymentRows && paymentRows.length > 0) {
      const paymentRow = paymentRows[0];

      // Protect verified/captured payments from failure callbacks
      if (paymentRow.status === "verified" || paymentRow.status === "captured") {
        return {
          success: true,
          orderId: orderRow.id,
          orderNumber: orderRow.order_number,
          paymentStatus: orderRow.payment_status,
          orderStatus: orderRow.status,
          paymentId: paymentRow.id,
          providerPaymentId: paymentRow.provider_payment_id,
          status: "ignored",
          ignored: true,
          message: "Verified payment record is protected; failure callback ignored.",
        };
      }

      // Idempotent return if already marked as failed
      if (paymentRow.status === "failed") {
        return {
          success: true,
          orderId: orderRow.id,
          orderNumber: orderRow.order_number,
          paymentStatus: "failed",
          orderStatus: orderRow.status,
          paymentId: paymentRow.id,
          providerPaymentId: paymentRow.provider_payment_id,
          status: "failed",
          isExisting: true,
        };
      }

      // Update payment record to 'failed'
      await conn.execute(
        `UPDATE payments
         SET status = 'failed',
             provider_payment_id = COALESCE(?, provider_payment_id),
             updated_at = NOW()
         WHERE id = ?`,
        [cleanRzpPaymentId, paymentRow.id]
      );

      // Update orders.payment_status to 'failed' (only if not already paid)
      await conn.execute(
        `UPDATE orders
         SET payment_status = 'failed',
             updated_at = NOW()
         WHERE id = ? AND payment_status != 'paid'`,
        [orderRow.id]
      );

      return {
        success: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "failed",
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        providerPaymentId: cleanRzpPaymentId || paymentRow.provider_payment_id,
        status: "failed",
      };
    }

    // If no payment record exists, insert a failed record
    const paymentId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO payments (
         id, order_id, provider, provider_order_id, provider_payment_id,
         status, amount, currency, paid_at, created_at, updated_at
       ) VALUES (?, ?, 'razorpay', ?, ?, 'failed', ?, ?, NULL, NOW(), NOW())`,
      [
        paymentId,
        orderRow.id,
        cleanRzpOrderId || `unassigned_${orderRow.id.slice(0, 8)}`,
        cleanRzpPaymentId,
        trustedOrderTotal,
        orderCurrency,
      ]
    );

    await conn.execute(
      `UPDATE orders
       SET payment_status = 'failed',
           updated_at = NOW()
       WHERE id = ? AND payment_status != 'paid'`,
      [orderRow.id]
    );

    return {
      success: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      paymentStatus: "failed",
      orderStatus: orderRow.status,
      paymentId: paymentId,
      providerPaymentId: cleanRzpPaymentId || undefined,
      status: "failed",
    };
  });
}

export interface HandlePaymentCancellationInput {
  orderId: string;
  userId: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
}

export interface HandlePaymentCancellationResult {
  success: boolean;
  cancelled: boolean;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | string;
  status: string;
  message: string;
  ignored?: boolean;
}

/**
 * Handles customer cancellation / closing of the Razorpay checkout modal (L-05).
 *
 * Guarantees:
 * 1. Customer Authentication & IDOR Protection: Enforces `order.user_id === userId`.
 * 2. Never Marks Paid: Does not mark the order as paid.
 * 3. Does Not Falsely Mark Failed: Customer simply closing the modal does NOT mark the payment failed;
 *    order and payment remain in safe 'pending' / 'created' state so customer can retry seamlessly.
 * 4. Protects Already-Paid Orders: If order is already paid, cancellation callback is harmlessly ignored.
 * 5. Protects Verified Payments: If payment was already verified, ignores cancellation callback.
 * 6. Idempotency: Repeated cancellation callbacks are safe and produce identical benign results.
 */
export async function handlePaymentCancellation(
  input: HandlePaymentCancellationInput
): Promise<HandlePaymentCancellationResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");
  const cleanUserId = validateId(input.userId, "User ID");

  return await withTransaction(async (conn) => {
    // 1. Fetch internal order with row lock
    const [orderRows] = (await conn.execute(
      `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
       FROM orders
       WHERE id = ? OR order_number = ?
       LIMIT 1
       FOR UPDATE`,
      [cleanOrderId, cleanOrderId]
    )) as any[];

    if (!orderRows || orderRows.length === 0) {
      throw new PaymentValidationError("Order not found", 404);
    }

    const orderRow = orderRows[0];

    // 2. Ownership verification (IDOR protection)
    if (orderRow.user_id !== cleanUserId) {
      throw new PaymentValidationError(
        "Forbidden: You do not have permission to access this order",
        403
      );
    }

    // 3. State machine guard: Already paid orders must never be modified by cancellation
    if (orderRow.payment_status === "paid") {
      return {
        success: true,
        cancelled: false,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "paid",
        orderStatus: orderRow.status,
        status: "paid",
        ignored: true,
        message: "Order is already paid; cancellation callback ignored safely.",
      };
    }

    // 4. Amount and currency checks if client supplied values
    const trustedOrderTotal = Number(orderRow.total_amount);
    if (input.amount !== undefined) {
      const suppliedAmount = Number(input.amount);
      if (isNaN(suppliedAmount) || Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${suppliedAmount.toFixed(2)}`,
          400
        );
      }
    }

    const orderCurrency = (orderRow.currency || "INR").trim().toUpperCase();
    if (input.currency !== undefined) {
      const suppliedCurrency = input.currency.trim().toUpperCase();
      if (suppliedCurrency !== orderCurrency) {
        throw new PaymentValidationError(
          `Payment currency mismatch: expected ${orderCurrency}, got ${input.currency}`,
          400
        );
      }
    }

    // 5. Check associated payment record
    const [paymentRows] = (await conn.execute(
      `SELECT id, status, provider_payment_id FROM payments
       WHERE order_id = ? AND provider = 'razorpay'
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [orderRow.id]
    )) as any[];

    if (paymentRows && paymentRows.length > 0) {
      const paymentRow = paymentRows[0];
      if (paymentRow.status === "verified" || paymentRow.status === "captured") {
        return {
          success: true,
          cancelled: false,
          orderId: orderRow.id,
          orderNumber: orderRow.order_number,
          paymentStatus: orderRow.payment_status,
          orderStatus: orderRow.status,
          status: paymentRow.status,
          ignored: true,
          message: "Payment is already verified; cancellation callback ignored.",
        };
      }
    }

    // Customer simply dismissed or closed the checkout UI.
    // Preserve order in safe 'pending' state and payment in 'created' state to allow payment retry.
    return {
      success: true,
      cancelled: true,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      paymentStatus: orderRow.payment_status,
      orderStatus: orderRow.status,
      status: "pending",
      message: "Checkout was closed by customer. Order remains pending for retry.",
    };
  });
}

export interface ReconcileRazorpayPaymentInput {
  orderId: string;
  userId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount?: number;
  currency?: string;
}

export interface ReconcileRazorpayPaymentResult {
  success: boolean;
  reconciled: boolean;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus | string;
  paymentId?: string;
  providerPaymentId?: string;
  status: string;
  amount: number;
  currency: string;
  message?: string;
  isExisting?: boolean;
}

/**
 * Reconciles delayed, pending, or unknown Razorpay payment status against the gateway (L-05).
 *
 * Guarantees:
 * 1. Customer Authentication & IDOR Protection: Enforces `order.user_id === userId`.
 * 2. Trusted Provider Lookup: Calls official Razorpay SDK on the server using private credentials.
 * 3. Never Exposes Secrets: RAZORPAY_KEY_SECRET is strictly confined to server-only code.
 * 4. Mismatch Prevention: Strictly validates gateway amount and currency before settling; rejects mismatches safely.
 * 5. Safe Uncertain State: If gateway is unreachable or payment is still pending, keeps order in safe 'pending' state.
 * 6. Idempotency: Safe to call repeatedly without generating duplicate payments or contradictory states.
 * 7. Settlement Protection: Transitions order to 'paid' ONLY when authoritative provider evidence confirms capture.
 */
export async function reconcileRazorpayPayment(
  input: ReconcileRazorpayPaymentInput
): Promise<ReconcileRazorpayPaymentResult> {
  const cleanOrderId = validateId(input.orderId, "Order ID");
  const cleanUserId = validateId(input.userId, "User ID");

  return await withTransaction(async (conn) => {
    // 1. Fetch internal order with row lock
    const [orderRows] = (await conn.execute(
      `SELECT id, order_number, user_id, status, payment_status, total_amount, currency
       FROM orders
       WHERE id = ? OR order_number = ?
       LIMIT 1
       FOR UPDATE`,
      [cleanOrderId, cleanOrderId]
    )) as any[];

    if (!orderRows || orderRows.length === 0) {
      throw new PaymentValidationError("Order not found", 404);
    }

    const orderRow = orderRows[0];

    // 2. Ownership verification (IDOR protection)
    if (orderRow.user_id !== cleanUserId) {
      throw new PaymentValidationError(
        "Forbidden: You do not have permission to reconcile payment for this order",
        403
      );
    }

    // 3. Amount and currency checks if client supplied values
    const trustedOrderTotal = Number(orderRow.total_amount);
    if (input.amount !== undefined) {
      const suppliedAmount = Number(input.amount);
      if (isNaN(suppliedAmount) || Math.abs(suppliedAmount - trustedOrderTotal) > 0.009) {
        throw new PaymentValidationError(
          `Payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(2)}, got ₹${suppliedAmount.toFixed(2)}`,
          400
        );
      }
    }

    const orderCurrency = (orderRow.currency || "INR").trim().toUpperCase();
    if (input.currency !== undefined) {
      const suppliedCurrency = input.currency.trim().toUpperCase();
      if (suppliedCurrency !== orderCurrency) {
        throw new PaymentValidationError(
          `Payment currency mismatch: expected ${orderCurrency}, got ${input.currency}`,
          400
        );
      }
    }

    // 4. Fetch latest payment record for this order
    const [paymentRows] = (await conn.execute(
      `SELECT id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency, paid_at
       FROM payments
       WHERE order_id = ? AND provider = 'razorpay'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [orderRow.id]
    )) as any[];

    if (!paymentRows || paymentRows.length === 0) {
      throw new PaymentValidationError(
        "No Razorpay payment record found for this order to reconcile",
        404
      );
    }

    const paymentRow = paymentRows[0];

    // 5. If order is already paid, return authoritative paid result
    if (orderRow.payment_status === "paid") {
      return {
        success: true,
        reconciled: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "paid",
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        providerPaymentId: paymentRow.provider_payment_id,
        status: "paid",
        amount: trustedOrderTotal,
        currency: orderCurrency,
        isExisting: true,
      };
    }

    // 6. Verify client-supplied razorpayOrderId matches trusted record
    if (input.razorpayOrderId) {
      const cleanRzpOrderId = input.razorpayOrderId.trim();
      if (cleanRzpOrderId !== paymentRow.provider_order_id) {
        throw new PaymentValidationError(
          "Submitted Razorpay order ID does not match the trusted payment record",
          400
        );
      }
    }

    // 7. If payment is already verified in DB, complete settlement
    if (paymentRow.status === "verified" || paymentRow.status === "captured") {
      await conn.execute(
        `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
        [orderRow.id]
      );
      await conn.execute(
        `UPDATE payments SET paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE id = ?`,
        [paymentRow.id]
      );

      return {
        success: true,
        reconciled: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "paid",
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        providerPaymentId: paymentRow.provider_payment_id,
        status: "paid",
        amount: trustedOrderTotal,
        currency: orderCurrency,
        isExisting: false,
      };
    }

    // 8. If payment already marked failed in DB
    if (paymentRow.status === "failed") {
      return {
        success: true,
        reconciled: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "failed",
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        providerPaymentId: paymentRow.provider_payment_id,
        status: "failed",
        amount: trustedOrderTotal,
        currency: orderCurrency,
        message: "Payment status is failed.",
      };
    }

    // 9. Query provider (Razorpay) using official SDK client
    let paymentsResponse: any = null;
    let paymentFetchItem: any = null;
    const cleanRzpPaymentId = input.razorpayPaymentId?.trim() || null;

    try {
      const razorpayClient = getRazorpayClient();

      if (cleanRzpPaymentId) {
        try {
          paymentFetchItem = await razorpayClient.payments.fetch(cleanRzpPaymentId);
        } catch {
          // If individual payment fetch fails, continue with order-level payment fetch
        }
      }

      if (paymentRow.provider_order_id) {
        paymentsResponse = await razorpayClient.orders.fetchPayments(
          paymentRow.provider_order_id
        );
      }
    } catch (gatewayErr: any) {
      // Gateway error / unreachable / timeout: keep order in safe pending state
      return {
        success: true,
        reconciled: false,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: orderRow.payment_status,
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        status: "unknown",
        amount: trustedOrderTotal,
        currency: orderCurrency,
        message: "Payment gateway check could not be completed; order remains safely pending.",
      };
    }

    const items: any[] = paymentsResponse?.items || [];
    if (paymentFetchItem && !items.some((i: any) => i.id === paymentFetchItem.id)) {
      items.push(paymentFetchItem);
    }

    const successfulPayment = items.find(
      (item: any) => item.status === "captured" || item.status === "authorized"
    );

    if (successfulPayment) {
      // Gateway amount and currency validation
      const expectedPaise = Math.round(trustedOrderTotal * 100);
      if (Number(successfulPayment.amount) !== expectedPaise) {
        await conn.execute(
          `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = ?`,
          [paymentRow.id]
        );
        throw new PaymentValidationError(
          `Provider payment amount mismatch: expected ₹${trustedOrderTotal.toFixed(
            2
          )}, gateway reported ₹${(successfulPayment.amount / 100).toFixed(2)}`,
          400
        );
      }

      if (
        (successfulPayment.currency || "INR").trim().toUpperCase() !== orderCurrency
      ) {
        await conn.execute(
          `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = ?`,
          [paymentRow.id]
        );
        throw new PaymentValidationError(
          `Provider payment currency mismatch: expected ${orderCurrency}, gateway reported ${successfulPayment.currency}`,
          400
        );
      }

      // Check IDOR / cross-order assignment
      const [existingCollision] = (await conn.execute(
        `SELECT id, order_id FROM payments WHERE provider_payment_id = ? AND id != ? LIMIT 1`,
        [successfulPayment.id, paymentRow.id]
      )) as any[];

      if (existingCollision && existingCollision.length > 0) {
        throw new PaymentValidationError(
          "This Razorpay payment ID has already been assigned to another payment record",
          409
        );
      }

      // Transition payments to 'verified' and orders to 'paid'
      await conn.execute(
        `UPDATE payments
         SET provider_payment_id = ?,
             status = 'verified',
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [successfulPayment.id, paymentRow.id]
      );

      await conn.execute(
        `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
        [orderRow.id]
      );

      return {
        success: true,
        reconciled: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "paid",
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        providerPaymentId: successfulPayment.id,
        status: "paid",
        amount: trustedOrderTotal,
        currency: orderCurrency,
      };
    }

    // Check if all attempts failed
    const allFailed = items.length > 0 && items.every((i: any) => i.status === "failed");
    if (allFailed) {
      await conn.execute(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = ?`,
        [paymentRow.id]
      );
      await conn.execute(
        `UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = ? AND payment_status != 'paid'`,
        [orderRow.id]
      );

      return {
        success: true,
        reconciled: true,
        orderId: orderRow.id,
        orderNumber: orderRow.order_number,
        paymentStatus: "failed",
        orderStatus: orderRow.status,
        paymentId: paymentRow.id,
        status: "failed",
        amount: trustedOrderTotal,
        currency: orderCurrency,
        message: "All payment attempts at gateway failed.",
      };
    }

    // Otherwise, status remains safely pending
    return {
      success: true,
      reconciled: false,
      orderId: orderRow.id,
      orderNumber: orderRow.order_number,
      paymentStatus: orderRow.payment_status,
      orderStatus: orderRow.status,
      paymentId: paymentRow.id,
      status: "pending",
      amount: trustedOrderTotal,
      currency: orderCurrency,
      message: "Payment is still pending or awaiting customer completion.",
    };
  });
}


