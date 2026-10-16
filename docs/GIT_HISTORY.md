# Dearr Git History & Repository Status Reference

This document provides a verified, comprehensive reference of the Dearr repository state, release history, local feature commits, and security remediation milestones.

> [!NOTE]
> Remote tracking references (`origin/main`, `origin/HEAD`) reflect the last locally cached state. In accordance with project safety rules, no remote network calls (`git fetch` or `git push`) were executed during this inspection. Remote GitHub status cannot be independently verified without contacting the remote.

---

## Table A — Current Git Status

| Item | Value |
|---|---|
| Project / Repository Root | `D:\Desktop\dearr-next-feature` |
| Current Branch | `feature/cart-abandonment-recovery` |
| Current HEAD Commit | `9154a79258221a4539d62bf68a67018e2d88b6f8` (`9154a79 fix(security): resolve CSRF, JWT revocation, rate limiting, and cache control`) |
| Local `main` Baseline | `1cf0a70702ff2f4f3d1257dbdc1f846b6a49f56e` (`1cf0a70 docs: record Dearr v1.3.1 deployment and live verification`) |
| Cached `origin/main` | `1cf0a70702ff2f4f3d1257dbdc1f846b6a49f56e` (8 commits behind HEAD) |
| Local Commits Ahead of `origin/main` | 8 commits (`1cf0a70..9154a79`: `a323a66`, `5b2a723`, `25b5d1f`, `4066077`, `0ca7515`, `b29ef2a`, `df00788`, `9154a79`) |
| Latest Production Version Tag | `v1.3.1` (verified live on `https://dearr.in`) |
| Production Deployed Commit | `0862901d5ce10d2d7a7237d93c788cf561a5ea18` (Hostinger Build `01a12db3-3c51-7045-adc5-3dd10bc40c49`) |
| Working Tree State | 0 staged files; 2 modified tracked files (`AGENTS.md` and `docs/GIT_HISTORY.md`); 22 untracked test/utility items preserved |

---

## Table B — Main and Released History

Significant milestones in the known `main` and released commit history:

| Commit | Date | Important Change | Version/Tag | Status |
|---|---|---|---|---|
| `fb4a2a7` | 2026-10-05 | Complete admin data integration for V1 | `v1.0.0` | Released (Initial V1) |
| `15fed57` | 2026-10-07 | Finalize Dearr v1.1.0 release history | `v1.1.0` | Released (V1.1 update) |
| `c7db367` | 2026-10-07 | Finalize Dearr v1.1.1 release history (source-map-js security patch) | `v1.1.1` | Released (Security patch) |
| `00765bb` | 2026-10-11 | Persistent uploads self-healing, direct image rendering fix, checkout fixes | `v1.2.1` | Released & Deployed to production |
| `0862901` | 2026-10-12 | Transparent Dearr logo, 4-stage order tracking, v1.3.1 release prep | `v1.3.1` | Released & Deployed to production (Current Live) |
| `1cf0a70` | 2026-10-12 | Record Dearr v1.3.1 deployment and live verification | — | Local `main` / Cached `origin/main` baseline |

---

## Table C — Version Tags and Production Releases

| Version/Tag | Tag Target Commit | Release Date | Production Status | Notes |
|---|---|---|---|---|
| `v1.0.0` | `fb4a2a71662211e3970daa731d7db422c40d48d7` | 2026-10-05 | Released / Deployed | Initial V1 release tag |
| `v1.1.0` | `15fed574f9c8667462cdf63364fbf07561dbef76` | 2026-10-07 | Released / Deployed | V1.1 feature release tag |
| `v1.1.1` | `c7db367fe8538dcca538d25eb00429dde5e639fc` | 2026-10-07 | Released / Deployed | High-severity security vulnerability patch |
| `v1.2.1` | `00765bb545de321ac65f11949438ec73ab9691cd` | 2026-10-11 | Deployed to production | Hostinger Build `01a12796-ec6b-7368-a2de-23f36d46571b`; direct image rendering & persistent uploads |
| `v1.3.1` | `0862901d5ce10d2d7a7237d93c788cf561a5ea18` | 2026-10-12 | Deployed to production (Current Live) | Hostinger Build `01a12db3-3c51-7045-adc5-3dd10bc40c49`; transparent logo & 4-stage tracking |

