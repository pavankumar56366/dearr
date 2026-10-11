# Dearr Git History

## Current

| Item | Value |
|---|---|
| Latest Production Release | v1.2.1 |
| Production Release Tag | v1.2.1 |
| Production Release Tag Target | 00765bb545de321ac65f11949438ec73ab9691cd |
| Production Deployed Commit | 00765bb545de321ac65f11949438ec73ab9691cd |
| Latest Local Feature Commit | c475f3c352ed69ea8eb08296b273b7f4ab6245fc (c475f3c) |
| Feature Development Status | Unreleased Local Development (Committed to local main; not pushed or deployed) |
| Current Branch | main (local) |
| Synchronization | Local main ahead of origin/main by unpushed local commits (expected for unreleased development) |

## Versions

| Version | Date | Commit | Description |
|---|---|---|---|
| v1.0.0 | 2026-10-05 | fb4a2a7 | Initial stable release |
| v1.1.0 | 2026-10-07 | 15fed57 | Dearr V1.1 release |
| v1.1.1 | 2026-10-07 | c7db367 | Security patch for source-map-js vulnerability |
| v1.2.1 | 2026-10-11 | 00765bb | Product-image direct rendering fix, persistent upload storage, checkout shipping & payment sync, trending SQL |

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
| 29 | 8790bc2 | 2026-10-10 | docs: finalize Dearr v1.2.1 release history and migration 004 runner |
| 30 | aeca93e | 2026-10-11 | fix: direct storefront rendering for uploaded product images and normalize image sources |
| 31 | aac93ff | 2026-10-11 | fix: persistent uploads route and cross-version storage sync |
| 32 | 265f4e7 | 2026-10-11 | fix: expand versions traversal for persistent upload retrieval |
| 33 | c5c68c7 | 2026-10-11 | fix: add diagnostic debug path resolution to uploads route |
| 34 | 140df6e | 2026-10-11 | temp diagnostic endpoint |
| 35 | 00765bb | 2026-10-11 | fix: persistent uploads self-healing and removal of diagnostic route |
| 36 | a97484e | 2026-10-11 | docs: reconcile git history for v1.2.1 release |
| 37 | 5292a03 | 2026-10-11 | feat: simplify customer order tracking to four stages |
| 38 | c274250 | 2026-10-11 | docs: record local four-stage order tracking work |
| 39 | c475f3c | 2026-10-12 | feat: add transparent Dearr logo asset |

## Release v1.2.1 Notes

- **Release Version**: `v1.2.1`
- **Release Date**: 2026-10-11 (Annotated tag timestamp: `2026-10-11 02:31:26 +0530`, Release commit: `2026-10-11 02:22:24 +0530`)
- **Release Commit**: `00765bb545de321ac65f11949438ec73ab9691cd` (`00765bb`)
- **Annotated Tag**: `v1.2.1` (`0cd87088f8b1db3b9948bec0b6cd95edb0695540`)
- **Tag Target**: `00765bb545de321ac65f11949438ec73ab9691cd` (verified matching on GitHub `origin` and local repository)
- **Hostinger Deployment**:
  - **Build UUID**: `01a12796-ec6b-7368-a2de-23f36d46571b`
  - **Deployed Commit**: `00765bb545de321ac65f11949438ec73ab9691cd`
  - **Deployment Status**: `completed` (Build: 47.1s, Publish: 1.3s, Restart: 1.5s, Total: 1m 0s)
  - **Tag & Deployed Commit Alignment**: Verified exact match (`00765bb545de321ac65f11949438ec73ab9691cd`)
- **Product-Image Rendering Issue & Resolution**:
  - **Confirmed Root Cause**: Direct public image requests (`/uploads/products/...png`) returned HTTP 200, whereas Next.js image optimizer requests (`/_next/image?url=%2Fuploads%2Fproducts%2F...`) returned HTTP 400 (`"The requested resource isn't a valid image."`) in standalone hosting. Static sample images (`/product-samples/1.jpeg`) functioned properly through Next.js optimization.
  - **Direct Image Rendering**: Configured targeted `unoptimized={shouldBypassOptimization(src)}` on Next.js `<Image>` components across storefront and admin views for runtime uploads, bypassing the failing `/_next/image` proxy while preserving standard AVIF/WebP optimization for static assets and remote external images.
  - **Shared Image Normalization**: Implemented `src/lib/product-image.ts` providing `normalizeImageUrl()`, `getProductPrimaryImage()`, `getProductGalleryImages()`, `isUploadPath()`, and `shouldBypassOptimization()` supporting `url`, `storagePath`, `storage_path`, and object arrays across Server and Client Components.
  - **Persistent Upload Storage & Route Serving**: Added `src/app/uploads/products/[filename]/route.ts` to deliver uploaded images directly with proper MIME types and cache headers. Configured persistent storage synchronization with `/home/u209580425/domains/dearr.in/uploads/products/` outside ephemeral Hostinger git build directories, preventing runtime upload loss across deployments. Updated `src/lib/server/product-storage.ts` to sync new product uploads with both local standalone public uploads and external persistent storage.
  - **Storefront & Admin Views Updated**: Home (`ProductCard`), Shop (`ShopPageClient`), Search Overlay (`TrendingSearchProducts`), Product Detail (`ProductGallery`), Cart (`CartItemRow`), Wishlist (`WishlistItemCard`), Checkout (`CheckoutSummary`, `CheckoutDemoSuccess`), and Admin (`AdminProductSummary`, `AdminProductImageUpload`, `AdminProductsList`, `admin/page.tsx`).
