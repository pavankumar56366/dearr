# Dearr — Git, Commit, Push & Version History

> This file is the central human-readable record of the Dearr project's commits,
> pushes, versions/releases, tags, development milestones, and rollback/recovery
> information.

---

## 1. Project Git Information

| Field | Value |
|---|---|
| **Repository** | `https://github.com/pavankumar56366/dearr.git` |
| **Default branch** | `main` |
| **Current branch** | `main` |
| **Current HEAD commit** | `bce4f29` (`bce4f29d3ac7bd6dfdeea80d99cae8123ce86b74`) |
| **Latest tag** | `v1.0.0` |
| **Versioning method** | Semantic Versioning (`MAJOR.MINOR.PATCH`) with annotated Git tags |
| **Document initialized** | 2026-10-06 |

> **Note:** This document never contains passwords, API keys, tokens, database
> credentials, or any secret values from `.env.local` or similar files.

---

## 2. Current Version

| Field | Value |
|---|---|
| **Current development version** | Post-v1.0.0 (unreleased commits on `main`) |
| **Current released version** | v1.0.0 |
| **Latest tag** | `v1.0.0` (at commit `fb4a2a7`) |
| **Current branch** | `main` |
| **Current HEAD commit** | `bce4f29` |

**How versioning works in this project:**

- **Git tags** represent important, tested, stable releases (e.g., `v1.0.0`).
  A tag is a permanent named pointer to a specific commit.
- **Git commits** represent individual development checkpoints. Not every commit
  is a release — commits accumulate between releases as features are built,
  bugs are fixed, and improvements are made.
- The HEAD of `main` may be ahead of the latest tag when development work has
  been committed but a new release has not yet been tagged.

---

## 3. Version History

| Version | Date | Commit | Status | Description |
|---|---|---|---|---|
| `v1.0.0` | 2026-10-05 | `fb4a2a7` | ✅ Released | Initial V1 release — Complete Dearr luxury e-commerce platform with Hostinger MySQL backend, customer storefront, admin operations portal, authentication, product/category/discount/wishlist/cart/order APIs, and Razorpay payment integration. |

### Future Version Numbering

Future releases will follow semantic versioning:

| Pattern | Meaning | Example |
|---|---|---|
| `v1.0.0` | Initial stable release | Already exists |
| `v1.1.0` | New features or improvements added to V1 | Admin product persistence fix, new admin features |
| `v1.1.1` | Patch / bug-fix release on the v1.1 line | Hotfix for a specific issue |
| `v1.2.0` | Another feature release on V1 | Additional storefront or admin capabilities |
| `v2.0.0` | Major breaking / business / architecture change | Redesigned data model, new platform, etc. |

> **Important:** No future versions exist yet. Tags are created only when a
> group of changes has been tested and declared stable. Do not pre-create tags
> for unreleased work.

---

## 4. Commit History

The following table is generated from the actual Git repository (`git log`).
Every entry represents a real commit.

| # | Commit | Date | Author | Message | Tags / Refs |
|---|---|---|---|---|---|
| 13 | `bce4f29` | 2026-10-06 07:45 IST | pavankumar56366 | fix: connect admin product management to mysql api persistence | `HEAD → main` |
| 12 | `1761e42` | 2026-10-05 03:09 IST | pavankumar56366 | docs: update tracker marking L-18 Done | `origin/main` |
| 11 | `a5a80bd` | 2026-10-05 03:04 IST | pavankumar56366 | fix: use robust baseUrl for oauth redirects to prevent proxy host leakage | |
| 10 | `4d1c8cd` | 2026-10-05 02:57 IST | pavankumar56366 | fix: copy server.js to .next/server.js in postbuild | |
| 9 | `bca73a9` | 2026-10-05 02:55 IST | pavankumar56366 | fix: next.config.mjs and postbuild standalone asset handling for hostinger | |
| 8 | `401637c` | 2026-10-05 02:46 IST | pavankumar56366 | fix: configure standalone output for Hostinger Node.js deployment | |
| 7 | `af2c894` | 2026-10-05 02:41 IST | pavankumar56366 | fix: promote build-time dependencies for production build environment | |
| 6 | `05f4b25` | 2026-10-05 02:38 IST | pavankumar56366 | fix: use webpack for hostinger build compatibility | |
| 5 | `b81015a` | 2026-10-05 01:42 IST | pavankumar56366 | chore: prepare Hostinger production deployment | |
| 4 | `fb4a2a7` | 2026-10-05 00:45 IST | pavankumar56366 | fix: complete admin data integration for v1 | **`tag: v1.0.0`** |
| 3 | `b26a652` | 2026-10-04 23:34 IST | pavankumar56366 | fix: prepare Dearr for V1 production release | |
| 2 | `85a7e66` | 2026-10-04 21:51 IST | pavankumar56366 | feat: Complete Dearr luxury e-commerce platform implementation | |
| 1 | `1be9191` | 2026-10-04 21:17 IST | pavankumar56366 | Initial commit | |

> **Total commits:** 13

---

## 5. Push History

### Understanding Commit vs. Push History

- **Commit history** is stored in Git and can be fully reconstructed from
  `git log`. Every commit above is a verifiable local record.
- **Push history** represents when commits were sent (pushed) to GitHub. A push
  is a remote event — Git does not store a local log of when each push occurred.
  Multiple commits are often pushed together in a single `git push`.

### Historical Pushes

Historical push timestamps cannot be reliably reconstructed from local Git
history alone. The commits above were pushed to `origin/main` at some point
after their commit dates, but the exact push timestamps are not recorded locally.

> **Historical push timestamp not available from local Git history.**

### Push Log