*All tags exist in local Git repository metadata. Tag targets are verified exact matches.*

---

## Table D — Chronological Local Feature & Security Commits

Commits present locally on `feature/cart-abandonment-recovery` that are **not** in the cached `origin/main` history, listed in chronological order:

| Commit | Date & Time | Message | Main Changes |
|---|---|---|---|
| `a323a66` | 2026-10-13 18:57:53 +0530 | `feat: add order analytics and abandoned checkout handling` | Added Migration 005 (`005_orders_analytics_and_checkout_attempts.sql`), checkout attempts tracking, order analytics APIs (`/api/admin/orders/summary`, export, cleanup), and dashboard fixtures. |
| `5b2a723` | 2026-10-14 09:19:44 +0530 | `feat: add product color variants and multi-color cart` | Added Migration 006 (`006_product_color_variants.sql`), product color variants schema, multi-color cart support, admin color manager, and customer variant selector. |
| `25b5d1f` | 2026-10-14 16:31:54 +0530 | `feat: allow customers to change delivery address` | Added Migration 007 (`007_order_address_change.sql`), customer address editing window and audit trail, admin settings for address change window, and order detail UI. |
| `4066077` | 2026-10-15 09:07:03 +0530 | `feat: add cart abandonment recovery and insights` | Added Migration 008 (`008_cart_abandonment_recovery.sql`), abandonment recovery analytics, recovery discount tokens, exit-intent modal, consent tracking, and admin dashboard. |
| `0ca7515` | 2026-10-16 09:11:23 +0530 | `chore: update test runner pool drains, dev dependencies, and git history docs` | Updated test runner pool drains (`scripts/test-color-variants-e2e.ts`, `scripts/verify-orders-analytics.mjs`), package-lock updates, and documentation references. |
| `b29ef2a` | 2026-10-16 09:12:18 +0530 | `feat(checkout): remediate payment verification security and implement product-level COD policy` | Remediated payment verification vulnerability by binding checkout attempts strictly to server-stored provider order IDs; enforced server-authoritative checkout policies rejecting client direct-order mode; implemented per-product Cash on Delivery (COD) eligibility via Migration 009 (`009_product_cod_eligibility.sql`), admin COD toggles, and customer checkout enforcement; added regression test suites (`test-payment-verification-security.ts`, `test-product-cod-eligibility.ts`). |
| `df00788` | 2026-10-16 12:14:42 +0530 | `security: harden authentication and HTTP security controls` | Upgraded Next.js and ESLint to `16.4.2` to resolve 6 High Next.js runtime advisories; implemented IP- and account-aware login rate limiting and IP signup rate limiting with RFC-compliant HTTP 429 + `Retry-After`; implemented `assertSafeOrigin(request)` for CSRF defense; added HTTP security headers and CSP tailored for Razorpay checkout, Google fonts, and Google OAuth; added constant-time SHA-256 comparison for CRON secret cleanup route; added test suites (`test-auth-rate-limiting.ts`, `verify-security-headers.ts`). |
| `9154a79` | 2026-10-16 18:10:21 +0530 | `fix(security): resolve CSRF, JWT revocation, rate limiting, and cache control` | Added Migration 010 (`010_token_version_revocation.sql`) introducing `profiles.token_version` and implemented server-side JWT session revocation on logout and password reset; fortified `assertSafeOrigin(request)` and systematically enforced CSRF origin protection across all 38 cookie-authenticated mutation endpoints; bounded unknown-account login rate limits to `login:fail:unknown_accounts` (max 15 hits/900s) and standardized IP throttling; introduced shared `jsonPrivate` helper enforcing `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` across all private authenticated routes; added remaining-vulnerability audit suite (`audit-remaining-vulnerabilities.ts`, 36/36 pass). |

---

## Branch Ancestry & Cumulative Merging

The local feature and security remediation commits form a single, unbroken linear chain:

```text
1cf0a70 (origin/main, origin/HEAD, main, feature/privacy-security-seo-hardening)
   └── a323a66 (feature/next-feature)
          └── 5b2a723 (feature/product-color-variants)
                 └── 25b5d1f (feature/order-address-change)
                        └── 4066077
                               └── 0ca7515
                                      └── b29ef2a
                                             └── df00788
                                                    └── 9154a79 (feature/cart-abandonment-recovery, HEAD)
```

