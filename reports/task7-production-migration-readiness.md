# Dearr V1 — Task 7: Production Migration Readiness Review & Runbook (Migration 012)

**Report Date:** 2026-10-27  
**Scope:** Investigation, resolution of technical blockers, and production runbook for `database/migrations/012_variant_specific_pricing.sql`  
**Target Database:** Hostinger MySQL 8.x (`srv1741.hstgr.io`, database `u209580425_Dearr`)  
**Repository Branch:** `feature/variant-pricing`  
**Latest Git Commit:** `4bd16f5` (*fix(catalog): canonicalize category slugs and restore storefront product visibility*)  
**Safety Protocol:** Strictly Read-Only for Production. Zero connections, queries, DDL, or DML executed against Hostinger production. All validations performed on isolated local test databases (`dearr_test` and `dearr_local` on `127.0.0.1:3306`).

---

## 1. Executive Verdict & Verified Blocker Status

### **CURRENT VERDICT: READY WITH OWNER PREREQUISITES**

The technical blockers identified in the initial review have been **fully resolved and verified in code and local database tests**. Migration 012 is now mathematically sound and protected against data-integrity risks. However, execution on Hostinger Production remains gated on essential database-owner prerequisites:

| Item | Classification | Verification Status | Current Status & Notes |
| :--- | :--- | :--- | :--- |
| **`combo_hash` Virtual Column Expression** | **TECHNICAL BLOCKER** | **VERIFIED & RESOLVED LOCALLY** | **FIXED.** Replaced `LOWER(TRIM(size_name))` with `COALESCE(LOWER(TRIM(size_name)), '')`. Prevents NULL propagation for color-only variants; unique constraint `uq_product_variants_combo` now enforces database-level uniqueness for all variant types. |
| **Color Deletion Cascade Risk** | **TECHNICAL BLOCKER** | **VERIFIED & RESOLVED LOCALLY** | **FIXED.** Updated `src/lib/server/product.ts` color removal logic to inspect `product_variants` and `stock_reservations`. If variants exist, colors are soft-deactivated (`is_active = 0`) instead of hard-deleted, preventing accidental cascading wipe of variants. |
| **Hostinger Prerequisite Migrations (006–011)** | **OWNER BLOCKER** | **REQUIRES OWNER ACTION** | Hostinger production state has not been inspected. Owner must run read-only pre-flight SQL to confirm `product_colors` and `stock_reservations` exist prior to executing Migration 012. |
| **Production Backup & Restore Verification** | **OWNER BLOCKER** | **REQUIRES OWNER ACTION** | Logical backup (`mysqldump`) must be executed and verified with a trial restore test on an isolated target before applying DDL. |
| **Deployment Maintenance Window** | **OWNER BLOCKER** | **REQUIRES OWNER ACTION** | Application code references new columns (`color_id`, `size_name`, `variant_id`). DDL and Next.js deployment must be coordinated during a scheduled 10-minute maintenance window to prevent fatal query errors. |

---

## 2. Summary of Code Changes Made

All changes were surgical, limited in scope, and verified against existing regression suites:

