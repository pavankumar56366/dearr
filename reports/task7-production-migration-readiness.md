# Dearr V1 — Task 7: Production Migration Readiness Review & Runbook (Migration 012)

**Report Date:** 2026-10-27  
**Scope:** Investigation, resolution of technical blockers, and operator runbook for applying `database/migrations/012_variant_specific_pricing.sql` to Hostinger MySQL before merging PR #7  
**Pull Request:** [GitHub PR #7](https://github.com/pavankumar56366/dearr/pull/7) (`feat(variants): variant-specific pricing and inventory management`)  
**Target Database:** Hostinger MySQL 8.x (`srv1741.hstgr.io`, database `u209580425_Dearr`)  
**Repository Branch:** `feature/variant-pricing`  
**Latest Git Commit:** `3a3fae6` (*fix(migration-012): resolve variant uniqueness and color deletion risks*)  
**Safety Protocol:** Strictly Read-Only for Production. Zero connections, queries, DDL, or DML executed by the agent against Hostinger production. All operator procedures documented for manual execution via Hostinger phpMyAdmin.

---

## 1. Executive Verdict & Verification Status

### **CURRENT VERDICT: READY FOR OPERATOR REVIEW (PRODUCTION PREREQUISITES UNVERIFIED)**

The technical blockers identified in the initial review have been resolved and verified on local disposable test databases (`dearr_test` and `dearr_local`) and in GitHub Actions CI (PR #7). However, **production schema and migration readiness on Hostinger have NOT been verified** because production database inspection has not been performed:

| Item | Classification | Verification Status | Current Status & Realistic Assessment |
| :--- | :--- | :--- | :--- |
| **`combo_hash` Virtual Column Expression** | **TECHNICAL BLOCKER** | **VERIFIED LOCALLY & CI** | **RESOLVED IN REPO.** Generated column expression updated to `CONCAT(COALESCE(color_id, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(size_name)), ''))`. Tested: prevents NULL propagation for color-only variants and enforces database-level uniqueness. |
| **Color Deletion Cascade Risk** | **TECHNICAL BLOCKER** | **VERIFIED LOCALLY & CI** | **RESOLVED IN REPO.** In `src/lib/server/product.ts`, added checks for `product_variants` and `stock_reservations`. If variants exist, colors are soft-deactivated (`is_active = 0`), preventing unintended cascading variant wipes. |
| **Local & CI Test Verification** | **VERIFICATION** | **VERIFIED IN CI** | **153 / 153 tests passed locally.** GitHub Actions CI check run `validate` on PR #7 passed (`success`). |
| **Hostinger Prerequisite Schema (001–011)** | **PRODUCTION BLOCKER** | **UNVERIFIED ON PRODUCTION** | The Hostinger database has not been inspected. Operator must run read-only pre-checks to confirm required tables, columns, matching keys, and engines exist. |
| **Hostinger Database Backup** | **OPERATOR PREREQUISITE** | **REQUIRED BEFORE DDL** | Logical backup must be exported via phpMyAdmin and verified before executing any DDL. |
| **Deployment Maintenance Coordination** | **OPERATOR PREREQUISITE** | **REQUIRED BEFORE MERGE** | Merging PR #7 into `main` immediately triggers Hostinger auto-deployment. Migration 012 must be applied and verified on Hostinger MySQL **before** merging. |

---

## 2. Realistic Production Compatibility & Operational Risks

> [!WARNING]
> Do NOT assume zero production disruption or unconditional backward compatibility. The following operational risks must be planned for during rollout:

1. **Metadata Lock (MDL) Contention:**
   - In MySQL 8.0 InnoDB, `ALTER TABLE` operations acquire an exclusive metadata lock (MDL) at the start and end of execution.
   - If there are active transactions or long-running checkout queries on `product_variants` or `stock_reservations`, the DDL will wait for locks. Subsequent read/write queries will queue behind the DDL, risking connection pool saturation and HTTP 504 timeouts.
   - **Mitigation:** Execute DDL during a scheduled low-traffic window (e.g., 02:00–02:30 IST) or enable temporary maintenance mode.
2. **Implicit Commit of DDL:**
   - In MySQL InnoDB, `ALTER TABLE` statements cause an **immediate, non-transactional implicit commit**.
   - If Step 1 (`product_variants`) succeeds and Step 2 (`stock_reservations`) fails, Step 1 **CANNOT** be rolled back with SQL `ROLLBACK`. The database will remain in a partially migrated state until resolved.
3. **Application Query Projections:**
   - Migration 012 adds nullable columns (`color_id`, `size_name`, `variant_id`) and a virtual generated column (`combo_hash`).
   - While Dearr's server codebase uses explicit column projections in its primary data access methods, any unmapped query or external tool issuing `SELECT *` against `product_variants` will receive additional fields before the new code is deployed.
4. **Premature Merge / Incompatible Code Deployment:**
   - The application code on `feature/variant-pricing` explicitly queries `color_id`, `size_name`, `combo_hash`, and `variant_id`.
   - If PR #7 is merged into `main` before Migration 012 is applied on Hostinger, Hostinger's automatic deployment will deploy code that immediately crashes with:
     `Error: ER_BAD_FIELD_ERROR: Unknown column 'color_id' in 'field list'`
     `Error: ER_BAD_FIELD_ERROR: Unknown column 'variant_id' in 'where clause'`
   - **Enforced Rollout Rule:** Migration 012 must be applied to Hostinger MySQL and verified **prior** to merging PR #7 into `main`.

---

## 3. Prerequisite Schema Elements (Must Exist on Production)

Migration 012 is an additive modification. It assumes migrations 001 through 011 have established the following tables, column data types, and primary key relationships on Hostinger MySQL:

| Required Table | Expected Engine | Expected Collation | Required Existing Columns & Key Types | Purpose in Migration 012 |
| :--- | :--- | :--- | :--- | :--- |
| **`products`** | InnoDB | `utf8mb4_unicode_ci` | `id CHAR(36) PRIMARY KEY` | Referenced by `product_variants.product_id` |
| **`product_variants`** | InnoDB | `utf8mb4_unicode_ci` | `id CHAR(36) PRIMARY KEY`, `product_id CHAR(36)` | Altered to add `color_id`, `size_name`, `combo_hash` |
| **`product_colors`** | InnoDB | `utf8mb4_unicode_ci` | `id CHAR(36) PRIMARY KEY`, `product_id CHAR(36)` | Target of FK `fk_product_variants_color` |
| **`stock_reservations`** | InnoDB | `utf8mb4_unicode_ci` | `id CHAR(36) PRIMARY KEY`, `color_id CHAR(36)`, `status ENUM('active','consumed','released')` | Altered to add `variant_id`, index, and FK `fk_stock_reservations_variant` |

*Note: Migrations 001–011 cannot be assumed to be complete on Hostinger until the operator executes the prerequisite check queries in Phase 2.*

---

## 4. Hostinger Operator Execution Procedure (Checklist)

> [!IMPORTANT]
> **No Credentials Exposed:** This procedure is executed securely via Hostinger hPanel SSO without typing or exposing database passwords.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   OPERATOR ROLLOUT SEQUENCE                            │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 1: Access Hostinger phpMyAdmin & Export Logical Backup          │
│  Phase 2: Prerequisite & Current Schema Verification [READ-ONLY CHECK] │
│  Phase 3: Schema State Evaluation & Decision Procedure                 │
│  Phase 4: Apply Migration 012 DDL [SCHEMA-CHANGING] (If Unapplied)     │
│  Phase 5: Post-Migration Schema Verification [READ-ONLY CHECK]         │
│  Phase 6: Pre-Merge Application Smoke Test [READ-ONLY CHECK]           │
│  Phase 7: Merge GitHub PR #7 into `main` (Triggers Auto-Deployment)    │
│  Phase 8: Post-Deployment Verification & Smoke Tests                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Access phpMyAdmin & Export Logical Backup

1. Log in to **Hostinger Control Panel (hPanel)** (`https://hpanel.hostinger.com`).
2. Navigate to **Databases** → **MySQL Databases**.
3. Under **List of Current MySQL Databases and Users**, locate:
   - **Database Name:** `u209580425_Dearr`
4. Click **Enter phpMyAdmin**.
5. In phpMyAdmin, click `u209580425_Dearr` in the left sidebar.
6. Click **Export** → **Quick** → **SQL** → click **Export** to download `u209580425_Dearr.sql`.
7. Confirm the downloaded file exists and is non-zero in size before proceeding.

---

### Phase 2: Prerequisite & Schema State Verification [READ-ONLY CHECK]

In phpMyAdmin, click the **SQL** tab, paste the following SQL block, and click **Go**:

```sql
-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.1: VERIFY CONNECTED DATABASE & MYSQL ENGINE
-- Expected: active_db = 'u209580425_Dearr', mysql_version >= '8.0'
-- =============================================================================
SELECT DATABASE() AS active_db, VERSION() AS mysql_version;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.2: VERIFY PREREQUISITE TABLES, ENGINES & COLLATIONS
-- Expected: Exactly 6 rows. All ENGINE = 'InnoDB'. TABLE_COLLATION matching utf8mb4.
-- =============================================================================
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('products', 'product_colors', 'product_variants', 'stock_reservations', 'cart_items', 'order_items')
ORDER BY TABLE_NAME;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.3: VERIFY REQUIRED PARENT COLUMNS & KEY DEFINITIONS
-- Expected: Exactly 7 rows matching exact data types below.
-- =============================================================================
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'products' AND COLUMN_NAME = 'id') OR
    (TABLE_NAME = 'product_colors' AND COLUMN_NAME IN ('id', 'product_id')) OR
    (TABLE_NAME = 'product_variants' AND COLUMN_NAME IN ('id', 'product_id')) OR
    (TABLE_NAME = 'stock_reservations' AND COLUMN_NAME IN ('id', 'color_id', 'status'))
  )
ORDER BY TABLE_NAME, COLUMN_NAME;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.4: CHECK IF MIGRATION 012 COLUMNS ALREADY EXIST
-- Expected: 0 rows on a clean, unapplied database.
-- =============================================================================
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, EXTRA, GENERATION_EXPRESSION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'product_variants' AND COLUMN_NAME IN ('color_id', 'size_name', 'combo_hash')) OR
    (TABLE_NAME = 'stock_reservations' AND COLUMN_NAME = 'variant_id')
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.5: CHECK IF MIGRATION 012 INDEXES ALREADY EXIST
-- Expected: 0 rows on a clean, unapplied database.
-- =============================================================================
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME IN ('idx_product_variants_color_id', 'idx_product_variants_size_name', 'uq_product_variants_combo', 'idx_stock_reservations_variant_status')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.6: CHECK IF MIGRATION 012 FOREIGN KEYS ALREADY EXIST
-- Expected: 0 rows on a clean, unapplied database.
-- =============================================================================
SELECT CONSTRAINT_NAME, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND CONSTRAINT_NAME IN ('fk_product_variants_color', 'fk_stock_reservations_variant');
```

```sql
-- =============================================================================
-- [READ-ONLY CHECK] STEP 2.7: CONDITIONAL DUPLICATE COMBINATION CHECK
-- ⚠️ CAUTION: Execute this query ONLY IF Step 2.4 returned rows showing that
--              `color_id` and `size_name` already exist (e.g., partial migration).
--              Do NOT execute on a clean schema where columns are absent (will throw ER_BAD_FIELD_ERROR).
-- Expected: 0 rows returned.
-- =============================================================================
SELECT
  product_id,
  CASE
    WHEN `color_id` IS NOT NULL OR (`size_name` IS NOT NULL AND TRIM(`size_name`) != '') THEN
      CONCAT(COALESCE(`color_id`, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(`size_name`)), ''))
    ELSE NULL
  END AS calculated_combo_hash,
  COUNT(*) AS dup_count
FROM product_variants
GROUP BY product_id, calculated_combo_hash
HAVING calculated_combo_hash IS NOT NULL AND dup_count > 1;
```

---

### Phase 3: Schema State Evaluation & Decision Procedure

Evaluate the results of Phase 2 against the following decision matrix before touching any DDL:

```
                                [Phase 2 Results]
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
      [State A]                    [State B]                    [State C]
  Clean Unapplied             Partially Migrated           Fully Migrated
  - Step 2.2: 6 tables        - Step 2.4: 1 to 3 cols      - Step 2.4: 4 cols
  - Step 2.3: 7 parent cols   - Indexes/FKs mismatched     - Step 2.5: 6 index rows
  - Step 2.4: 0 cols          - Expressions differ         - Step 2.6: 2 FKs
  - Step 2.5: 0 index rows              │                            │
  - Step 2.6: 0 FKs                     ▼                            ▼
           │                     [HARD STOP]                   [SKIP DDL]
           ▼                  Run Diagnostic Matrix         Proceed to Phase 5
     [PROCEED TO]             (Do NOT run Step 4 DDL)          (Post-Check)
      Phase 4 DDL
```

#### Detailed Decision Rules:

1. **State A: Clean Unapplied Baseline $\rightarrow$ PROCEED TO PHASE 4**
   - Step 2.1 confirms `u209580425_Dearr` on MySQL 8.x.
   - Step 2.2 returns **6 tables** (`products`, `product_colors`, `product_variants`, `stock_reservations`, `cart_items`, `order_items`), all `InnoDB`.
   - Step 2.3 returns **7 parent columns** with matching `CHAR(36)` and `ENUM` types.
   - Steps 2.4, 2.5, 2.6 return **0 rows**.
   - $\rightarrow$ **Action:** Safe to execute the full Migration 012 script in Phase 4.

2. **State B: Missing Prerequisite Tables or Types $\rightarrow$ HARD STOP**
   - If `product_colors` or `stock_reservations` is missing from Step 2.2, or key types mismatch in Step 2.3:
   - $\rightarrow$ **Action:** **DO NOT EXECUTE MIGRATION 012.** Prerequisite Migration 006 has not been applied. Applying Migration 012 will fail with foreign key reference errors.

3. **State C: Partial Migration or Broken Inconsistent State $\rightarrow$ HARD STOP**
   - If Step 2.4 returns some columns (e.g. `product_variants.color_id` exists, but `stock_reservations.variant_id` does not, or indexes/FKs are missing):
   - $\rightarrow$ **Action:** **DO NOT RERUN MIGRATION 012 AND DO NOT BLINDLY RUN STEP 4.2.**
   - Review Section 6 (Partial Migration Diagnostic Matrix) to identify exactly which elements exist and formulate targeted, surgical DDL.

4. **State D: Migration Already Fully Applied $\rightarrow$ SKIP DDL**
   - If Step 2.4 returns all 4 columns, Step 2.5 returns 6 index rows, and Step 2.6 returns 2 FKs:
   - Verify `GENERATION_EXPRESSION` in Step 2.4 contains `coalesce(...)`.
   - $\rightarrow$ **Action:** Migration 012 is already complete. Skip Phase 4 and proceed directly to Phase 5 (Post-Check).

---

### Phase 4: Execute Migration 012 [SCHEMA-CHANGING MIGRATION]

> [!CAUTION]
> Execute this step **only** if State A (Clean Unapplied Baseline) was confirmed in Phase 3.
> In MySQL InnoDB, each `ALTER TABLE` statement causes an **implicit commit**.

In phpMyAdmin, click the **SQL** tab, paste the following SQL, and click **Go**:

```sql
-- =============================================================================
-- [SCHEMA-CHANGING MIGRATION] STEP 4.1: EXTEND product_variants
-- =============================================================================
ALTER TABLE `product_variants`
  ADD COLUMN `color_id` CHAR(36) DEFAULT NULL AFTER `product_id`,
  ADD COLUMN `size_name` VARCHAR(100) DEFAULT NULL AFTER `color_id`,
  ADD COLUMN `combo_hash` VARCHAR(150) GENERATED ALWAYS AS (
    CASE
      WHEN `color_id` IS NOT NULL OR (`size_name` IS NOT NULL AND TRIM(`size_name`) != '') THEN
        CONCAT(COALESCE(`color_id`, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(`size_name`)), ''))
      ELSE NULL
    END
  ) VIRTUAL AFTER `size_name`,
  ADD KEY `idx_product_variants_color_id` (`color_id`),
  ADD KEY `idx_product_variants_size_name` (`size_name`),
  ADD UNIQUE KEY `uq_product_variants_combo` (`product_id`, `combo_hash`),
  ADD CONSTRAINT `fk_product_variants_color`
    FOREIGN KEY (`color_id`) REFERENCES `product_colors` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- [SCHEMA-CHANGING MIGRATION] STEP 4.2: EXTEND stock_reservations
-- =============================================================================
ALTER TABLE `stock_reservations`
  ADD COLUMN `variant_id` CHAR(36) DEFAULT NULL AFTER `color_id`,
  ADD KEY `idx_stock_reservations_variant_status` (`variant_id`, `status`),
  ADD CONSTRAINT `fk_stock_reservations_variant`
    FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```

---

### Phase 5: Post-Migration Schema Verification [READ-ONLY CHECK]

In phpMyAdmin, click the **SQL** tab, paste the following query block, and click **Go**:

```sql
-- =============================================================================
-- [READ-ONLY CHECK] STEP 5.1: VERIFY COLUMNS & GENERATED EXPRESSION
-- Expected: Exactly 4 rows returned.
-- =============================================================================
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, EXTRA, GENERATION_EXPRESSION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'product_variants' AND COLUMN_NAME IN ('color_id', 'size_name', 'combo_hash')) OR
    (TABLE_NAME = 'stock_reservations' AND COLUMN_NAME = 'variant_id')
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 5.2: VERIFY INDEXES (EXACT ROW COUNT BREAKDOWN)
-- Expected: Exactly 6 rows returned.
--   - uq_product_variants_combo:            2 rows (product_id SEQ 1, combo_hash SEQ 2, NON_UNIQUE = 0)
--   - idx_product_variants_color_id:        1 row  (color_id SEQ 1, NON_UNIQUE = 1)
--   - idx_product_variants_size_name:       1 row  (size_name SEQ 1, NON_UNIQUE = 1)
--   - idx_stock_reservations_variant_status: 2 rows (variant_id SEQ 1, status SEQ 2, NON_UNIQUE = 1)
-- =============================================================================
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME IN ('uq_product_variants_combo', 'idx_product_variants_color_id', 'idx_product_variants_size_name', 'idx_stock_reservations_variant_status')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- =============================================================================
-- [READ-ONLY CHECK] STEP 5.3: VERIFY FOREIGN KEY CONSTRAINTS
-- Expected: Exactly 2 rows returned.
--   - fk_product_variants_color:     color_id   -> product_colors.id
--   - fk_stock_reservations_variant: variant_id -> product_variants.id
-- =============================================================================
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND CONSTRAINT_NAME IN ('fk_product_variants_color', 'fk_stock_reservations_variant')
ORDER BY CONSTRAINT_NAME;
```

#### Exact Verification Criteria:
1. **Columns (Step 5.1):** 4 rows. `combo_hash` must have `EXTRA = 'VIRTUAL GENERATED'` and `GENERATION_EXPRESSION` must include `coalesce(...)`.
2. **Indexes (Step 5.2):** **Exactly 6 rows**. `uq_product_variants_combo` must show `NON_UNIQUE = 0` across both columns.
3. **Foreign Keys (Step 5.3):** Exactly 2 rows.

---

### Phase 6: Pre-Merge Application Smoke Test [READ-ONLY CHECK]

Confirm the live production website (currently running `main` code) continues operating without regression with the newly added nullable/virtual columns:

1. Open an incognito browser window and visit:
   - `https://dearr.in/` (Storefront home page)
   - `https://dearr.in/shop` (Product catalog)
   - `https://dearr.in/product/car-silhouette-keychain` (Existing live product)
2. Verify:
   - Pages return HTTP 200.
   - Products and prices render normally.
   - Browser console shows zero 500 errors.
3. Log into Admin at `https://dearr.in/admin/products` and verify product listings load.

---

### Phase 7: Merge GitHub PR #7 into `main`

Once Phases 1 through 6 are validated:
1. Open [GitHub PR #7](https://github.com/pavankumar56366/dearr/pull/7).
2. Confirm the CI check run `validate` is green (`success`).
3. Click **Merge pull request** → **Confirm merge**.
4. Hostinger's GitHub integration will automatically build and deploy the updated application code to `https://dearr.in`.

---

### Phase 8: Post-Deployment Smoke Tests

Verify the new variant functionality live on `https://dearr.in`:
1. **Combination Selector:** Open a product with variants; verify color and size selections update pricing and stock dynamically.
2. **Cart Integration:** Add a specific color-size combination to cart; verify cart drawer displays variant title, colorway, and authoritative price.
3. **Checkout Stock Reservation:** Proceed to `/checkout`; verify stock reservation is created without error.
4. **Admin Variant Management:** Log into `/admin/products`; edit a product to add/update variant pricing and verify persistence.

---

## 5. Failure Recovery Protocol (Diagnostic-Driven)

> [!CAUTION]
> **Do NOT run unconditional rollback scripts.**
> Because DDL statements implicitly commit, running an unconditional `ALTER TABLE ... DROP ...` script when an operation partially failed or when unexpected state exists can cause syntax errors (`Can't DROP; check that column/key exists`) or irreversible data loss.

If an error occurs during Phase 4:

### Step 1: Capture Exact Error
Record the exact MySQL error code, SQL state, and error message (e.g., `ERROR 1060 (42S21): Duplicate column name`, `ERROR 1215 (HY000): Cannot add foreign key constraint`, or `ERROR 1205 (HY000): Lock wait timeout exceeded`).

### Step 2: Run Diagnostic State Mapping [READ-ONLY CHECK]
Execute Steps 2.4, 2.5, and 2.6 in phpMyAdmin to determine what actually exists in the schema.

### Step 3: Targeted Remediation Actions

| Observed Failure Condition | Root Cause | Targeted Remediation Action |
| :--- | :--- | :--- |
| **Error during Step 4.1 (`Lock wait timeout`)** | Concurrent queries held metadata locks. Step 4.1 was rolled back by MySQL before committing. | Re-run Phase 2 checks. If 0 columns exist, ensure no admin or customer transactions are active, then retry Step 4.1. |
| **Step 4.1 succeeded, but Step 4.2 failed** | `product_variants` committed. Step 4.2 failed (e.g., lock timeout or missing `stock_reservations` table). | Do NOT drop `product_variants` columns. Inspect Step 4.2 error. Once resolved, execute **only Step 4.2**. |
| **`ERROR 1062`: Duplicate entry for key `uq_product_variants_combo`** | Existing rows in `product_variants` violate the unique constraint. | Run Step 2.7 (Conditional Duplicate Check) to identify the offending rows. Deduplicate rows manually before re-adding the unique index. |
| **`ERROR 1215 / 3780`: Foreign key constraint fails** | Collation, engine, or column data type mismatch between `product_variants.color_id` and `product_colors.id`. | Verify Step 2.3 parent column types. Confirm both tables use `InnoDB` and identical collation (`utf8mb4_unicode_ci`). |

---

## 6. Partial Migration Diagnostic Matrix (Forward-Fix DDL)

If a database was previously partially migrated or contains the older Migration 012 schema, use the following targeted DDL blocks instead of raw re-execution:

### Scenario 6.1: `combo_hash` Exists but Has Outdated Expression (Lacks COALESCE)
If Step 2.4 shows `GENERATION_EXPRESSION` is `CONCAT(..., LOWER(TRIM(size_name)))` (NULL propagation bug):
```sql
-- =============================================================================
-- [SCHEMA-CHANGING] FORWARD-FIX: UPDATE combo_hash GENERATED EXPRESSION
-- =============================================================================
ALTER TABLE `product_variants`
  MODIFY COLUMN `combo_hash` VARCHAR(150) GENERATED ALWAYS AS (
    CASE
      WHEN `color_id` IS NOT NULL OR (`size_name` IS NOT NULL AND TRIM(`size_name`) != '') THEN
        CONCAT(COALESCE(`color_id`, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(`size_name`)), ''))
      ELSE NULL
    END
  ) VIRTUAL;
```

### Scenario 6.2: `product_variants` Fully Complete, `stock_reservations` Unapplied
If Step 2.4 shows `product_variants` has all 3 columns, but `stock_reservations` has 0 rows:
```sql
-- =============================================================================
-- [SCHEMA-CHANGING] TARGETED DDL: APPLY STEP 4.2 ONLY
-- =============================================================================
ALTER TABLE `stock_reservations`
  ADD COLUMN `variant_id` CHAR(36) DEFAULT NULL AFTER `color_id`,
  ADD KEY `idx_stock_reservations_variant_status` (`variant_id`, `status`),
  ADD CONSTRAINT `fk_stock_reservations_variant`
    FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```
