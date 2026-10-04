-- =============================================================================
-- Dearr V1 — Database Schema Verification Script
-- Database: Hostinger MySQL 8.x
-- Checks table presence, storage engines, foreign key constraints, and indexes.
-- =============================================================================

-- 1. Verify presence of all 18 V1 relational tables
SELECT 
    table_name AS `Table Name`,
    engine AS `Engine`,
    table_rows AS `Rows`,
    table_collation AS `Collation`
FROM 
    information_schema.tables
WHERE 
    table_schema = DATABASE()
    AND table_name IN (
        'profiles',
        'categories',
        'products',
        'product_images',
        'product_variants',
        'wishlists',
        'wishlist_items',
        'carts',
        'cart_items',
        'discounts',
        'discount_products',
        'discount_categories',
        'addresses',
        'orders',
        'order_items',
        'payments',
        'reviews',
        'audit_logs'
    )
ORDER BY 
    table_name ASC;

-- 2. Verify table count matches expected 18 tables
SELECT 
    COUNT(*) AS total_v1_tables_found,
    CASE 
        WHEN COUNT(*) = 18 THEN 'PASSED: All 18 Dearr V1 tables exist.'
        ELSE CONCAT('FAILED: Found ', COUNT(*), ' of 18 expected tables.')
    END AS verification_status
FROM 
    information_schema.tables
WHERE 
    table_schema = DATABASE()
    AND table_name IN (
        'profiles',
        'categories',
        'products',
        'product_images',
        'product_variants',
        'wishlists',
        'wishlist_items',
        'carts',
        'cart_items',
        'discounts',
        'discount_products',
        'discount_categories',
        'addresses',
        'orders',
        'order_items',
        'payments',
        'reviews',
        'audit_logs'
    );

-- 3. Verify foreign key constraints
SELECT 
    constraint_name AS `Foreign Key`,
    table_name AS `Child Table`,
    referenced_table_name AS `Parent Table`
FROM 
    information_schema.referential_constraints
WHERE 
    constraint_schema = DATABASE()
ORDER BY 
    table_name, constraint_name;

-- 4. Verify unique constraints
SELECT 
    t.table_name AS `Table`,
    t.constraint_name AS `Constraint Name`,
    GROUP_CONCAT(k.column_name ORDER BY k.ordinal_position) AS `Unique Columns`
FROM 
    information_schema.table_constraints t
JOIN 
    information_schema.key_column_usage k
    ON t.constraint_name = k.constraint_name
    AND t.table_schema = k.table_schema
    AND t.table_name = k.table_name
WHERE 
    t.constraint_type = 'UNIQUE'
    AND t.table_schema = DATABASE()
GROUP BY 
    t.table_name, t.constraint_name
ORDER BY 
    t.table_name, t.constraint_name;

-- 5. Verify CHECK constraints (MySQL 8.0.16+)
SELECT 
    tc.table_name AS `Table`,
    tc.constraint_name AS `Constraint Name`,
    cc.check_clause AS `Check Expression`
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE 
    tc.table_schema = DATABASE()
ORDER BY 
    tc.table_name, tc.constraint_name;

-- 6. Verify indexes
SELECT 
    table_name AS `Table`,
    index_name AS `Index Name`,
    CASE WHEN non_unique = 0 THEN 'UNIQUE' ELSE 'NON-UNIQUE' END AS `Type`,
    GROUP_CONCAT(column_name ORDER BY seq_in_index) AS `Indexed Columns`
FROM 
    information_schema.statistics
WHERE 
    table_schema = DATABASE()
GROUP BY 
    table_name, index_name, non_unique
ORDER BY 
    table_name, index_name;
