import { NextResponse } from "next/server";
import {
  requireUser,
  updateCustomerProfile,
  handleAuthError,
  assertOwnerOrAdmin,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

/**
 * Validates and normalizes an Indian phone number string.
 * Supports "+919876543210", "919876543210", "09876543210", "9876543210", or formatted with spaces/hyphens.
 * Returns null if input is null or empty string.
 * Returns normalized 10-digit string if valid.
 * Throws Error with descriptive message if invalid.
 */
function validateAndNormalizePhone(rawPhone: unknown): string | null {
  if (rawPhone === null || rawPhone === undefined) {
    return null;
  }
  if (typeof rawPhone !== "string") {
    throw new Error("Phone number must be a valid string");
  }

  const trimmed = rawPhone.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "not provided") {
    return null;
  }

  // Check for disallowed characters (letters or special chars other than +, -, (, ), space)
  if (/[^0-9\s\-\(\)\+]/.test(trimmed)) {
    throw new Error("Phone number must contain only valid digits and telephone formatting characters");
  }

  // Strip non-digits
  const digitsOnly = trimmed.replace(/\D/g, "");

  // Normalize Indian country code prefixes
  let cleaned = digitsOnly;
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  if (cleaned.length !== 10 || !INDIAN_PHONE_REGEX.test(cleaned)) {
    throw new Error("Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9");
  }

  return cleaned;
}

/**
 * GET /api/customer/profile
 * Returns the currently authenticated customer's sanitized profile.
 * Identity is derived exclusively from the verified session cookie.
 * Unauthenticated -> 401 Unauthorized
 */
export async function GET() {
  try {
    const user = await requireUser();

    return NextResponse.json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Authentication required");
  }
}

/**
 * PATCH /api/customer/profile
 * Updates the authenticated customer's own profile.
 *
 * Security Enforcements:
 * 1. Authentication: Verified dearr_session cookie strictly required (401).
 * 2. IDOR Protection: Reject any request targeting a user ID other than the authenticated user (403).
 * 3. Role Escalation: Reject any attempt to modify or declare role (403).
 * 4. Credential Protection: Protected fields (password_hash, etc.) are strictly ignored/prevented.
 * 5. Input Validation: Validate full name (2-150 chars) and Indian phone number (10 digits) (400).
 * 6. Empty Payloads: Reject requests providing no valid update fields (400).
 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body must be a valid JSON object" },
        { status: 400 }
      );
    }

    // IDOR Protection: Target user ID must match the session's authenticated user unless admin
    const targetUserId =
      body.targetUserId ?? body.userId ?? (body.id && body.id !== user.id ? body.id : undefined);

    if (targetUserId && typeof targetUserId === "string") {
      try {
        assertOwnerOrAdmin(user, targetUserId);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Forbidden: Cannot modify another customer's profile" },
          { status: 403 }
        );
      }
    }

    // Role Escalation Protection: Reject any client attempt to change or declare role
    if (body.role !== undefined && body.role !== user.role) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Role modification is not permitted" },
        { status: 403 }
      );
    }

    // Extract acceptable update fields
    const rawName = body.fullName !== undefined ? body.fullName : body.full_name;
    const rawPhone = body.phone;

    // Check if at least one updatable field is provided
    if (rawName === undefined && rawPhone === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: "At least one valid field (fullName or phone) must be provided for update",
        },
        { status: 400 }
      );
    }

    // Validate Full Name if provided
    let validatedName: string | undefined = undefined;
    if (rawName !== undefined) {
      if (typeof rawName !== "string") {
        return NextResponse.json(
          { ok: false, error: "Full name must be a valid string" },
          { status: 400 }
        );
      }
      const trimmedName = rawName.trim();
      if (trimmedName.length < 2) {
        return NextResponse.json(
          { ok: false, error: "Full name must be at least 2 characters long" },
          { status: 400 }
        );
      }
      if (trimmedName.length > 150) {
        return NextResponse.json(
          { ok: false, error: "Full name cannot exceed 150 characters" },
          { status: 400 }
        );
      }
      validatedName = trimmedName;
    }

    // Validate Phone if provided
    let validatedPhone: string | null | undefined = undefined;
    if (rawPhone !== undefined) {
      try {
        validatedPhone = validateAndNormalizePhone(rawPhone);
      } catch (phoneErr: any) {
        return NextResponse.json(
          { ok: false, error: phoneErr.message || "Invalid phone number" },
          { status: 400 }
        );
      }
    }

    // Target profile ID to update (admins can target another user, customers only themselves)
    const effectiveTargetId =
      user.role === "admin" && targetUserId && typeof targetUserId === "string"
        ? targetUserId
        : user.id;

    const updated = await updateCustomerProfile(effectiveTargetId, {
      fullName: validatedName,
      phone: validatedPhone,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Return sanitized profile (guaranteed never to return password_hash)
    return NextResponse.json({
      ok: true,
      profile: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    });
  } catch (err: unknown) {
    return handleAuthError(err, "Failed to update profile");
  }
}