- **Core Investigation Fixes**:
  1. **Checkout & Shipping Alignment**: Fixed shipping threshold calculation (`subtotal >= freeShippingThreshold`), dynamic settings loaded from `/api/settings`, consistent UI and server-calculated totals, "Free Shipping" badge accurate.
  2. **Razorpay Payment & Order Integrity**: Authoritative server-side order calculation, single-pass INR-to-paise conversion, tamper-proof payment verification, excluded pending/failed orders from metrics.
  3. **Trending Products SQL**: Join deduplication with subquery grouping, distinct product IDs, exclusion of non-paid/failed orders.
  4. **Search Overlay & Image Resolution**: Distinct product IDs, deduplicated items in suggestions, safe image fallback without duplicate identical images across items.
  5. **Category Browsing Metrics**: Migration 004 applied (`category_views` table with session-window indexing and category foreign key); tracking endpoint `/api/categories` fully verified with graceful fallback.
  6. **Customer Addresses**: Full authenticated address CRUD (`/api/customer/addresses`), strict ownership enforcement, default address toggling.
- **Verified Test & Quality Results**:
  - `scripts/verify-image-rendering.mjs`: 22/22 tests passed (upload classification, static asset optimization preservation, URL normalization, fallback behavior, preview URLs, storefront simulation).
  - `scripts/verify-investigation-fixes.mjs`: 16/16 tests passed.
  - `scripts/verify-11-features.mjs`: 26/26 tests passed.
  - TypeScript: Zero errors (`npx tsc --noEmit`).
  - Next.js Standalone Build: Succeeded (74 routes generated, standalone server verified).
  - Git Whitespace Check: Clean (`git diff --check`).
- **Live Production Smoke Verification**:
  - `GET https://dearr.in/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png`: HTTP 200 OK (`image/png`, 9,029 bytes, intrinsic 256x256).
  - Storefront product detail `https://dearr.in/product/cat`: verified in live browser, direct upload URL source, `complete: true`, `naturalWidth: 256`, `naturalHeight: 256`.
  - Storefront shop catalog `https://dearr.in/shop`: verified in live browser, Cat card direct upload URL source, `complete: true`, `naturalWidth: 256`, `naturalHeight: 256`.
- **Database Migration 004**:
  - Verified on Hostinger MySQL (`u209580425_Dearr`).
  - Table `category_views` created with indexes.

## Unreleased Local Development — Four-Stage Order Tracking

- **Status**: Unreleased Local Development (Committed locally on `feature/simple-order-tracking` and merged into local `main`; strictly NOT pushed to GitHub, NOT deployed to Hostinger, and no release tags created or modified)
- **Production Baseline**: Release `v1.2.1` remains the active production deployment at commit `00765bb545de321ac65f11949438ec73ab9691cd`
- **Feature Commit**: `5292a03939e0026d710d174934285d60196e56a1` (`5292a03`)
- **Commit Date**: `2026-10-11 23:44:02 +0530`
- **Commit Message**: `feat: simplify customer order tracking to four stages`
- **Implementation Scope**:
  - **Four Canonical Timeline Stages**: Streamlined customer order tracking to exactly four canonical stages:
    1. Order Received
    2. Payment
    3. Packed & Dispatched
    4. Delivered
  - **Removal of Obsolete Internal Stages**: Removed separate internal manufacturing sub-stages (`3D Print Preparation` and `Quality Inspection`) and replaced hardcoded `"Payment Verified"` with dynamic payment status handling.
  - **Shared Component Engine**: Unified tracking evaluation via pure helper `src/lib/order-tracking.ts` consumed by both Customer Order Details (`OrderDetail.tsx`) and Order Confirmation (`OrderStatusTimeline.tsx`).
  - **Payment State Machine**:
    - **Prepaid Orders**: Pending payment stays in `current` state with `Pending` badge; failed payment displays explicit `Failed` badge with retry guidance; verified payment (`paid` or demo `simulated`) marks stage completed.
    - **Cash on Delivery (COD)**: Displays `Due on Delivery` before delivery; does not block fulfillment progression (`Packed & Dispatched` becomes `active`); delivery alone is NOT treated as proof of payment collection — displays `Collection Pending` if delivered but unpaid; marked paid only upon explicit backend reconciliation.
  - **Order Integrity & Safeguards**:
    - Preserved backend `paymentMethod` in `OrderDetailPageClient.tsx` (`o.paymentMethod || ...`).
    - Passed `paymentStatus` and `paymentMethod` to `<OrderStatusTimeline />` in `OrderConfirmationClient.tsx`.
    - Rendered explicit `Order Cancelled` alert banner for cancelled orders, preventing deceptive forward fulfillment progress.
    - Provided safe fallback for unknown or legacy statuses without crashing or premature completion.
