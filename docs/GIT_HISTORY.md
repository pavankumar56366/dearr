# Dearr Git History

## Current

| Item | Value |
|---|---|
| Current Version | v1.2.1 |
| Current Branch | main |
| Latest Commit | 10302b9 |

## Versions

| Version | Date | Commit | Description |
|---|---|---|---|
| v1.0.0 | 2026-10-05 | fb4a2a7 | Initial stable release |
| v1.1.0 | 2026-10-07 | 2f958ba | Dearr V1.1 release |
| v1.1.1 | 2026-10-07 | b91f5a8 | Security patch for source-map-js vulnerability |
| v1.2.1 | 2026-10-10 | 10302b9 | Checkout shipping, payment total sync, trending SQL, search deduplication, category metrics |

## Commit History

| # | Commit | Date | Message |
|---|---|---|---|
| 1 | 1be9191 | 2026-10-04 | Initial commit |
| 2 | 85a7e66 | 2026-10-04 | feat: Complete Dearr luxury e-commerce platform implementation |
| 3 | b26a652 | 2026-10-04 | fix: prepare Dearr for V1 production release |
| 4 | fb4a2a7 | 2026-10-05 | fix: complete admin data integration for v1 |
| 5 | b81015a | 2026-10-05 | chore: prepare Hostinger production deployment |
| 6 | 05f4b25 | 2026-10-05 | fix: use webpack for hostinger build compatibility |
| 7 | af2c894 | 2026-10-05 | fix: promote build-time dependencies for production build environment |
| 8 | 401637c | 2026-10-05 | fix: configure standalone output for Hostinger Node.js deployment |
| 9 | bca73a9 | 2026-10-05 | fix: next.config.mjs and postbuild standalone asset handling for hostinger |
| 10 | 4d1c8cd | 2026-10-05 | fix: copy server.js to .next/server.js in postbuild |
| 11 | a5a80bd | 2026-10-05 | fix: use robust baseUrl for oauth redirects to prevent proxy host leakage |
| 12 | 1761e42 | 2026-10-05 | docs: update tracker marking L-18 Done |
| 13 | bce4f29 | 2026-10-06 | fix: connect admin product management to mysql api persistence |
| 14 | 2a0f2e3 | 2026-10-06 | docs: add git history tracking and automated push logging workflow |
| 15 | 107e83d | 2026-10-06 | docs: simplify git history tracking |
| 16 | 7264552 | 2026-10-06 | fix: secure inventory settlement and remove guest checkout bypass |
| 17 | 8638676 | 2026-10-06 | fix: connect admin category and discount persistence to MySQL API |
| 18 | 4323a7d | 2026-10-06 | fix: resolve cart merge, product card wishlist, and admin operations states |
| 19 | a39924b | 2026-10-06 | fix: add shop catalog pagination and document reviews table in schema |
| 20 | fd25567 | 2026-10-06 | feat: restore persistent admin customer management |
| 21 | 84db3cf | 2026-10-06 | feat: restore persistent admin store settings |
| 22 | 1daddd2 | 2026-10-06 | feat(payment): prepare Razorpay integration for Live Mode payments with dual-mode detection and security assurance |
| 23 | 1839a9b | 2026-10-06 | fix: remove obsolete checkout prototype message |
| 24 | 2f958ba | 2026-10-06 | docs: update git history |
| 25 | 15fed57 | 2026-10-07 | docs: finalize Dearr v1.1.0 release history |
| 26 | b91f5a8 | 2026-10-07 | fix: patch source-map-js security vulnerability |
| 27 | c7db367 | 2026-10-07 | docs: finalize Dearr v1.1.1 release history |
| 28 | 10302b9 | 2026-10-10 | fix: improve checkout shipping and search results |

## Release v1.2.1 Notes

- **Release Date**: 2026-10-10
- **Feature Commit**: `10302b9` (`fix: improve checkout shipping and search results`)
- **Key Enhancements & Fixes**:
  1. **Checkout & Shipping Alignment**: Fixed shipping threshold calculation (`subtotal >= freeShippingThreshold`), dynamic settings loaded from `/api/settings`, consistent UI and server-calculated totals, "Free Shipping" badge accurate.
  2. **Razorpay Payment & Order Integrity**: Authoritative server-side order calculation, single-pass INR-to-paise conversion, tamper-proof payment verification, excluded pending/failed orders from metrics.
  3. **Trending Products SQL**: Join deduplication with subquery grouping, distinct product IDs, exclusion of non-paid/failed orders.
  4. **Search Overlay & Image Resolution**: Distinct product IDs, deduplicated items in suggestions, safe image fallback without duplicate identical images across items.
  5. **Category Browsing Metrics**: Migration 004 applied (`category_views` table with session-window indexing and category foreign key); tracking endpoint `/api/categories` fully verified with graceful fallback.
  6. **Customer Addresses**: Full authenticated address CRUD (`/api/customer/addresses`), strict ownership enforcement, default address toggling.
- **Validation Summary**:
  - `scripts/verify-investigation-fixes.mjs`: 16/16 tests passed.
  - `scripts/verify-11-features.mjs`: 26/26 tests passed.
  - TypeScript: Zero errors (`tsc --noEmit`).
  - Next.js standalone build: Succeeded (`next build --webpack && node scripts/postbuild.js`).
- **Database Migration 004**:
  - Successfully executed and verified on Hostinger MySQL (`u209580425_Dearr`).
  - Table `category_views` created with indexes.
