import "server-only";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { query, withTransaction } from "./db";
import { findProfileByEmail } from "./profile";
import { hashPassword } from "./auth";
import { sendPasswordResetOtp } from "./email";
import { checkRateLimit } from "./settings";

export const OTP_EXPIRY_MINUTES = 10;
export const MAX_VERIFICATION_ATTEMPTS = 5;
export const MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT = 2;
export const IP_RATE_LIMIT_MAX = 5;
export const IP_RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes

export class OtpError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;

  constructor(message: string, statusCode = 400, retryAfterSeconds?: number) {
    super(message);
    this.name = "OtpError";
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, OtpError.prototype);
  }
}

function getOtpSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Authentication configuration error: AUTH_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Creates a keyed HMAC-SHA256 digest of the OTP bound to the user's ID.
 */
function hashOtp(userId: string, otp: string): string {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "dearr_fallback_secret_key_32chars";
  return crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${otp}`)
    .digest("hex");
}

/**
 * Generates next UTC midnight Date object and remaining seconds until midnight.
 */
function getUtcMidnightReset(): { nextUtcMidnight: Date; secondsUntilMidnight: number } {
  const now = new Date();
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  const secondsUntilMidnight = Math.max(1, Math.ceil((nextUtcMidnight.getTime() - now.getTime()) / 1000));
  return { nextUtcMidnight, secondsUntilMidnight };
}

/**
 * Concurrency-safe atomic check and increment of the daily account send limit.
 * Guaranteed across app restarts and multi-instance concurrency via MySQL row lock.
 * Max 2 requests per account per UTC day.
 */
export async function checkAndIncrementAccountDailyOtpLimit(
  normalizedEmail: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  // Privacy-preserving rate key hash (never stores plaintext email in rate_limits)
  const emailHash = crypto.createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 32);
  const rateKey = `otp:account:${emailHash}`;
  const { nextUtcMidnight, secondsUntilMidnight } = getUtcMidnightReset();

  // Ensure the rate limit row exists to prevent InnoDB gap-lock deadlocks during concurrency
  await query(
    `INSERT INTO rate_limits (rate_key, hits, reset_at)
     VALUES (?, 0, ?)
     ON DUPLICATE KEY UPDATE rate_key = rate_key`,
    [rateKey, nextUtcMidnight]
  );

  return withTransaction(async (conn) => {
    const [rows]: any = await conn.execute(
      "SELECT hits, reset_at FROM rate_limits WHERE rate_key = ? FOR UPDATE",
      [rateKey]
    );

    const now = new Date();
    const currentRecord = rows[0];
    const resetAt = new Date(currentRecord.reset_at);

    // If existing window has elapsed, reset counter to 1
    if (now >= resetAt) {
      await conn.execute(
        "UPDATE rate_limits SET hits = 1, reset_at = ? WHERE rate_key = ?",
        [nextUtcMidnight, rateKey]
      );
      return { allowed: true, retryAfterSeconds: 0 };
    }

    // Within active UTC day window: check threshold
    const currentHits = Number(currentRecord.hits);
    if (currentHits >= MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT) {
      const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
    }

    // Within quota: increment hits atomically
    await conn.execute(
      "UPDATE rate_limits SET hits = hits + 1 WHERE rate_key = ?",
      [rateKey]
    );
    return { allowed: true, retryAfterSeconds: 0 };
  });
}

/**
 * Standard public response text for forgot-password requests.
 * Returned uniformly regardless of whether the account exists to prevent account enumeration.
 */
export const GENERIC_OTP_PUBLIC_RESPONSE =
  "If an account is associated with this email address, password recovery instructions have been sent.";

/**
 * Requests a password reset OTP for the submitted email address.
 * Enforces IP rate limiting and account-based daily send limits.
 */
export async function requestPasswordResetOtp(params: {
  email: string;
  clientIp?: string;
}): Promise<{ ok: boolean; message: string }> {
  const rawEmail = (params.email || "").trim();
  const normalizedEmail = rawEmail.toLowerCase();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new OtpError("Please enter a valid email address", 400);
  }

  // 1. IP-based rate limiting protection
  if (params.clientIp) {
    const ipRateKey = `otp:ip:${params.clientIp.trim()}`;
    const ipCheck = await checkRateLimit(
      ipRateKey,
      IP_RATE_LIMIT_MAX,
      IP_RATE_LIMIT_WINDOW_SECONDS,
      true
    );
    if (!ipCheck.allowed) {
      throw new OtpError(
        `Too many password reset requests from this network. Please wait ${ipCheck.retryAfterSeconds} seconds before trying again.`,
        429,
        ipCheck.retryAfterSeconds
      );
    }
  }

  // 2. Look up customer profile in MySQL
  const profile = await findProfileByEmail(normalizedEmail);

  // If no account exists, return generic message without issuing OTP or consuming account quota
  if (!profile) {
    // Artificial consistent delay to match bcrypt/crypto timing profile
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { ok: true, message: GENERIC_OTP_PUBLIC_RESPONSE };
  }

  // Account is suspended: return identical public response without sending email
  if (profile.role !== "admin" && profile.status === "suspended") {
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { ok: true, message: GENERIC_OTP_PUBLIC_RESPONSE };
  }

  // 3. Concurrency-safe account-based daily send limit (max 2/day per account)
  const accountLimit = await checkAndIncrementAccountDailyOtpLimit(normalizedEmail);
  if (!accountLimit.allowed) {
    throw new OtpError(
      `Daily password reset limit exceeded for this account. Maximum ${MAX_DAILY_OTP_REQUESTS_PER_ACCOUNT} requests allowed per day. Please try again tomorrow.`,
      429,
      accountLimit.retryAfterSeconds
    );
  }

  // 4. Generate 6-digit cryptographically secure numeric OTP
  const otpNumber = crypto.randomInt(100000, 1000000);
  const otpString = otpNumber.toString();

  // 5. Compute HMAC-SHA256 digest
  const otpDigest = hashOtp(profile.id, otpString);
  const otpId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // 6. Invalidate superseded active OTPs and persist new OTP atomically
  await withTransaction(async (conn) => {
    // Mark previous unconsumed OTPs for this user as consumed/invalidated
    await conn.execute(
      "UPDATE password_reset_otps SET consumed_at = NOW() WHERE user_id = ? AND consumed_at IS NULL",
      [profile.id]
    );

    await conn.execute(
      `INSERT INTO password_reset_otps (
        id, user_id, email, otp_hash, attempts, max_attempts, expires_at, consumed_at, ip_address, created_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?, NOW())`,
      [
        otpId,
        profile.id,
        normalizedEmail,
        otpDigest,
        MAX_VERIFICATION_ATTEMPTS,
        expiresAt,
        params.clientIp || null,
      ]
    );
  });

  // 7. Dispatch transactional email through Resend (non-blocking failure safe)
  try {
    await sendPasswordResetOtp({
      email: normalizedEmail,
      fullName: profile.fullName,
      otp: otpString,
    });
  } catch (err: any) {
    console.error("[requestPasswordResetOtp] Email dispatch notice:", err?.message || err);
  }

  return { ok: true, message: GENERIC_OTP_PUBLIC_RESPONSE };
}

/**
 * Verifies a customer-submitted 6-digit OTP against MySQL.
 * Enforces:
 * - 10-minute expiry
 * - Maximum 5 failed attempts
 * - One-time atomic validation
 *
 * Returns a cryptographically signed resetToken authorizing password update.
 */
export async function verifyPasswordResetOtp(params: {
  email: string;
  otp: string;
}): Promise<{ ok: boolean; resetToken: string }> {
  const normalizedEmail = (params.email || "").trim().toLowerCase();
  const rawOtp = (params.otp || "").trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new OtpError("Please provide a valid email address", 400);
  }

  if (!rawOtp || !/^\d{6}$/.test(rawOtp)) {
    throw new OtpError("Please enter a valid 6-digit verification code", 400);
  }

  const profile = await findProfileByEmail(normalizedEmail);
  if (!profile) {
    throw new OtpError("Invalid or expired verification code", 400);
  }

  const expectedDigest = hashOtp(profile.id, rawOtp);

  const rows = await query<any[]>(
    `SELECT * FROM password_reset_otps
     WHERE user_id = ? AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [profile.id]
  );

  if (!rows || rows.length === 0) {
    throw new OtpError("Invalid or expired verification code", 400);
  }

  const otpRecord = rows[0];
  const now = new Date();
  const expiresAt = new Date(otpRecord.expires_at);

  // 1. Check expiration
  if (now > expiresAt) {
    throw new OtpError("Verification code has expired. Please request a new code.", 400);
  }

  // 2. Check maximum failed attempts threshold
  if (otpRecord.attempts >= otpRecord.max_attempts) {
    throw new OtpError("Too many failed attempts. This verification code has been locked. Please request a new code.", 400);
  }

  // 3. Constant-time timing-safe hash comparison
  const storedHash = String(otpRecord.otp_hash || "");
  const hashesMatch =
    storedHash.length === expectedDigest.length &&
    crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(expectedDigest));

  if (!hashesMatch) {
    const nextAttempts = otpRecord.attempts + 1;
    await query(
      "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?",
      [otpRecord.id]
    );
    const remaining = Math.max(0, otpRecord.max_attempts - nextAttempts);
    if (remaining === 0) {
      throw new OtpError("Too many failed attempts. This verification code has been locked. Please request a new code.", 400);
    }
    throw new OtpError(`Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, 400);
  }

  const verificationResult = { otpRecordId: otpRecord.id };

  // Issue a short-lived single-use JWT authorization token for the password update step (10 min expiry)
  const secretKey = getOtpSecret();
  const resetToken = await new SignJWT({
    sub: profile.id,
    email: profile.email,
    tokenVersion: profile.tokenVersion ?? 1,
    otpId: verificationResult.otpRecordId,
    purpose: "password_reset",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey);

  return { ok: true, resetToken };
}

/**
 * Updates a customer password using either a verified resetToken or direct (email, otp).
 * Atomically marks the OTP consumed, hashes the new password with bcrypt,
 * and increments token_version to invalidate all active sessions.
 */
export async function confirmPasswordReset(params: {
  resetToken?: string;
  email?: string;
  otp?: string;
  newPassword?: string;
  confirmPassword?: string;
}): Promise<{ ok: boolean; message: string }> {
  const newPassword = params.newPassword || "";
  const confirmPassword = params.confirmPassword || "";

  if (!newPassword || newPassword.length < 8) {
    throw new OtpError("Password must be at least 8 characters long", 400);
  }

  if (newPassword !== confirmPassword) {
    throw new OtpError("Passwords do not match", 400);
  }

  let targetUserId = "";
  let targetOtpId = "";
  let payloadTokenVersion: number | undefined;

  // Branch A: Verified resetToken JWT provided
  if (params.resetToken) {
    try {
      const secretKey = getOtpSecret();
      const { payload } = await jwtVerify(params.resetToken, secretKey, {
        algorithms: ["HS256"],
      });

      if (payload.purpose !== "password_reset" || !payload.sub || !payload.otpId) {
        throw new OtpError("Invalid or corrupted reset token", 400);
      }

      targetUserId = String(payload.sub);
      targetOtpId = String(payload.otpId);
      if (typeof payload.tokenVersion === "number") {
        payloadTokenVersion = payload.tokenVersion;
      }
    } catch (err: any) {
      if (err instanceof OtpError) throw err;
      throw new OtpError("Password reset session has expired or is invalid. Please request a new code.", 400);
    }
  } else if (params.email && params.otp) {
    // Branch B: Direct email & OTP supplied in one step
    const verifyRes = await verifyPasswordResetOtp({
      email: params.email,
      otp: params.otp,
    });
    // Extract userId from the verified token
    const secretKey = getOtpSecret();
    const { payload } = await jwtVerify(verifyRes.resetToken, secretKey, {
      algorithms: ["HS256"],
    });
    targetUserId = String(payload.sub);
    targetOtpId = String(payload.otpId);
    if (typeof payload.tokenVersion === "number") {
      payloadTokenVersion = payload.tokenVersion;
    }
  } else {
    throw new OtpError("Either resetToken or email and otp must be provided", 400);
  }

  // Atomically consume OTP and update password
  const newPasswordHash = await hashPassword(newPassword);

  await withTransaction(async (conn) => {
    // 1. Verify user profile exists, is active, and matches token_version
    const [userRows]: any = await conn.execute(
      "SELECT token_version, status FROM profiles WHERE id = ? FOR UPDATE",
      [targetUserId]
    );

    if (!userRows || userRows.length === 0) {
      throw new OtpError("Account not found", 404);
    }

    if (userRows[0].status === "suspended") {
      throw new OtpError("Account is suspended. Please contact customer support.", 403);
    }

    if (payloadTokenVersion !== undefined && userRows[0].token_version !== payloadTokenVersion) {
      throw new OtpError("Password reset session has expired or was revoked. Please request a new code.", 400);
    }

    // 2. Atomically consume OTP
    const [consumeRes]: any = await conn.execute(
      "UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = ? AND consumed_at IS NULL",
      [targetOtpId]
    );

    if (!consumeRes || consumeRes.affectedRows === 0) {
      throw new OtpError("This reset code has already been consumed. Please request a new one.", 400);
    }

    // 3. Update password hash, clear legacy reset columns, increment token_version to invalidate all existing sessions
    await conn.execute(
      `UPDATE profiles
       SET password_hash = ?,
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL,
           token_version = token_version + 1,
           updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, targetUserId]
    );
  });

  return {
    ok: true,
    message: "Your password has been successfully updated. Please sign in with your new password.",
  };
}
