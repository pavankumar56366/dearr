# Dearr Google OAuth Authentication

**Version:** V1  
**Date:** 2026-10-04  
**Status:** Implemented ✅

---

## Overview

Dearr V1 supports Google OAuth 2.0 / OpenID Connect as a customer sign-in method alongside the existing email/password authentication. The implementation is direct — no third-party authentication library (Auth.js, Firebase Auth, Clerk, etc.) is used.

Google proves identity. Dearr manages its own application session.

---

## Architecture

```
Browser                    Dearr Server              Google
  │                             │                       │
  │── GET /api/auth/google ────>│                       │
  │                             │ generate state        │
  │                             │ set state cookie      │
  │<── 302 → accounts.google ───│                       │
  │                                                     │
  │── Google sign-in ──────────────────────────────────>│
  │<── 302 → /api/auth/google/callback?code=X&state=Y ──│
  │                             │                       │
  │── GET /callback?code=X ────>│                       │
  │                             │ validate state CSRF   │
  │                             │ exchange code ──────>│
  │                             │<──── id_token ────────│
  │                             │ verify id_token JWKS  │
  │                             │ extract sub, email    │
  │                             │ find/create profile   │
  │                             │ createSessionToken    │
  │<── 302 /account + cookie ───│                       │
```

---

## OAuth Flow Detail

### Step 1 — Initiation (`/api/auth/google`)

- Generates a 32-byte cryptographically secure random `state` string.
- Stores it in a short-lived **HttpOnly** cookie (`dearr_google_state`, 10-minute TTL).
- Redirects to Google's authorization endpoint with `response_type=code`, `scope=openid email profile`, `client_id`, `redirect_uri`, `state`.
- **`GOOGLE_CLIENT_SECRET` is never in this URL.**

### Step 2 — Callback (`/api/auth/google/callback`)

1. **State validation (CSRF)**: Compares `?state=` param against stored cookie. Mismatches rejected immediately.
2. **Code exchange**: `POST https://oauth2.googleapis.com/token` — `GOOGLE_CLIENT_SECRET` server-side only.
3. **ID token verification**: `jose` + Google JWKS. Checks RS256 signature, issuer, audience, expiry, `email_verified=true`, `sub`.
4. **Profile resolution**: find by `google_subject`, or create new customer.
5. **Session**: `createSessionToken()` + `attachSessionCookie()` — identical to email/password login.
6. **Redirect** to `/account`.

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | `*.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | **Server-only. Never NEXT_PUBLIC.** |
| `GOOGLE_REDIRECT_URI` | Yes | Must match Google Cloud Console |

**Local:** `http://localhost:3000/api/auth/google/callback`  
**Production:** `https://dearr.in/api/auth/google/callback`

> Both URIs must be registered in Google Cloud Console → OAuth 2.0 Client ID → Authorized redirect URIs.

---

## Database Schema Change

Migration `002_google_oauth.sql`:

```sql
ALTER TABLE profiles
  ADD COLUMN google_subject VARCHAR(255) DEFAULT NULL AFTER email,
  ADD UNIQUE KEY idx_profiles_google_subject (google_subject);

ALTER TABLE profiles
  MODIFY COLUMN password_hash VARCHAR(255) DEFAULT NULL;
```

| Column | Change |
|---|---|
| `google_subject` | Added — nullable, UNIQUE — stores Google `sub` |
| `password_hash` | Made nullable — Google-only accounts have no password |

Existing email/password accounts are unaffected.

---

## Account Behavior

| Scenario | Action |
|---|---|
| New Google user | Create profile: `role='customer'`, `password_hash=NULL`, `google_subject=sub` |
| Returning Google user | Load existing profile by `google_subject`. Role preserved from DB. |
| Existing email/password account (same email, no Google link) | **Blocked** — redirect to `/login?error=email_exists_use_password`. No automatic merge. |
| Admin account | Google login never creates or upgrades to `role='admin'`. Role always read from DB. |

---

## Security Guarantees

| Concern | Implementation |
|---|---|
| `GOOGLE_CLIENT_SECRET` server-only | Only used in `exchangeGoogleCode()` — server-side |
| No `NEXT_PUBLIC_*` exposure | Verified by tests |
| CSRF protection | 256-bit random state, HttpOnly cookie, strict comparison |
| ID token integrity | Cryptographic JWKS verification (not decode-and-trust) |
| Role escalation | `role` always from DB — never from Google token |
| Admin protection | `createGoogleProfile()` hardcodes `role='customer'` |
| Email takeover | Existing email/password accounts NOT auto-merged |

---

## Session Integration

The callback issues `dearr_session` using `createSessionToken()` + `attachSessionCookie()` — identical to email/password login. Same JWT structure, signing key, cookie options, and `requireUser()` / `requireAdmin()` enforcement. Google-authenticated users log out the same way.

---

## Files Changed

| File | Change |
|---|---|
| `src/app/api/auth/google/route.ts` | New — OAuth initiation |
| `src/app/api/auth/google/callback/route.ts` | New — OAuth callback |
| `src/lib/server/google-oauth.ts` | New — Server-only OAuth library |
| `src/lib/server/index.ts` | Updated — Exports Google OAuth functions |
| `src/lib/server/profile.ts` | Updated — `passwordHash: string | null` |
| `src/components/customer/auth/LoginForm.tsx` | Updated — Google button wired to real route |
| `src/components/customer/auth/LoginView.tsx` | Updated — Passes `oauthError` to `LoginForm` |
| `database/migrations/002_google_oauth.sql` | New — Schema migration SQL |
| `database/run-migration-002-google-oauth.ts` | New — Migration runner |
| `database/verify-google-auth.ts` | New — 36-test verification suite |

---

## Test Results

**Verification suite**: 36/36 PASSED — exit code 0  
**TypeScript**: `npx tsc --noEmit` → 0 errors  
**Browser**: Login page → Google button → accounts.google.com redirect ✅  
**Build**: `npm run build` → 116/116 routes compiled ✅

---

## Production Deployment Checklist

- [ ] Add `https://dearr.in/api/auth/google/callback` to Google Cloud Console Authorized Redirect URIs
- [ ] Set `GOOGLE_REDIRECT_URI=https://dearr.in/api/auth/google/callback` in Hostinger environment variables
- [ ] Publish Google OAuth consent screen (not Testing mode)
- [ ] Verify `NODE_ENV=production` so `Secure` cookie flag is applied
