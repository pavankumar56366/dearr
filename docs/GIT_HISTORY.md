# Dearr Git History & Repository Status Reference

This document provides a concise, verified reference of the Dearr repository state, release history, and unmerged local feature commits.

> [!NOTE]
> Remote tracking references (`origin/main`, `origin/HEAD`) reflect the last locally cached state. In accordance with project safety rules, no remote network calls (`git fetch` or `git pull`) were executed during this inspection. Remote GitHub status cannot be independently verified without contacting the remote.

---

## Table A — Current Git Status

| Item | Value |
|---|---|
| Current branch | `feature/cart-abandonment-recovery` |
| Current HEAD | `4066077cdaca5caf7fd729279e6ab74f1272fc18` (`4066077 feat: add cart abandonment recovery and insights`) |
| Local main | `1cf0a70702ff2f4f3d1257dbdc1f846b6a49f56e` (`1cf0a70 docs: record Dearr v1.3.1 deployment and live verification`) |
| Cached origin/main | `1cf0a70702ff2f4f3d1257dbdc1f846b6a49f56e` (4 commits behind HEAD) |
| Local commits ahead of origin/main | 4 commits (`1cf0a70..4066077`: `a323a66`, `5b2a723`, `25b5d1f`, `4066077`) |
| Latest production version | `v1.3.1` (verified live on `https://dearr.in`) |
| Production deployed commit | `0862901d5ce10d2d7a7237d93c788cf561a5ea18` (Hostinger Build `01a12db3-3c51-7045-adc5-3dd10bc40c49`) |
| Working tree | 0 staged files, 2 unstaged modified files (`docs/GIT_HISTORY.md`, `scripts/test-color-variants-e2e.ts`), 18 untracked files |

---

## Table B — Main and Released History

Significant milestones in the known `main` / released commit history:

| Commit | Date | Important Change | Version/Tag | Status |
|---|---|---|---|---|
| `fb4a2a7` | 2026-10-05 | Complete admin data integration for V1 | `v1.0.0` | Released (Initial V1) |
| `15fed57` | 2026-10-07 | Finalize Dearr v1.1.0 release history | `v1.1.0` | Released (V1.1 update) |
| `c7db367` | 2026-10-07 | Finalize Dearr v1.1.1 release history (source-map-js security patch) | `v1.1.1` | Released (Security patch) |
| `00765bb` | 2026-10-11 | Persistent uploads self-healing, direct image rendering fix, checkout fixes | `v1.2.1` | Released & Deployed to production |
| `0862901` | 2026-10-12 | Transparent Dearr logo, 4-stage order tracking, v1.3.1 release prep | `v1.3.1` | Released & Deployed to production (Current Live) |
| `1cf0a70` | 2026-10-12 | Record Dearr v1.3.1 deployment and live verification | — | Local `main` / Cached `origin/main` baseline |

*Note: In accordance with safety rules, `origin/main` reflects the last locally observed state. It may be stale until a permitted remote fetch is conducted.*

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

## Table D — Local-Only Feature Commits

Commits present locally on developer feature branches that are **not** in the cached `origin/main` history:

| Commit | Local Branch | Feature | Parent / Based On | Included in Cached origin/main? | Production Deployed? |
|---|---|---|---|---|---|
| `a323a66` | `feature/next-feature` | Order analytics and abandoned checkout handling (Migration 005) | `1cf0a70` (`origin/main`) | No (Committed locally) | No (Production deployment not verified) |
| `5b2a723` | `feature/product-color-variants` | Product color variants and multi-color cart (Migration 006) | `a323a66` | No (Committed locally) | No (Production deployment not verified) |
| `25b5d1f` | `feature/order-address-change` | Customer delivery address changes (Migration 007) | `5b2a723` | No (Committed locally) | No (Production deployment not verified) |
| `4066077` | `feature/cart-abandonment-recovery` (HEAD) | Cart abandonment recovery, insights & dashboard fixes (Migration 008) | `25b5d1f` | No (Committed locally) | No (Production deployment not verified) |

### Branch Ancestry & Cumulative Merging
The four local feature commits form a strict linear chain:
```text
1cf0a70 (origin/main, main)
   └── a323a66 (feature/next-feature)
          └── 5b2a723 (feature/product-color-variants)
                 └── 25b5d1f (feature/order-address-change)
                        └── 4066077 (feature/cart-abandonment-recovery, HEAD)
```
**Cumulative Merge Implication**: Because `feature/cart-abandonment-recovery` directly descends through this chain, merging it into `main` will automatically bring all four ancestor feature commits and sequential database migrations (`005` → `006` → `007` → `008`) into `main`.

---

## Table E — Outstanding Local Changes

| Category | Status | Action / Meaning |
|---|---|---|
| Modified tracked files | `docs/GIT_HISTORY.md`<br>`scripts/test-color-variants-e2e.ts` | `docs/GIT_HISTORY.md`: History reference update.<br>`scripts/test-color-variants-e2e.ts`: Test-runner pool drain fix.<br>Both remain unstaged in working tree. |
| Untracked development scripts | 14 script files in `scripts/`<br>(including `scripts/align-checkout-attempts-schema.ts`) | Standalone dev, schema-migration, and diagnostic test scripts.<br>Preserved locally; kept out of feature commits. |
| Untracked test images | 4 JPEG images in `public/uploads/products/` | Local test fixtures for color variant validation.<br>Preserved locally. |
| Ignored local configuration | `.env.local` | Contains local test database configuration (rotated).<br>Ignored via `.gitignore` rule (`.env*.local`); excluded from Git tracking. |