**Cumulative Merge Implication**: Because `feature/cart-abandonment-recovery` directly descends through this chain, merging it into `main` will automatically bring all 8 ancestor commits and sequential database migrations (`005` → `006` → `007` → `008` → `009` → `010`) into `main`.

---

## Feature & Security Milestones Summary

### 1. Order Analytics & Abandoned Checkout Handling (`a323a66`)
- Tracks checkout initiation, attempts, and outcomes.
- Implements `/api/admin/orders/summary`, `/api/admin/orders/export`, and automated attempt cleanup.
- Introduces Migration `005_orders_analytics_and_checkout_attempts.sql`.

### 2. Product Color Variants & Multi-Color Cart (`5b2a723`)
- Supports product color variants with dedicated images, stock, and SKU overrides.
- Allows customers to add multiple color variations of the same product to cart.
- Adds admin color management UI and customer gallery color switching.
- Introduces Migration `006_product_color_variants.sql`.

### 3. Customer Delivery Address Modification (`25b5d1f`)
- Allows customers to edit shipping addresses for pending/unfulfilled orders within a configurable time window.
- Provides admin store settings to adjust the allowed modification window.
- Maintains a full audit history of address edits.
- Introduces Migration `007_order_address_change.sql`.

### 4. Cart Abandonment Recovery & Conversion Analytics (`4066077`)
- Provides cart recovery sheets and exit-intent capture for abandoned carts.
- Tracks customer notification consent and generates recovery discount tokens.
- Introduces admin abandonment analytics dashboard.
- Introduces Migration `008_cart_abandonment_recovery.sql`.

### 5. Payment Verification Security & Product-Level COD Policy (`b29ef2a`)
- **Payment Verification Remediation**: Eliminates signature verification bypass by binding checkout attempts strictly to server-stored provider order IDs. Rejects mismatched or unbound checkout attempt signatures.
- **Server-Authoritative Checkout Policy**: Blocks customer-supplied direct order mode bypass; enforces online prepaid checkout whenever store policy mandates online payments.
- **Product-Level COD Eligibility**: Adds `is_cod_allowed TINYINT(1) DEFAULT 1` to products table via Migration `009_product_cod_eligibility.sql`. Enforces server-side validation during cart checkout and Buy Now flows; disables COD option if any item in cart is COD-ineligible.
- **Admin & Storefront UI**: Adds COD toggle in admin product form and clear customer prompts during checkout.
- **Regression Suites**: Adds `scripts/test-payment-verification-security.ts` (26 tests) and `scripts/test-product-cod-eligibility.ts` (22 tests).

