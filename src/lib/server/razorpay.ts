import "server-only";
import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Custom error class for Razorpay configuration issues.
 * Ensures internal secrets are never exposed in error messages.
 */
export class RazorpayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayConfigError";
  }
}

export type RazorpayMode = "test" | "live" | "unknown";

export interface SafeRazorpayConfig {
  /** Publicly identifiable key ID (e.g. rzp_test_...) */
  keyId: string;
  /** Whether both key ID and key secret are present */
  isConfigured: boolean;
  /** Mode derived from key prefix: test or live */
  mode: RazorpayMode;
}

// Cached singleton instance of the Razorpay SDK client
let cachedClient: Razorpay | null = null;

/**
 * Retrieves the raw Razorpay Key ID from the server environment.
 */
function getRawKeyId(): string {
  return (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
}

/**
 * Retrieves the raw Razorpay Key Secret from the server environment.
 * Strictly internal to this server-only module.
 */
function getRawKeySecret(): string {
  return (process.env.RAZORPAY_KEY_SECRET || "").trim();
}

/**
 * Determines whether Razorpay credentials are fully configured in the server environment.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = getRawKeyId();
  const keySecret = getRawKeySecret();
  return keyId.length > 0 && keySecret.length > 0;
}

/**
 * Determines whether the configured credentials belong to Razorpay Test Mode.
 */
export function isRazorpayTestMode(): boolean {
  const keyId = getRawKeyId();
  return keyId.startsWith("rzp_test_");
}

/**
 * Determines whether the configured credentials belong to Razorpay Live Mode.
 */
export function isRazorpayLiveMode(): boolean {
  const keyId = getRawKeyId();
  return keyId.startsWith("rzp_live_");
}

/**
 * Returns safe, non-sensitive Razorpay configuration metadata.
 * Note: NEVER includes the secret key.
 */
export function getRazorpayConfig(): SafeRazorpayConfig {
  const keyId = getRawKeyId();
  const configured = isRazorpayConfigured();

  let mode: RazorpayMode = "unknown";
  if (keyId.startsWith("rzp_test_")) {
    mode = "test";
  } else if (keyId.startsWith("rzp_live_")) {
    mode = "live";
  }

  return {
    keyId: keyId,
    isConfigured: configured,
    mode: mode,
  };
}

/**
 * Initializes and returns the official Razorpay SDK client instance.
 * Throws a RazorpayConfigError if credentials are missing or invalid.
 *
 * Security guarantees:
 * - Operates strictly on the server (`server-only` guarded).
 * - Caches client instance for performance.
 * - Key secret is never exposed in returned objects or logs.
 */
export function getRazorpayClient(): Razorpay {
  if (cachedClient) {
    return cachedClient;
  }

  const keyId = getRawKeyId();
  const keySecret = getRawKeySecret();

  if (!keyId || !keySecret) {
    throw new RazorpayConfigError(
      "Razorpay credentials are missing. Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env.local."
    );
  }

  try {
    cachedClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    return cachedClient;
  } catch (error) {
    throw new RazorpayConfigError(
      `Failed to initialize Razorpay SDK client: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Cryptographically verifies a Razorpay payment signature using HMAC-SHA256 and constant-time comparison.
 *
 * Scheme:
 * Expected signature = HMAC-SHA256(`${trustedOrderId}|${paymentId}`, RAZORPAY_KEY_SECRET)
 *
 * Security guarantees:
 * - Operates strictly on the server (`server-only` guarded).
 * - Key secret is never logged or exposed in returns or exceptions.
 * - Format check prevents regex DoS or invalid inputs.
 * - Node's crypto.timingSafeEqual ensures constant-time comparison, eliminating timing attack vectors.
 * - Handles malformed or different-length signatures safely without throwing RangeError.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = getRawKeySecret();
  if (!secret) {
    throw new RazorpayConfigError(
      "Razorpay credentials missing: RAZORPAY_KEY_SECRET is not configured."
    );
  }

  if (
    !orderId ||
    typeof orderId !== "string" ||
    !paymentId ||
    typeof paymentId !== "string" ||
    !signature ||
    typeof signature !== "string"
  ) {
    return false;
  }

  const cleanOrderId = orderId.trim();
  const cleanPaymentId = paymentId.trim();
  const cleanSignature = signature.trim().toLowerCase();

  // Razorpay HMAC-SHA256 signatures are exactly 64 lowercase hex characters
  if (!/^[a-f0-9]{64}$/.test(cleanSignature)) {
    return false;
  }

  const payload = `${cleanOrderId}|${cleanPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .toLowerCase();

  const bufExpected = Buffer.from(expectedSignature, "utf-8");
  const bufReceived = Buffer.from(cleanSignature, "utf-8");

  if (bufExpected.length !== bufReceived.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufExpected, bufReceived);
}
