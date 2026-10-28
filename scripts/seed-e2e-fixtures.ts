import bcrypt from "bcryptjs";
import { query } from "../src/lib/server/db";

export async function seedE2EFixtures() {
  console.log("Seeding E2E test fixtures...");

  // 1. Customer A
  const hashPass = await bcrypt.hash("Password123!", 10);
  const custARows: any = await query("SELECT id FROM profiles WHERE email = 'customer_a@dearr.test'");
  if (custARows.length === 0) {
    await query(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES ('usr-cust-a-e2e', 'customer_a@dearr.test', ?, 'Customer Alice', '9876543210', 'customer', NOW(), NOW())`,
      [hashPass]
    );
  } else {
    await query("UPDATE profiles SET password_hash = ? WHERE email = 'customer_a@dearr.test'", [hashPass]);
  }

  // 2. Customer B
  const custBRows: any = await query("SELECT id FROM profiles WHERE email = 'customer_b@dearr.test'");
  if (custBRows.length === 0) {
    await query(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES ('usr-cust-b-e2e', 'customer_b@dearr.test', ?, 'Customer Bob', '9876543211', 'customer', NOW(), NOW())`,
      [hashPass]
    );
  } else {
    await query("UPDATE profiles SET password_hash = ? WHERE email = 'customer_b@dearr.test'", [hashPass]);
  }

  // 3. Admin
  const adminHash = await bcrypt.hash("FounderAdmin2026!", 10);
  const adminRows: any = await query("SELECT id FROM profiles WHERE email = 'founder@dearr.in'");
  if (adminRows.length === 0) {
    await query(
      `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
       VALUES ('admin-001', 'founder@dearr.in', ?, 'Dearr Founder', '9123456780', 'admin', NOW(), NOW())`,
      [adminHash]
    );
  } else {
    await query("UPDATE profiles SET password_hash = ?, role = 'admin', token_version = 1 WHERE email = 'founder@dearr.in'", [adminHash]);
  }

  // 4. Products
  // 4.1 Prepaid-only product (cod_enabled = 0)
  await query(
    `INSERT INTO products (
      id, name, slug, description, price, stock_quantity, is_active,
      cod_enabled, cod_fee, dispatch_lead_days, dispatch_timeline_text, created_at, updated_at
    ) VALUES (
      'prod-e2e-prepaid', 'E2E Artisan Lithophane (Prepaid Only)', 'e2e-artisan-lithophane-prepaid',
      'Exquisite 3D printed lithophane with heart base (prepaid orders only).',
      499.00, 50, 1, 0, 0.00, 2, 'Dispatches in 2 business days', NOW(), NOW()
    ) ON DUPLICATE KEY UPDATE
      name = VALUES(name), price = VALUES(price), stock_quantity = 50, is_active = 1,
      cod_enabled = 0, dispatch_lead_days = 2, dispatch_timeline_text = 'Dispatches in 2 business days'`
  );

  // 4.2 COD-allowed product (cod_enabled = 1, cod_fee = 50)
  await query(
    `INSERT INTO products (
      id, name, slug, description, price, stock_quantity, is_active,
      cod_enabled, cod_fee, dispatch_lead_days, dispatch_timeline_text, created_at, updated_at
    ) VALUES (
      'prod-e2e-cod', 'E2E Geometric Desk Planter (COD Allowed)', 'e2e-geometric-planter-cod',
      'Modern geometric hexagonal planter with drainage tray.',
      699.00, 50, 1, 1, 50.00, 1, 'Dispatches tomorrow', NOW(), NOW()
    ) ON DUPLICATE KEY UPDATE
      name = VALUES(name), price = VALUES(price), stock_quantity = 50, is_active = 1,
      cod_enabled = 1, cod_fee = 50.00, dispatch_lead_days = 1, dispatch_timeline_text = 'Dispatches tomorrow'`
  );

  // 4.3 Out of stock product (stock_quantity = 0)
  await query(
    `INSERT INTO products (
      id, name, slug, description, price, stock_quantity, is_active,
      cod_enabled, cod_fee, dispatch_lead_days, dispatch_timeline_text, created_at, updated_at
    ) VALUES (
      'prod-e2e-oos', 'E2E Celestial Lamp (Out of Stock)', 'e2e-celestial-lamp-oos',
      'Intricate moon lamp with warm ambient glow.',
      899.00, 0, 1, 1, 0.00, 3, 'Dispatches in 3 days', NOW(), NOW()
    ) ON DUPLICATE KEY UPDATE
      name = VALUES(name), price = VALUES(price), stock_quantity = 0, is_active = 1,
      cod_enabled = 1`
  );

  // 5. Store Settings
  const settingsJson = JSON.stringify({
    shippingEnabled: true,
    shippingFreeThreshold: 999,
    shippingFixedMarkup: 20,
    shippingPercentageMarkup: 10,
    shippingMarkupCap: 50,
    shippingFallbackFee: 70,
    shippingCourierStrategy: "cheapest",
    shippingDefaultWeightKg: 0.5,
    shippingDefaultLengthCm: 15,
    shippingDefaultBreadthCm: 12,
    shippingDefaultHeightCm: 10,
    codEnabled: true,
    codMinimumFee: 40,
    codMaxOrderValue: 2500,
    dispatchLeadDays: 2,
    dispatchTimelineText: "Dispatches within 48 hours",
  });

  const settingRows: any = await query("SELECT id FROM store_settings LIMIT 1");
  if (settingRows.length === 0) {
    await query("INSERT INTO store_settings (id, settings_json, updated_at) VALUES ('primary', ?, NOW())", [settingsJson]);
  } else {
    await query("UPDATE store_settings SET settings_json = ?, updated_at = NOW() WHERE id = ?", [settingsJson, settingRows[0].id]);
  }

  // 5. Default Customer Addresses
  await query(
    `INSERT INTO addresses (id, user_id, label, full_name, phone, address_line_1, city, state, postal_code, country, is_default, created_at, updated_at)
     VALUES ('addr-cust-a-e2e', 'usr-cust-a-e2e', 'Home', 'Customer Alice', '9876543210', 'Flat 401, Lotus Enclave', 'New Delhi', 'Delhi', '110001', 'India', 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE postal_code = '110001', full_name = 'Customer Alice'`
  );
  await query(
    `INSERT INTO addresses (id, user_id, label, full_name, phone, address_line_1, city, state, postal_code, country, is_default, created_at, updated_at)
     VALUES ('addr-cust-b-e2e', 'usr-cust-b-e2e', 'Home', 'Customer Bob', '9876543211', 'Flat 502, Rose Villa', 'New Delhi', 'Delhi', '110001', 'India', 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE postal_code = '110001', full_name = 'Customer Bob'`
  );

  console.log("✓ E2E test fixtures successfully seeded in dearr_local!");
}

if (require.main === module) {
  seedE2EFixtures().then(() => process.exit(0)).catch((err) => {
    console.error("Failed to seed fixtures:", err);
    process.exit(1);
  });
}