### 6. Authentication & HTTP Security Hardening (`df00788`)
- **Next.js Dependency Upgrade**: Upgraded `next` and `eslint-config-next` from `16.3.6` to `16.4.2`, resolving 6 official Next.js runtime security advisories (SSRF, cache poisoning, DoS).
- **Authentication Rate Limiting**: Added IP- and account-aware rate limiting in `/api/auth/login` and IP rate limiting in `/api/auth/signup`. Non-existent emails increment only IP counters to prevent DB bloat; valid logins reset failure counters; returns HTTP 429 with RFC-compliant `Retry-After`. Loopback tolerance prevents locking out automated test suites.
- **CSRF / Origin Hardening**: Implemented `assertSafeOrigin(request)` utility to enforce same-origin verification on state-changing requests.
- **HTTP Security Headers & CSP**: Configured `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, conditional production HSTS, and a Content Security Policy supporting Razorpay checkout modal, CDN risk-detection, Google fonts, and Google OAuth avatars.
- **CRON Secret Comparison**: Hardened `/api/admin/orders/cleanup` using SHA-256 constant-time comparison via `crypto.timingSafeEqual`.
- **Verification Suites**: Added `scripts/test-auth-rate-limiting.ts` (24 tests) and `scripts/verify-security-headers.ts` (5 tests).

### 7. Comprehensive Security Remediation & Server-Side JWT Revocation (`9154a79`)
- **Server-Side Token Revocation & Migration 010**: Added Migration `010_token_version_revocation.sql` introducing `profiles.token_version`. Embedded `tokenVersion` into JWT payload; `getCurrentUser()` and `requireUser()` verify token claims against database version. Logout and password changes increment `token_version`, immediately invalidating previously copied tokens.
- **Systematic CSRF Protection**: Enforced `assertSafeOrigin(request)` across 38 cookie-authenticated mutation endpoints (auth, cart, orders, addresses, wishlist, notifications, checkout attempts, admin). Machine integrations (`/api/payments/webhook` via Razorpay HMAC and `/api/admin/orders/cleanup` via bearer token) preserve cryptographic signature authentication.
- **Rate-Limiting Bounding**: Enforced `login:fail:unknown_accounts` (max 15 hits/900s) preventing table bloat and account lockout abuse from spoofed forwarded headers.
- **Private Anti-Caching Headers**: Built shared `jsonPrivate` and `withPrivateCacheHeaders` utilities setting `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` across all private authenticated endpoints.
- **Comprehensive Verification Suite**: Added `scripts/audit-remaining-vulnerabilities.ts` testing 36 distinct security cases with 100% pass rate.

---

## Database & Migration History

| Migration | Purpose | Status in `dearr_test` (Local) | Status in Production (`dearr.in`) |
|---|---|---|---|
| `001_initial_schema.sql` | Baseline tables (products, orders, customers, etc.) | Applied | Applied (v1.0.0) |
| `002_google_oauth.sql` | Google OAuth columns | Applied | Applied (v1.1.0) |
| `003_customer_status_and_store_settings.sql` | Customer status and store settings | Applied | Applied (v1.1.0) |
| `004_category_browsing_metrics.sql` | Category browsing analytics | Applied | Applied (v1.2.1) |
| `005_orders_analytics_and_checkout_attempts.sql` | Order analytics & checkout attempts tracking | Applied locally | **Pending release / Not applied** |
| `006_product_color_variants.sql` | Product color variants schema | Applied locally | **Pending release / Not applied** |
| `007_order_address_change.sql` | Customer delivery address changes & audit | Applied locally | **Pending release / Not applied** |
| `008_cart_abandonment_recovery.sql` | Cart abandonment recovery & discount tokens | Applied locally | **Pending release / Not applied** |
| `009_product_cod_eligibility.sql` | Product-level Cash on Delivery eligibility | Applied locally | **Pending release / Not applied** |
| `010_token_version_revocation.sql` | Server-side JWT session revocation & token versioning | Applied locally | **Pending release / Not applied** |

> [!WARNING]
> Local migration application to `dearr_test` does **not** indicate or imply that production database schemas have been modified. Production deployment requires running migrations `005` through `010` sequentially against the production database during an authorized maintenance window.

---

## Local-Only and Deployment Status

- **Commits are Strictly Local**: All commits from `a323a66` to `9154a79` exist only on the local machine in repository `D:\Desktop\dearr-next-feature`.
- **No Push Performed**: No `git push` to `origin` (GitHub `pavankumar56366/dearr.git`) has been authorized or executed.
- **No Production Deployment**: No changes have been deployed to Hostinger production (`https://dearr.in`). The production environment remains on commit `0862901` (`v1.3.1`).
- **Cached Remote References**: `origin/main` reflects locally cached data (`1cf0a70`) and cannot be assumed identical to GitHub without a permitted network fetch.
- **Uncommitted and Untracked Files Preserved**: All diagnostics, backups, test images, and scripts remain intact.

---

## Verification Notes & Security Status

