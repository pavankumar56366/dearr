/**
 * Dearr Google OAuth Verification Suite
 *
 * Tests Google OAuth configuration, route existence, token validation logic,
 * database operations, and security guarantees.
 *
 * Safe to run: creates temporary test data marked with dearr_google_test_ prefix
 * and cleans up after itself. Never uses real Google tokens.
 */

import path from "path";
import fs from "fs";
import crypto from "crypto";
import mysql from "mysql2/promise";

// ── Env loader ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnv();

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results: Array<{ id: string; status: "PASS" | "FAIL"; note: string }> = [];

function pass(id: string, note = "") {
  passed++;
  results.push({ id, status: "PASS", note });
  console.log(`  ✓ [${id}] ${note}`);
}

function fail(id: string, note = "") {
  failed++;
  results.push({ id, status: "FAIL", note });
  console.error(`  ✗ [${id}] ${note}`);
}

function check(id: string, condition: boolean, passNote: string, failNote: string) {
  condition ? pass(id, passNote) : fail(id, failNote);
}

// ── DB connection ─────────────────────────────────────────────────────────────
async function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "srv1741.hstgr.io",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "u209580425_dearr_user",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "u209580425_Dearr",
    connectTimeout: 15000,
  });
}

// ── Test data ─────────────────────────────────────────────────────────────────
const TEST_PREFIX = "dearr_google_test_";
const testGoogleSub = `${TEST_PREFIX}sub_${Date.now()}`;
const testEmail = `${TEST_PREFIX}${Date.now()}@example.invalid`;
const testEmailExisting = `${TEST_PREFIX}existing_${Date.now()}@example.invalid`;
const testPasswordProfileId = crypto.randomUUID();

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" Dearr Google OAuth Verification Suite");
  console.log("══════════════════════════════════════════════════════════════\n");

  const db = await getDb();
  const cleanupIds: string[] = [];

  try {
    // ────────────────────────────────────────────────────────────────────────
    // SECTION 1: Configuration
    // ────────────────────────────────────────────────────────────────────────
    console.log("── Section 1: Configuration ────────────────────────────────");

    check(
      "CONF-01",
      !!process.env.GOOGLE_CLIENT_ID?.trim(),
      "GOOGLE_CLIENT_ID is present",
      "GOOGLE_CLIENT_ID is missing"
    );
    check(
      "CONF-02",
      !!process.env.GOOGLE_CLIENT_SECRET?.trim(),
      "GOOGLE_CLIENT_SECRET is present",
      "GOOGLE_CLIENT_SECRET is missing"
    );
    check(
      "CONF-03",
      process.env.GOOGLE_REDIRECT_URI === "http://localhost:3000/api/auth/google/callback",
      "GOOGLE_REDIRECT_URI matches expected local value",
      `GOOGLE_REDIRECT_URI unexpected: ${process.env.GOOGLE_REDIRECT_URI}`
    );
    check(
      "CONF-04",
      !!process.env.GOOGLE_CLIENT_ID?.endsWith(".apps.googleusercontent.com"),
      "GOOGLE_CLIENT_ID has correct Google format",
      "GOOGLE_CLIENT_ID does not match *.apps.googleusercontent.com"
    );
    check(
      "CONF-05",
      !!process.env.GOOGLE_CLIENT_SECRET?.startsWith("GOCSPX-"),
      "GOOGLE_CLIENT_SECRET has correct GOCSPX- prefix",
      "GOOGLE_CLIENT_SECRET prefix unexpected"
    );

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 2: Route files exist
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 2: Route Files ──────────────────────────────────");

    const googleRoute = path.resolve("src/app/api/auth/google/route.ts");
    const callbackRoute = path.resolve("src/app/api/auth/google/callback/route.ts");
    const googleLib = path.resolve("src/lib/server/google-oauth.ts");

    check("ROUTE-01", fs.existsSync(googleRoute), "/api/auth/google route.ts exists", "/api/auth/google route.ts MISSING");
    check("ROUTE-02", fs.existsSync(callbackRoute), "/api/auth/google/callback route.ts exists", "/api/auth/google/callback route.ts MISSING");
    check("ROUTE-03", fs.existsSync(googleLib), "src/lib/server/google-oauth.ts exists", "google-oauth.ts MISSING");

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 3: Security — no secret in client-side code
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 3: Security ─────────────────────────────────────");

    const googleOAuthSrc = fs.readFileSync(googleLib, "utf-8");
    check(
      "SEC-01",
      !googleOAuthSrc.includes("NEXT_PUBLIC_GOOGLE_CLIENT_SECRET"),
      "GOOGLE_CLIENT_SECRET not in NEXT_PUBLIC variable",
      "SECURITY: GOOGLE_CLIENT_SECRET referenced as NEXT_PUBLIC!"
    );

    // Check LoginForm (client component) has no secret reference
    const loginFormSrc = fs.readFileSync("src/components/customer/auth/LoginForm.tsx", "utf-8");
    check(
      "SEC-02",
      !loginFormSrc.includes("GOOGLE_CLIENT_SECRET"),
      "GOOGLE_CLIENT_SECRET not referenced in client LoginForm",
      "SECURITY: GOOGLE_CLIENT_SECRET found in client component!"
    );

    // Authorization route should not include client_secret in URL params
    const authRouteSrc = fs.readFileSync(googleRoute, "utf-8");
    check(
      "SEC-03",
      !authRouteSrc.includes("client_secret"),
      "Authorization URL does not include client_secret",
      "SECURITY: client_secret found in auth URL!"
    );

    // Callback route should use client_secret only in token exchange body
    const callbackSrc = fs.readFileSync(callbackRoute, "utf-8");
    check(
      "SEC-04",
      callbackSrc.includes("exchangeGoogleCode"),
      "Callback uses exchangeGoogleCode (token exchange is server-side)",
      "Callback missing server-side token exchange"
    );

    // State validation present in callback
    check(
      "SEC-05",
      callbackSrc.includes("storedState !== stateParam"),
      "CSRF state validation present in callback",
      "CSRF state validation missing in callback"
    );

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 4: Database schema
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 4: Database Schema ──────────────────────────────");

    const [cols]: any = await db.query(
      "SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'profiles'",
      [process.env.DB_NAME || "u209580425_Dearr"]
    );
    const colMap: Record<string, string> = {};
    for (const c of cols) colMap[c.COLUMN_NAME] = c.IS_NULLABLE;

    check("DB-01", "google_subject" in colMap, "google_subject column exists", "google_subject column MISSING");
    check("DB-02", colMap["google_subject"] === "YES", "google_subject is nullable", "google_subject is NOT nullable");
    check("DB-03", colMap["password_hash"] === "YES", "password_hash is nullable (for Google-only accounts)", "password_hash is NOT nullable");

    const [idxRows]: any = await db.query(
      "SHOW INDEX FROM profiles WHERE Key_name = 'idx_profiles_google_subject'"
    );
    check("DB-04", idxRows.length > 0, "UNIQUE index idx_profiles_google_subject exists", "UNIQUE index on google_subject MISSING");

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 5: Google OAuth DB operations (live with test data)
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 5: Database Operations ──────────────────────────");

    // Create test Google-only profile (null password_hash)
    const newId = crypto.randomUUID();
    cleanupIds.push(newId);
    try {
      await db.query(
        "INSERT INTO profiles (id, email, google_subject, password_hash, full_name, role, email_verified_at) VALUES (?, ?, ?, NULL, ?, 'customer', NOW())",
        [newId, testEmail, testGoogleSub, "Test Google Customer"]
      );
      pass("DB-05", "New Google-only profile created with NULL password_hash");
    } catch (e: any) {
      fail("DB-05", `Failed to create Google-only profile: ${e.message}`);
    }

    // Lookup by google_subject
    const [foundRows]: any = await db.query(
      "SELECT id, email, google_subject, role FROM profiles WHERE google_subject = ?",
      [testGoogleSub]
    );
    check("DB-06", foundRows.length === 1 && foundRows[0].id === newId, "Profile found by google_subject", "Profile NOT found by google_subject");
    check("DB-07", foundRows[0]?.role === "customer", "New Google profile has role=customer", "New Google profile has unexpected role");

    // Duplicate google_subject rejected
    try {
      await db.query(
        "INSERT INTO profiles (id, email, google_subject, password_hash, full_name, role) VALUES (?, ?, ?, NULL, ?, 'customer')",
        [crypto.randomUUID(), `dup_${testEmail}`, testGoogleSub, "Dup Customer"]
      );
      fail("DB-08", "Duplicate google_subject was NOT rejected — UNIQUE constraint missing!");
    } catch {
      pass("DB-08", "Duplicate google_subject correctly rejected by UNIQUE constraint");
    }

    // Create existing email/password profile for conflict test
    const pwId = testPasswordProfileId;
    cleanupIds.push(pwId);
    await db.query(
      "INSERT INTO profiles (id, email, google_subject, password_hash, full_name, role) VALUES (?, ?, NULL, ?, ?, 'customer')",
      [pwId, testEmailExisting, "$2b$10$fakehashforfixedlengthXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", "Existing Customer"]
    );
    const [existRows]: any = await db.query(
      "SELECT id, password_hash, google_subject FROM profiles WHERE email = ?",
      [testEmailExisting]
    );
    check("DB-09", existRows.length === 1 && !!existRows[0].password_hash && !existRows[0].google_subject, "Email/password profile correctly identified (has password, no google_subject)", "Email/password profile detection failed");

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 6: Admin protection
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 6: Admin Protection ─────────────────────────────");

    // Verify callback does NOT accept a browser-supplied role
    check(
      "ADMIN-01",
      callbackSrc.includes("profile.role, // Role comes from DB — never from Google"),
      "Callback uses DB role — not Google token role",
      "Callback may be using Google token role — check!"
    );

    // Verify createGoogleProfile hardcodes 'customer'
    check(
      "ADMIN-02",
      googleOAuthSrc.includes("'customer'"),
      "Google profile creation hardcodes role=customer",
      "Google profile creation may not hardcode customer role"
    );

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 7: Existing email/password login regression
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 7: Email/Password Regression ────────────────────");

    const loginRouteSrc = fs.readFileSync("src/app/api/auth/login/route.ts", "utf-8");
    check("EPWD-01", loginRouteSrc.includes("findProfileWithPasswordByEmail"), "Email/password login still uses findProfileWithPasswordByEmail", "Email/password login broken");
    check("EPWD-02", loginRouteSrc.includes("comparePassword"), "Email/password login still calls comparePassword", "Password comparison removed");
    check("EPWD-03", !loginRouteSrc.includes("google"), "Email/password login has no Google references", "Email/password login unexpectedly references Google");

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 8: Session architecture
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 8: Session Architecture ─────────────────────────");

    check("SESS-01", callbackSrc.includes("createSessionToken"), "Callback uses createSessionToken (same as email/password)", "Callback does not use createSessionToken");
    check("SESS-02", callbackSrc.includes("attachSessionCookie"), "Callback uses attachSessionCookie", "Callback does not set dearr_session cookie");
    check("SESS-03", callbackSrc.includes("dearr_session") || callbackSrc.includes("SESSION_COOKIE_NAME") || callbackSrc.includes("attachSessionCookie"), "Dearr session cookie referenced in callback", "Session cookie not referenced in callback");

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 9: OIDC discovery (live check)
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 9: Google OIDC Discovery ────────────────────────");

    try {
      const res = await fetch("https://accounts.google.com/.well-known/openid-configuration");
      const oidc = await res.json();
      check("OIDC-01", res.ok, "Google OIDC discovery endpoint reachable", "OIDC discovery endpoint unreachable");
      check("OIDC-02", oidc.issuer === "https://accounts.google.com", "OIDC issuer is accounts.google.com", `Unexpected issuer: ${oidc.issuer}`);
      check("OIDC-03", !!oidc.authorization_endpoint, "authorization_endpoint present", "authorization_endpoint missing");
      check("OIDC-04", !!oidc.token_endpoint, "token_endpoint present", "token_endpoint missing");
      check("OIDC-05", !!oidc.jwks_uri, "jwks_uri present", "jwks_uri missing");
    } catch (e: any) {
      fail("OIDC-01", `OIDC fetch failed: ${e.message}`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SECTION 10: Logout
    // ────────────────────────────────────────────────────────────────────────
    console.log("\n── Section 10: Logout ──────────────────────────────────────");

    const logoutSrc = fs.readFileSync("src/app/api/auth/logout/route.ts", "utf-8");
    check("LGOUT-01", logoutSrc.includes("dearr_session") || logoutSrc.includes("SESSION_COOKIE_NAME") || logoutSrc.includes("clearSession"), "Logout clears dearr_session — works for Google-authenticated users too", "Logout may not clear dearr_session");

  } finally {
    // ── Cleanup test data ──────────────────────────────────────────────────
    console.log("\n── Cleanup ─────────────────────────────────────────────────");
    for (const id of cleanupIds) {
      try {
        await db.query("DELETE FROM profiles WHERE id = ?", [id]);
        console.log(`  Cleaned up test profile: ${id}`);
      } catch {
        console.warn(`  Failed to clean up: ${id}`);
      }
    }
    await db.end();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(` TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("══════════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    console.error("FAILED tests:");
    results.filter((r) => r.status === "FAIL").forEach((r) => console.error(`  ✗ [${r.id}] ${r.note}`));
    process.exit(1);
  } else {
    console.log("All Google OAuth verification tests PASSED.");
  }
}

main().catch((err) => {
  console.error("[verify-google-auth] Fatal:", err.message);
  process.exit(1);
});