- **Verified Test & Quality Results**:
  - **Tracking Test Matrix** (`node scripts/verify-order-tracking-stages.mjs`): **15 / 15 tests passed (100%)** (Tests A through L verified).
  - **Playwright Browser Automation** (`node scripts/browser-verify-order-tracking.mjs`): **10 / 10 scenarios passed (100%)** on Desktop (1280×800) and Mobile (375×667) across Order Details and Order Confirmation pages with 0 console errors and 40 verified screenshot artifacts.
  - **Dearr Feature Regression Suite** (`node scripts/verify-11-features.mjs`): **26 / 26 tests passed (100%)**.
  - **Product Image Rendering Suite** (`node scripts/verify-image-rendering.mjs`): **22 / 22 tests passed (100%)**.
  - **TypeScript Compilation** (`npx tsc --noEmit`): **Passed with zero errors**.
  - **Production Standalone Build** (`npm run build`): **Succeeded** (74 routes generated, standalone server verified).

## Unreleased Local Development — Transparent Dearr Logo

- **Status**: Unreleased Local Development (Committed locally on `main`; strictly NOT pushed to GitHub, NOT deployed to Hostinger, and no release tags created or modified)
- **Production Baseline**: Release `v1.2.1` remains the active production deployment at commit `00765bb545de321ac65f11949438ec73ab9691cd`
- **Feature Commit**: `c475f3c352ed69ea8eb08296b273b7f4ab6245fc` (`c475f3c`)
- **Commit Date**: `2026-10-12 00:56:10 +0530`
- **Commit Message**: `feat: add transparent Dearr logo asset`
- **Asset Implementation**:
  - **Canonical Asset**: `public/brand/dearr-logo.png`
  - **Asset Properties**: Lossless 4-channel PNG (RGBA), 955 × 289 px (3.30:1 aspect ratio), 48,959 bytes.
  - **Genuine Alpha Transparency**: 61.9% of canvas is pure transparent (`alpha = 0`), with all 4 corners confirmed at `alpha = 0`.
  - **Inner Holes/Counters**: Transparent interior spaces inside closed letter loops (`d`, `e`, `a`).
  - **Color & Style Preservation**: Original playful handwritten style preserved with exact vibrant letter colors (`d` coral red, `e` turquoise, `a` golden yellow, `r` lavender purple, `r` hot pink) and pink heart with accent marks.
  - **White Highlights Preserved**: 1,763 pure white highlight bubble pixels retained on letter curves.
  - **Edge Antialiasing**: 11,163 smooth antialiased edge pixels with 0 dark halos or leftover black background fringes.
  - **Clean Cropping**: Unnecessary outer whitespace trimmed with a 4px protective margin.
- **Files Included in Feature Commit**:
  - `public/brand/dearr-logo.png` (transparent brand logo asset)
  - `scripts/verify-logo-transparency.mjs` (programmatic asset & alpha channel regression test)
  - `scripts/browser-verify-logo.mjs` (Playwright automated browser verification suite)
- **Shared Brand Integration**:
  - Storefront Desktop Header (`src/components/customer/DesktopHeader.tsx`)
  - Storefront Mobile Header (`src/components/customer/CustomerHeader.tsx`)
  - Storefront Footer Brand Pill (`src/components/customer/home/Footer.tsx`)
  - Search Overlay (`src/components/customer/SearchOverlay.tsx`)
  - Customer Auth Shells (`src/components/customer/auth/LoginView.tsx`, `AuthShell.tsx`)
  - Admin Branding & Portal (`src/components/admin/AdminBrand.tsx`, `src/app/admin/login/page.tsx`)
- **Verified Test & Quality Results**:
  - **Logo Transparency Test** (`node scripts/verify-logo-transparency.mjs`): **Passed (100%)** — verified 4 transparent corners, 61.9% canvas alpha, 1,763 white highlights, 0 dark halos, 6 letter/heart slices intact, and 5 composite previews (white, canvas off-white, surface cream, black, and dark footer).
  - **Playwright Browser Automation** (`node scripts/browser-verify-logo.mjs`): **Passed (100%)** — Desktop Header (120×36px rendered), Mobile Header (92×28px rendered), Footer Brand Pill, Customer Login, and Admin Login verified with 0 console errors and 5 screenshot artifacts.
  - **Order Tracking Test Matrix** (`node scripts/verify-order-tracking-stages.mjs`): **15 / 15 tests passed (100%)**.
  - **Product Image Rendering Suite** (`node scripts/verify-image-rendering.mjs`): **22 / 22 tests passed (100%)**.
  - **TypeScript Compilation** (`npx tsc --noEmit`): **Passed with zero errors**.
  - **Production Standalone Build** (`npm run build`): **Succeeded** (74 routes generated, standalone server verified).