### Verified Passing Checks (100% Pass Rate across 160 Tests)
- **Automated Regression Test Suites**: **160 / 160 Passed (Exit code 0)**:
  - `scripts/audit-remaining-vulnerabilities.ts`: **36 / 36 passed** (Payment E2E, IDOR, CSRF origin enforcement, JWT logout revocation, rate limiting, upload barriers, server pricing).
  - `database/verify-b08-security.ts`: **34 / 34 passed** (HttpOnly/SameSite session cookies, JWT claims with `tokenVersion`, bcrypt hashing, parameterized queries, RBAC, customer IDOR).
  - `scripts/test-payment-verification-security.ts`: **26 / 26 passed** (Attempt binding, HMAC signature checks, COD policy enforcement, stock reservation idempotency).
  - `scripts/test-product-cod-eligibility.ts`: **22 / 22 passed** (Single/mixed cart COD eligibility, DB truth validation, admin toggle persistence, Buy Now flow).
  - `scripts/test-auth-rate-limiting.ts`: **24 / 24 passed** (Login/signup throttling, HTTP 429, counter resets, unknown account bounding).
  - `scripts/test-cart-abandonment-browser.ts`: **13 / 13 passed** (Playwright real browser acceptance: modal launch, dismissal, recovery sheet display, duplicate suppression, mobile usability).
  - `scripts/verify-security-headers.ts`: **5 / 5 passed** (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP directives).
- **TypeScript Static Verification**: `npx tsc --noEmit` passed with 0 errors.
- **Next.js Production Build**: `npm run build` compiled successfully (standalone output, 73/73 static pages).
- **Production Dependency Audit**: `npm audit --omit=dev` reported **0 vulnerabilities**.

### Outstanding Security Findings & Pending External Infrastructure
1. **Hostinger Reverse Proxy Ingress Sanitization (BLOCKED)**:
   - Application-side rate limiting successfully bounds unknown accounts and isolates genuine accounts.
   - However, verifying that the external reverse proxy (Hostinger LiteSpeed/Nginx) strips or overwrites client-supplied `X-Forwarded-For` and `X-Real-IP` with `$remote_addr` requires direct production/staging server configuration access.
   - Marked **BLOCKED** pending authorized server administrator review.
2. **Development-Dependency Advisory (`braces`) (UNRESOLVED UPSTREAM)**:
   - `npm audit` reports 5 High vulnerabilities from `braces@3.0.3` (nested in `eslint-config-next@16.4.2` -> `@next/eslint-plugin-next` -> `fast-glob` -> `micromatch`).
   - Official npm registry check confirms `braces@3.0.3` is the latest published version; package maintainers have not released a patched 3.x release.
   - `npm audit fix --force` would downgrade to `eslint-config-next@14.2.35`, which is incompatible with Next.js 16.4.2 and React 19.
   - Confirmed development-only build toolchain scope; standalone production distribution (`.next/standalone/server.js`) completely omits ESLint and `braces`. Production audit confirms **0 vulnerabilities** (`npm audit --omit=dev`).
   - Retained and reported honestly without suppression or dependency breaking.

---

## Table E — Outstanding Local Working Tree Status

| Category | Item | Description / Status |
|---|---|---|
| Modified Tracked File | `AGENTS.md` | Auto-generated heading formatting adjustment by Next.js/Turbopack; preserved unstaged in working tree. |
| Modified Tracked File | `docs/GIT_HISTORY.md` | Updated Git history and security milestone reference (this document). |
| Untracked Directory | `.playwright-mcp/` | Playwright test browser session artifacts and trace captures. |
| Untracked Document | `docs/DEARR_LOCAL_FULL_QA_PLAYWRIGHT_MCP.md` | Local Playwright MCP test execution report. |
| Untracked Test Fixtures | `public/uploads/products/*.jpg` (5 files) | Local product image fixtures (`buddha-1.jpg`, `dragon-blue-1.jpg`, `dragon-pink-1.jpg`, `dragon-shared-1.jpg`, `dragon-shared-2.jpg`). |
| Untracked Test / Utility Scripts | 15 files in `scripts/` | Local database maintenance, testing, and alignment utilities (`align-checkout-attempts-schema.ts`, `apply-local-schemas-001-to-004.ts`, `backup-local-db.ts`, `browser-test-razorpay-e2e.ts`, `debug-checkout-page.ts`, `inspect-cart.ts`, `inspect-orders.ts`, `rotate-local-db-credential.ts`, `secure-mysql-root.ts`, `setup-browser-test.ts`, `setup-dearr-test-db.ts`, `setup-local-db.mjs`, `start-server.js`, `test-session-cart.ts`, `verify-env-config.ts`). |
| Git-Ignored Configuration | `.env.local` | Local database credentials (rotated) and test-mode keys; excluded from Git. |