### 2.1 Migration 012 (`database/migrations/012_variant_specific_pricing.sql`)
- **File:** [012_variant_specific_pricing.sql](file:///d:/Desktop/dearr-next-feature/database/migrations/012_variant_specific_pricing.sql)
- **Change:** Updated the generated column expression for `combo_hash` on `product_variants`:
  ```sql
  -- Previous (Buggy - NULL propagation in CONCAT yielded NULL for color-only variants):
  CONCAT(COALESCE(`color_id`, '00000000-0000-0000-0000-000000000000'), '::', LOWER(TRIM(`size_name`)))

  -- Updated (Safe - Coalesces size_name to empty string, yielding '<color_id>::'):
  CONCAT(COALESCE(`color_id`, '00000000-0000-0000-0000-000000000000'), '::', COALESCE(LOWER(TRIM(`size_name`)), ''))
  ```
- **Rationale:** Aligns MySQL generated virtual column with TypeScript in-memory validation in `src/lib/server/product.ts` (`${colorId ?? "0000..."}::${(sizeName ?? "").toLowerCase()}`).

### 2.2 Color Deletion Safeguards (`src/lib/server/product.ts`)
- **File:** [product.ts](file:///d:/Desktop/dearr-next-feature/src/lib/server/product.ts#L1236-L1258)
- **Change:** In `updateProduct`, expanded the reference checks before deleting a color:
  ```typescript
  // Added queries checking dependent product_variants and active stock_reservations
  const [variantRefs]: any = await conn.execute(
    "SELECT id FROM product_variants WHERE color_id = ? LIMIT 1",
    [oldId]
  );
  const [resRefs]: any = await conn.execute(
    "SELECT id FROM stock_reservations WHERE color_id = ? LIMIT 1",
    [oldId]
  );
  if (orderRefs.length > 0 || cartRefs.length > 0 || variantRefs.length > 0 || resRefs.length > 0) {
    // Soft-deactivate to preserve historical integrity and dependent variants
    await conn.execute(
      "UPDATE product_colors SET is_active = 0, updated_at = NOW() WHERE id = ?",
      [oldId]
    );
  } else {
    await conn.execute("DELETE FROM product_colors WHERE id = ?", [oldId]);
  }
  ```
- **Rationale:** Prevents `DELETE FROM product_colors` from triggering MySQL `ON DELETE CASCADE` on `fk_product_variants_color`, protecting variants and preserving cart/order relations.

### 2.3 Migration Application Scripts
- **Files:**
  - [scripts/apply-migration-012-local.ts](file:///d:/Desktop/dearr-next-feature/scripts/apply-migration-012-local.ts)
  - [scripts/apply-test-migrations-006-to-012.ts](file:///d:/Desktop/dearr-next-feature/scripts/apply-test-migrations-006-to-012.ts)
- **Change:** Added forward-fix logic (`ALTER TABLE product_variants MODIFY COLUMN combo_hash ...`) so that databases where Migration 012 was already applied receive the updated `combo_hash` expression safely without data loss.

### 2.4 Dedicated Readiness Verification Suite
- **File:** [scripts/test-task7-readiness-verification.ts](file:///d:/Desktop/dearr-next-feature/scripts/test-task7-readiness-verification.ts)
- **Change:** Automated test suite validating all 6 `combo_hash` edge cases, MySQL constraint enforcement (`ER_DUP_ENTRY`), color deletion soft-deactivation, and stock reservation foreign keys.

---

## 3. Investigation Findings & Risk Assessments

### 3.1 `combo_hash` Investigation Details
Evaluation of the generated column under all variant conditions:

| Variant Scenario | `color_id` | `size_name` | Original Hash | Updated Hash | Unique Key Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Legacy generic variant** | `NULL` | `NULL` | `NULL` | `NULL` | **Multiple allowed per product** (MySQL unique allows multiple NULLs). |
| **Color-only variant** | `'col-123'` | `NULL` | `NULL` (*Bug*) | `'col-123::'` | **Duplicate color-only variants strictly rejected** (`ER_DUP_ENTRY 1062`). |
| **Size-only variant** | `NULL` | `'Large'` | `'0000...::large'` | `'0000...::large'` | **Duplicate size-only variants strictly rejected**. |
| **Color + Size combination** | `'col-123'` | `'10cm'` | `'col-123::10cm'` | `'col-123::10cm'` | **Duplicate combinations strictly rejected**. |
| **Casing & whitespace duplicate** | `'col-123'` | `'  10CM  '` | `'col-123::10cm'` | `'col-123::10cm'` | **Normalized & rejected** against `'10cm'`. |

### 3.2 Color Deletion & Foreign Key Cascades Analysis
1. **Current Schema:** Migration 012 defines:
   `CONSTRAINT fk_product_variants_color FOREIGN KEY (color_id) REFERENCES product_colors (id) ON DELETE CASCADE ON UPDATE CASCADE;`
2. **Data-Integrity Risk:**
   If a color was removed from a product in the admin interface, the prior application code only checked `order_items` and `cart_items`. If those were empty (e.g. for a recently added variant or if orders used variant snapshots), it executed `DELETE FROM product_colors`. MySQL immediately cascaded the delete to `product_variants`. In turn, `order_items.variant_id` and `cart_items.variant_id` were set to `NULL` (`ON DELETE SET NULL`), causing silent data corruption and customer cart item disassociation.
3. **Evaluated Solutions:**
   - *Option 1: Foreign Key `ON DELETE RESTRICT`*: Blocks DB-level deletion. However, in MySQL InnoDB, if `products` table cascades to both `product_colors` and `product_variants`, deleting a parent product can fail due to constraint check ordering.
   - *Option 2: Foreign Key `ON DELETE SET NULL`*: Variant loses its color and silently becomes a generic size variant, risking `uq_product_variants_combo` collisions.
   - *Option 3 (Recommended & Implemented)*: Application-level fail-safe check with soft-deactivation. Before deleting a color, the application checks `order_items`, `cart_items`, `product_variants`, and `stock_reservations`. If ANY reference exists, the color is soft-deactivated (`is_active = 0`). Only unreferenced colors (0 variants, 0 carts, 0 orders, 0 reservations) are hard-deleted.
4. **Compatibility:** Fully backward-compatible and preserves all historical records.

---

## 4. Tests Executed & Real Local Results

All tests were executed on the isolated local test environment (`127.0.0.1:3306`, target `dearr_test`):

```
================================================================================
                      AUTOMATED TEST VERIFICATION MATRIX
================================================================================
Test Suite                                  Target       Passed  Failed  Status
--------------------------------------------------------------------------------
1. test-task3-variant-authoritative-pricing  Unit / Logic   40      0     PASS
2. test-admin-variant-management            Logic / Admin  15      0     PASS
3. test-task5-variant-db-integration        dearr_test     72      0     PASS
4. test-task6-customer-variant-flow         Logic / Client 14      0     PASS
5. test-task7-readiness-verification        dearr_test     12      0     PASS
6. TypeScript Typecheck (npx tsc --noEmit)  Full Repo       -      0     PASS
--------------------------------------------------------------------------------
TOTAL TEST CASES VERIFIED:                                 153     0     PASS
================================================================================
```

### Detailed Breakdown of Task 7 Verification (`scripts/test-task7-readiness-verification.ts`):
- `[PASS]` 1.1 Legacy variant with no color and no size evaluates to combo_hash = NULL
- `[PASS]` 1.2 Multiple legacy variants for same product coexist without unique constraint violation
- `[PASS]` 1.3 Color-only variant evaluates to '<color_id>::' (non-null hash)
- `[PASS]` 1.4 Size-only variant evaluates to zero-UUID::size
- `[PASS]` 1.5 Color-and-size combination evaluates to '<color_id>::10cm'
- `[PASS]` 1.6 Duplicate color-only variant is strictly REJECTED by MySQL constraint uq_product_variants_combo (`ER_DUP_ENTRY 1062`)
- `[PASS]` 1.7 Duplicate combination with uppercase and surrounding whitespace ('  10CM  ') is strictly REJECTED by MySQL (`ER_DUP_ENTRY 1062`)
- `[PASS]` 2.1 Color with associated variants is SOFT-DEACTIVATED (is_active = 0) and NOT hard-deleted
- `[PASS]` 2.2 Associated product variant was preserved without cascading deletion
- `[PASS]` 2.3 Unreferenced color with 0 variants/orders/carts is cleanly hard-deleted
- `[PASS]` 3.1 stock_reservations accurately links variant_id and color_id
- `[PASS]` 3.2 Stock reservations lifecycle cleaned up without errors

---

## 5. Prerequisites to Verify on Production

Before executing Migration 012, an authorized database operator must run the following read-only SQL queries against Hostinger MySQL:

```sql
-- -----------------------------------------------------------------------------
-- CHECK 1: Verify Connected Database & MySQL Version
-- Expected: Database 'u209580425_Dearr', Version 8.0.x
-- -----------------------------------------------------------------------------
SELECT DATABASE() AS active_db, VERSION() AS mysql_version;

-- -----------------------------------------------------------------------------
-- CHECK 2: Verify Prerequisite Tables Exist (Migrations 001 - 011)
-- Expected: 6 rows returned (products, product_colors, product_variants,
--           stock_reservations, cart_items, order_items)
-- -----------------------------------------------------------------------------
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('products', 'product_colors', 'product_variants', 'stock_reservations', 'cart_items', 'order_items');

-- -----------------------------------------------------------------------------
-- CHECK 3: Check If Migration 012 Columns Already Exist (Idempotency / Partial Check)
-- Expected: 0 rows returned if unapplied.
-- -----------------------------------------------------------------------------
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'product_variants' AND COLUMN_NAME IN ('color_id', 'size_name', 'combo_hash')) OR
    (TABLE_NAME = 'stock_reservations' AND COLUMN_NAME = 'variant_id')
  );

-- -----------------------------------------------------------------------------
-- CHECK 4: Check For Duplicate Combinations in Existing Variants
-- Expected: 0 rows returned
-- -----------------------------------------------------------------------------
SELECT product_id, color_id, size_name, COUNT(*) AS dup_count
FROM product_variants
WHERE color_id IS NOT NULL OR size_name IS NOT NULL
GROUP BY product_id, color_id, size_name
HAVING dup_count > 1;

-- -----------------------------------------------------------------------------
-- CHECK 5: Verify Active Stock Reservations
-- -----------------------------------------------------------------------------
SELECT status, COUNT(*) AS count
FROM stock_reservations
GROUP BY status;
```

---

## 6. Backup & Restore-Verification Protocol

> [!CRITICAL]
> A backup is **NOT VERIFIED** merely because a file was written to disk. The operator must verify logical structure, file completeness, and perform a trial restore on an isolated non-production target before touching the live database.

### Step 1: Logical Backup Generation
```bash
# Execute on the production maintenance bastion or host
mysqldump -h srv1741.hstgr.io -u <PROD_USER> -p \
  --single-transaction \
  --quick \
  --hex-blob \
  --routines \
  --triggers \
  u209580425_Dearr > "pre_migration_012_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Step 2: Backup Integrity Verification
1. **Check Non-Zero File Size:**
   ```bash
   ls -lh pre_migration_012_backup_*.sql
   ```
2. **Verify SQL Dump Completed Signature:**
   ```bash
   tail -n 10 pre_migration_012_backup_*.sql
   # Must contain: "-- Dump completed on YYYY-MM-DD HH:MM:SS"
   ```
3. **Verify Critical Table Definitions Exist in Dump:**
   ```bash
   grep -E "CREATE TABLE .*(products|product_colors|product_variants|stock_reservations)" pre_migration_012_backup_*.sql
   ```

### Step 3: Trial Restore Test (Mandatory Verification)
Restore the backup file into an isolated test or local database to guarantee it can recover without error:
```bash
mysql -h 127.0.0.1 -u <LOCAL_USER> -p dearr_restore_verify < "pre_migration_012_backup_<TIMESTAMP>.sql"
# Verify row counts match
mysql -h 127.0.0.1 -u <LOCAL_USER> -p -e "SELECT count(*) FROM dearr_restore_verify.products;"
```

---

## 7. Migration Execution Sequence (Runbook)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRODUCTION ROLLOUT RUNBOOK                           │
├────────────────────────────────────────────────────────────────────────┤
│  Phase 1: Scheduled Maintenance Window Activation (10 min)             │
│  Phase 2: Database Pre-Migration Verification & Backup                 │
│  Phase 3: Migration 012 DDL Execution                                  │
│  Phase 4: Schema Verification via INFORMATION_SCHEMA                   │
│  Phase 5: Deploy Application Code (Next.js build)                      │
│  Phase 6: Post-Deployment Smoke Tests                                  │
│  Phase 7: Maintenance Mode Deactivation (Traffic Resumes)              │
└────────────────────────────────────────────────────────────────────────┘
```

### Detailed Operator Step-by-Step:

1. **Window Initiation:** Schedule during low-traffic window (e.g., 02:00 - 02:30 IST).
2. **Enable Maintenance Mode:** Route incoming web traffic to temporary 503 Maintenance page to ensure zero in-flight checkout attempts.
3. **Backup:** Run Steps 1–3 of Section 6.
4. **Pre-Check:** Run Queries 1–5 of Section 5.
5. **Execute DDL (Migration 012):**
   ```sql
   -- =========================================================================
   -- STEP 1: Extend `product_variants`
   -- =========================================================================
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

   -- =========================================================================
   -- STEP 2: Extend `stock_reservations`
   -- =========================================================================
   ALTER TABLE `stock_reservations`
     ADD COLUMN `variant_id` CHAR(36) DEFAULT NULL AFTER `color_id`,
     ADD KEY `idx_stock_reservations_variant_status` (`variant_id`, `status`),
     ADD CONSTRAINT `fk_stock_reservations_variant`
       FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
   ```
6. **Partial Failure Detection & Recovery:**
   If Step 1 succeeds but Step 2 fails, rerunning the entire file will fail on Step 1 with `ERROR 1060 Duplicate column`.
   *Action:* Check `INFORMATION_SCHEMA.COLUMNS`. If `product_variants.color_id` exists, execute **only** Step 2.
7. **Post-DDL Verification:** Run Section 8 verification queries.
8. **Deploy Next.js Application:** Deploy branch `feature/variant-pricing`.
9. **Smoke Test:** Run all tests in Section 9.
10. **Resume Traffic:** Disable 503 maintenance mode.

---

## 8. Post-Migration Schema Verification Queries

Execute against Hostinger MySQL immediately following DDL:

```sql
-- 1. Verify New Columns & Generated Expression
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, EXTRA, GENERATION_EXPRESSION
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'product_variants' AND COLUMN_NAME IN ('color_id', 'size_name', 'combo_hash')) OR
    (TABLE_NAME = 'stock_reservations' AND COLUMN_NAME = 'variant_id')
  );

-- 2. Verify Secondary and Unique Indexes
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME IN ('uq_product_variants_combo', 'idx_product_variants_color_id', 'idx_product_variants_size_name', 'idx_stock_reservations_variant_status')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 3. Verify Foreign Key Constraints
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND CONSTRAINT_NAME IN ('fk_product_variants_color', 'fk_stock_reservations_variant');
```

---

## 9. Post-Migration Application Smoke Tests

| ID | Test Flow | Step-by-Step Procedure | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **ST-01** | **Catalog & Filtering** | Navigate to `/shop`. Filter by category. Inspect browser network and console. | Status 200. Products and pricing render without 500 errors. | `[ ]` |
| **ST-02** | **Color & Size Selector** | Open a product with combinations (e.g., Articulated Dragon). Select different colors and sizes. | Active combinations show variant-specific price and inventory. Inactive combinations disable purchasing. | `[ ]` |
| **ST-03** | **Cart Persistence** | Add a color-size variant to cart. Change quantity. Open cart drawer. | Cart item correctly reflects variant name, colorway, and authoritative price. | `[ ]` |
| **ST-04** | **Stock Reservation & Checkout** | Proceed to `/checkout`. Fill shipping information. | Order summary reflects exact authoritative total. `stock_reservations` creates active reservation for `variant_id`. | `[ ]` |
| **ST-05** | **Order Placement & Deduction** | Complete payment or COD checkout. Verify order confirmation page. | Order is placed. `product_variants.stock_quantity` decrements by quantity. Reservation transitions to `consumed`. | `[ ]` |
| **ST-06** | **Admin Variant Management** | Log into `/admin/products`. Edit a product to add/update combination pricing and save. | Changes persist to MySQL. Combination uniqueness is enforced. | `[ ]` |

---

## 10. Rollback Limitations & Safe Recovery Strategy

> [!CAUTION]
> In MySQL InnoDB, `ALTER TABLE` operations cause an **implicit commit**. They cannot be rolled back via SQL `ROLLBACK`.

### Rollback SQL Script (For Maintenance Window Failures Only):
```sql
-- Step 1: Revert stock_reservations
ALTER TABLE `stock_reservations`
  DROP FOREIGN KEY `fk_stock_reservations_variant`,
  DROP KEY `idx_stock_reservations_variant_status`,
  DROP COLUMN `variant_id`;

-- Step 2: Revert product_variants
ALTER TABLE `product_variants`
  DROP FOREIGN KEY `fk_product_variants_color`,
  DROP KEY `uq_product_variants_combo`,
  DROP KEY `idx_product_variants_color_id`,
  DROP KEY `idx_product_variants_size_name`,
  DROP COLUMN `combo_hash`,
  DROP COLUMN `size_name`,
  DROP COLUMN `color_id`;
```

### Irreversible Data Loss Warning for Post-Traffic Rollback:
- **Zero Data Loss:** If executed **during** the maintenance window before customer traffic resumes.
- **Permanent Data Loss:** If executed **after** production traffic resumes and customers or admins have created variants, added items to cart, or placed orders:
  - Dropping `color_id` and `size_name` will **permanently delete** all variant-specific combinations.
  - Dropping `variant_id` on `stock_reservations` will sever active reservation auditing.
- **Safe Strategy:** If an issue arises after traffic resumes, **do not execute rollback SQL**. Deploy a forward-fix patch while keeping the database schema intact.

---

## 11. Production Safety Attestation

I attest that during this review and resolution:
1. **Zero connections** were established to Hostinger Production (`srv1741.hstgr.io`).
2. **Zero DDL or DML statements** were executed against production.
3. No secrets, credentials, or production tokens were logged or exposed.
4. No Git commits, pushes, merges, or branch switches were executed.
5. All validations were conducted strictly on local disposable databases (`dearr_test` and `dearr_local`).
