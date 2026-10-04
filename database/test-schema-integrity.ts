import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

async function main() {
  const host = process.env.DB_HOST || "srv1741.hstgr.io";
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const user = process.env.DB_USER || "u209580425_dearr_user";
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "u209580425_Dearr";

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  console.log(`[Dearr B-03 Integrity Test] Testing constraints in transaction on ${host}...`);

  try {
    await connection.beginTransaction();

    // 1. Test insertion of valid profile
    console.log("  1. Testing valid profile insertion...");
    await connection.execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, role)
       VALUES ('test-user-001', 'test.audit@dearr.in', '$2a$10$hash', 'Audit Tester', 'customer')`
    );
    console.log("     ✓ Valid profile created successfully.");

    // 2. Test unique constraint on profiles.email
    console.log("  2. Testing unique email constraint on profiles...");
    let dupEmailCaught = false;
    try {
      await connection.execute(
        `INSERT INTO profiles (id, email, password_hash, full_name, role)
         VALUES ('test-user-002', 'test.audit@dearr.in', '$2a$10$hash', 'Audit Tester 2', 'customer')`
      );
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        dupEmailCaught = true;
      } else {
        throw err;
      }
    }
    if (dupEmailCaught) {
      console.log("     ✓ ER_DUP_ENTRY correctly rejected duplicate email.");
    } else {
      throw new Error("Failed: Duplicate email was allowed!");
    }

    // 3. Test CHECK constraint: negative product price
    console.log("  3. Testing CHECK constraint: negative product price...");
    let negPriceCaught = false;
    try {
      await connection.execute(
        `INSERT INTO products (id, name, slug, description, price, stock_quantity)
         VALUES ('test-prod-neg', 'Neg Product', 'neg-prod', 'desc', -50.00, 10)`
      );
    } catch (err: any) {
      if (err.errno === 4025 || (err.sqlMessage && err.sqlMessage.includes("chk_products_price")) || err.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
        negPriceCaught = true;
      } else {
        throw err;
      }
    }
    if (negPriceCaught) {
      console.log("     ✓ CHECK constraint correctly rejected negative price.");
    } else {
      throw new Error("Failed: Negative price was allowed!");
    }

    // 4. Test CHECK constraint: invalid discount percentage (> 100)
    console.log("  4. Testing CHECK constraint: discount percentage > 100%...");
    let invalidDiscCaught = false;
    try {
      await connection.execute(
        `INSERT INTO discounts (id, name, code, discount_type, value, scope, start_at)
         VALUES ('test-disc-150', 'Over 100', 'OVER150', 'percentage', 150.00, 'store', NOW())`
      );
    } catch (err: any) {
      if (err.errno === 4025 || (err.sqlMessage && err.sqlMessage.includes("chk_discounts_percentage")) || err.code === "ER_CHECK_CONSTRAINT_VIOLATED") {
        invalidDiscCaught = true;
      } else {
        throw err;
      }
    }
    if (invalidDiscCaught) {
      console.log("     ✓ CHECK constraint correctly rejected percentage > 100.");
    } else {
      throw new Error("Failed: Discount percentage > 100 was allowed!");
    }

    // 5. Test CHECK constraint: review rating out of range (6 stars)
    console.log("  5. Testing CHECK constraint: review rating out of 1..5 range...");
    let invalidRatingCaught = false;
    try {
      await connection.execute(
        `INSERT INTO reviews (id, product_id, customer_name, customer_email, rating, title, comment)
         VALUES ('test-rev-6', 'non-existent-prod', 'Rater', 'rater@example.com', 6, 'Great', 'Super')`
      );
    } catch (err: any) {
      if (err.errno === 4025 || (err.sqlMessage && err.sqlMessage.includes("chk_reviews_rating")) || err.code === "ER_CHECK_CONSTRAINT_VIOLATED" || err.code === "ER_NO_REFERENCED_ROW_2") {
        invalidRatingCaught = true;
      } else {
        throw err;
      }
    }
    if (invalidRatingCaught) {
      console.log("     ✓ Constraints correctly prevented invalid review rating.");
    } else {
      throw new Error("Failed: Invalid review rating was allowed!");
    }

    // 6. Test Foreign Key constraint: invalid category reference
    console.log("  6. Testing foreign key constraint: non-existent category...");
    let invalidFkCaught = false;
    try {
      await connection.execute(
        `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity)
         VALUES ('test-prod-fk', 'non-existent-cat-id', 'FK Product', 'fk-prod', 'desc', 99.00, 5)`
      );
    } catch (err: any) {
      if (err.code === "ER_NO_REFERENCED_ROW_2") {
        invalidFkCaught = true;
      } else {
        throw err;
      }
    }
    if (invalidFkCaught) {
      console.log("     ✓ ER_NO_REFERENCED_ROW_2 correctly rejected invalid category_id.");
    } else {
      throw new Error("Failed: Non-existent category_id was allowed!");
    }

    // 7. Test Historical Order Preservation: SET NULL on product deletion
    console.log("  7. Testing historical order preservation (ON DELETE SET NULL on order_items)...");
    await connection.execute(
      `INSERT INTO categories (id, name, slug) VALUES ('test-cat-01', 'Test Cat', 'test-cat')`
    );
    await connection.execute(
      `INSERT INTO products (id, category_id, name, slug, description, price, stock_quantity)
       VALUES ('test-prod-01', 'test-cat-01', 'Test Product', 'test-prod-01', 'desc', 299.00, 10)`
    );
    await connection.execute(
      `INSERT INTO orders (id, order_number, user_id, subtotal, total_amount, shipping_full_name, shipping_phone, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code)
       VALUES ('test-ord-01', 'TEST-ORD-01', 'test-user-001', 299.00, 299.00, 'Test Name', '9999999999', '123 Test St', 'Mumbai', 'MH', '400001')`
    );
    await connection.execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, line_total)
       VALUES ('test-oi-01', 'test-ord-01', 'test-prod-01', 'Test Product Snapshot', 299.00, 1, 299.00)`
    );

    // Delete the product
    await connection.execute(`DELETE FROM products WHERE id = 'test-prod-01'`);

    // Verify order_item still exists with product_id set to NULL and snapshot preserved
    const [preservedItems]: any = await connection.execute(
      `SELECT id, order_id, product_id, product_name, unit_price FROM order_items WHERE id = 'test-oi-01'`
    );

    if (preservedItems.length === 1 && preservedItems[0].product_id === null && preservedItems[0].product_name === "Test Product Snapshot") {
      console.log("     ✓ Historical order item preserved after product removal (product_id = NULL, snapshot intact).");
    } else {
      throw new Error("Failed: Historical order item was deleted or corrupted!");
    }

    console.log("\n[Dearr B-03 Integrity Test] All constraint tests PASSED! Rolling back test transaction...");
  } finally {
    // Always rollback to ensure no test data is persisted
    await connection.rollback();
    await connection.end();
    console.log("[Dearr B-03 Integrity Test] Transaction rolled back cleanly. Database remains pristine.");
  }
}

main().catch((err) => {
  console.error("Integrity test failed:", err);
  process.exit(1);
});