Future pushes to `main` are automatically logged by the GitHub Actions workflow
(`.github/workflows/log-push-history.yml`). Each automated entry appends a row
to the table below.

<!-- PUSH_HISTORY_START -->
| Push # | Date/Time (UTC) | Branch | Commit | Actor | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | *Automated push logging starts after this workflow is committed and pushed.* |
<!-- PUSH_HISTORY_END -->

---

## 6. Release & Tag Rules

1. Every logical development change should normally have a Git commit.
2. A push is **not** required after every commit. You can commit locally
   multiple times before pushing.
3. Multiple successful commits can be pushed together in a single
   `git push origin main`.
4. Tags are **not** required for every commit. Most commits are untagged
   development checkpoints.
5. Tags should be created only for important, tested, stable releases.
6. The existing `v1.0.0` tag **must remain unchanged**. Never move, delete, or
   recreate it.
7. `v1.1.0` should only be created after the v1.1 feature set is fully tested
   and stable.
8. **Never move an existing release tag.** Once a tag is pushed, it is a
   permanent historical marker.
9. **Never force-push `main`** unless there is an exceptional, documented
   recovery procedure (see Section 7).
10. Production deployment should happen only from known-good, tagged code.

### Example: Development → Release Flow

```
git commit -m "fix: homepage layout on mobile"
git commit -m "feat: add search improvement to shop page"
git commit -m "fix: admin product persistence"
git commit -m "feat: improve mobile navigation layout"

# All changes tested and stable:
git push origin main
git tag -a v1.1.0 -m "Dearr V1.1.0 — Product persistence, search, mobile improvements"
git push origin v1.1.0
```

---

## 7. Recovery & Rollback Guide

### Scenario: A Bad Commit

```
Commit 1 ✅  (good)
Commit 2 ✅  (good)
Commit 3 ✅  (good)
Commit 4 ✅  (good)
Commit 5 ✅  (good — last known-good state)
Commit 6 ❌  (introduced a bug)
```

### Step 1: Inspect History

```bash
git log --oneline --decorate --graph
```

Identify the last known-good commit hash (e.g., Commit 5).

### Step 2: Safely Inspect an Old Commit

```bash
git switch --detach <GOOD_COMMIT>
```

This puts you in "detached HEAD" mode at that commit. You can inspect files,
run tests, and verify behavior. **This is safe** — it does not modify any
branch or delete any work.

To return to the current branch:

```bash
git switch main
```

### Step 3a: Undo Local Unpushed Bad Work

If the bad commit has **not** been pushed to GitHub:

```bash
git reset --hard <GOOD_COMMIT>
```

> ⚠️ **WARNING:** This permanently discards all uncommitted changes and all
> commits after the target. Only use this for local recovery when the bad
> commits have not been shared.

### Step 3b: Undo Already-Pushed Bad Changes (Preferred)

If the bad commit has **already** been pushed to GitHub:

```bash
git revert <BAD_COMMIT>
```

This creates a **new commit** that undoes the changes from the bad commit,
preserving the full history. This is the **preferred and safer** approach for
shared branches because:

- It does not rewrite history.
- Other collaborators will not have conflicts.
- The original bad commit remains visible for audit/debugging purposes.

> ❌ **Do NOT use `git push --force`** as the normal recovery mechanism. Force
> pushing rewrites shared history and can cause data loss for collaborators and
> CI/CD pipelines.

---

## 8. Recommended Dearr Git Workflow

```
Local development
       ↓
Logical change (fix, feature, improvement)
       ↓
Test locally (dev server, browser, automated tests)
       ↓
git add .
       ↓
git commit -m "type: description"
       ↓
More changes → more commits → more testing
       ↓
All changes tested and stable
       ↓
git push origin main
       ↓
GitHub receives the commits
       ↓
Hostinger deployment (manual or CI/CD)
       ↓
Production verification
```

### Best Practices

- **Commit frequently.** Each commit should represent one logical change.
  Use conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- **Push when a group of stable changes is ready.** There is no obligation to
  push after every single commit.
- **Tag stable releases.** After pushing a set of features that represent a
  milestone, create an annotated tag (e.g., `v1.1.0`).
- **Keep production on known-good commits.** Deploy only from commits that have
  passed testing. Prefer deploying from tagged releases.
- **Never commit secrets.** Ensure `.env.local` and credential files are in
  `.gitignore`.

---

## 9. Common Commands

### Check Status

```bash
git status
```

### See History

```bash
git log --oneline --decorate --graph --all
```

### See Tags

```bash
git tag --list --sort=version:refname
```

### Create a Commit

```bash
git add .
git commit -m "type: description"
```

### Push to GitHub

```bash
git push origin main
```

### Create an Annotated Release Tag

```bash
git tag -a v1.1.0 -m "Dearr V1.1.0 — description of this release"
```

### Push a Tag to GitHub

```bash
git push origin v1.1.0
```

### View a Specific Commit

```bash
git show <COMMIT_HASH>
```

### Compare Working Directory to Last Commit

```bash
git diff
```

### Compare Two Commits

```bash
git diff <COMMIT_A> <COMMIT_B>
```

> **Important:** Do not execute tag creation or release operations
> automatically. These commands are documentation references for manual use.

---

## 10. Document Maintenance

This document should be updated when:

- A new release tag is created (add a row to the Version History table).
- The Push History table is automatically updated by the GitHub Actions workflow.
- Significant milestones or recovery events occur.
- The repository structure or versioning strategy changes.

The Push History section between `<!-- PUSH_HISTORY_START -->` and
`<!-- PUSH_HISTORY_END -->` is automatically maintained by the
`.github/workflows/log-push-history.yml` workflow. Do not manually edit the
markers.
