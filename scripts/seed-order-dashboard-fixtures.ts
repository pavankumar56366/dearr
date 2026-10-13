import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  }
  return env;
}

interface OrderFixtureDef {
  orderNumber: string;
  createdAtIst: string; // "YYYY-MM-DD HH:mm:ss"
  orderStatus: "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "paid" | "refunded";
  totalAmount: number;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  dispatchedAtIst?: string | null;
  deliveredAtIst?: string | null;
  cancelledAtIst?: string | null;
  items: Array<{
    productName: string;
    unitPrice: number;
    quantity: number;
    discountAmount: number;
    lineTotal: number;
  }>;
}

const FIXTURE_ORDERS: OrderFixtureDef[] = [
  // --- 13 October 2026 (Orders 1-10) ---
  {
    orderNumber: "QA-DASH-001",
    createdAtIst: "2026-10-13 09:00:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 549.00,
    subtotal: 549.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Golden Ganesha Idol", unitPrice: 549.00, quantity: 1, discountAmount: 0, lineTotal: 549.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-002",
    createdAtIst: "2026-10-13 09:10:00",
    orderStatus: "processing",
    paymentStatus: "paid",
    totalAmount: 699.00,
    subtotal: 699.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Radha Krishna Figurine (12.5 cm)", unitPrice: 699.00, quantity: 1, discountAmount: 0, lineTotal: 699.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-003",
    createdAtIst: "2026-10-13 10:00:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 544.10,
    subtotal: 549.00,
    discountAmount: 54.90,
    shippingAmount: 50.00,
    items: [
      { productName: "3D Printed Golden Ganesha Idol", unitPrice: 549.00, quantity: 1, discountAmount: 54.90, lineTotal: 494.10 },
    ],
  },
  {
    orderNumber: "QA-DASH-004",
    createdAtIst: "2026-10-13 10:30:00",
    orderStatus: "shipped",
    paymentStatus: "paid",
    totalAmount: 799.00,
    subtotal: 799.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-13 11:30:00",
    items: [
      { productName: "3D Printed Lithophane Night Light Lamp", unitPrice: 799.00, quantity: 1, discountAmount: 0, lineTotal: 799.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-005",
    createdAtIst: "2026-10-13 11:15:00",
    orderStatus: "delivered",
    paymentStatus: "paid",
    totalAmount: 1200.00,
    subtotal: 1200.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-13 12:00:00",
    deliveredAtIst: "2026-10-13 14:00:00",
    items: [
      { productName: "3D Printed Radha Krishna Mini Idol (Hand-Painted)", unitPrice: 600.00, quantity: 2, discountAmount: 0, lineTotal: 1200.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-006",
    createdAtIst: "2026-10-13 12:30:00",
    orderStatus: "delivered",
    paymentStatus: "paid",
    totalAmount: 350.00,
    subtotal: 350.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-13 13:30:00",
    deliveredAtIst: "2026-10-13 15:30:00",
    items: [
      { productName: "3D Printed Knitted-Texture Baby Elephant Figurine", unitPrice: 350.00, quantity: 1, discountAmount: 0, lineTotal: 350.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-007",
    createdAtIst: "2026-10-13 13:00:00",
    orderStatus: "cancelled",
    paymentStatus: "paid",
    totalAmount: 549.00,
    subtotal: 549.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    cancelledAtIst: "2026-10-13 13:30:00",
    items: [
      { productName: "3D Printed Golden Ganesha Idol", unitPrice: 549.00, quantity: 1, discountAmount: 0, lineTotal: 549.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-008",
    createdAtIst: "2026-10-13 14:00:00",
    orderStatus: "cancelled",
    paymentStatus: "refunded",
    totalAmount: 999.00,
    subtotal: 999.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    cancelledAtIst: "2026-10-13 14:30:00",
    items: [
      { productName: "3D Printed Lithophane Night Light Lamp", unitPrice: 999.00, quantity: 1, discountAmount: 0, lineTotal: 999.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-009",
    createdAtIst: "2026-10-13 15:00:00",
    orderStatus: "delivered",
    paymentStatus: "refunded",
    totalAmount: 999.00,
    subtotal: 999.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-13 16:00:00",
    deliveredAtIst: "2026-10-13 17:00:00",
    items: [
      { productName: "3D Printed Lithophane Night Light Lamp", unitPrice: 999.00, quantity: 1, discountAmount: 0, lineTotal: 999.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-010",
    createdAtIst: "2026-10-13 23:50:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 1000.00,
    subtotal: 1000.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "Modern Minimalist Ganesha with Veena Sculpture", unitPrice: 500.00, quantity: 2, discountAmount: 0, lineTotal: 1000.00 },
    ],
  },

  // --- Last Week: 5–11 October 2026 (Orders 11-15) ---
  {
    orderNumber: "QA-DASH-011",
    createdAtIst: "2026-10-05 09:00:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 400.00,
    subtotal: 400.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Hoodie Pen Holder & Desk Organizer", unitPrice: 400.00, quantity: 1, discountAmount: 0, lineTotal: 400.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-012",
    createdAtIst: "2026-10-05 23:50:00",
    orderStatus: "shipped",
    paymentStatus: "paid",
    totalAmount: 875.00,
    subtotal: 875.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-06 01:00:00",
    items: [
      { productName: "3D Printed Articulated Baby Fox Figurine", unitPrice: 875.00, quantity: 1, discountAmount: 0, lineTotal: 875.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-013",
    createdAtIst: "2026-10-07 12:00:00",
    orderStatus: "delivered",
    paymentStatus: "paid",
    totalAmount: 1550.00,
    subtotal: 1550.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-07 14:00:00",
    deliveredAtIst: "2026-10-08 10:00:00",
    items: [
      { productName: "3D Printed Radha Krishna Figurine (12.5 cm)", unitPrice: 1550.00, quantity: 1, discountAmount: 0, lineTotal: 1550.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-014",
    createdAtIst: "2026-10-11 18:30:00",
    orderStatus: "cancelled",
    paymentStatus: "paid",
    totalAmount: 650.00,
    subtotal: 650.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-11 19:30:00", // Preserved dispatch before cancellation!
    cancelledAtIst: "2026-10-11 20:30:00",
    items: [
      { productName: "3D Printed Meditating Lord Shiva (Adiyogi) Idol", unitPrice: 650.00, quantity: 1, discountAmount: 0, lineTotal: 650.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-015",
    createdAtIst: "2026-10-11 23:50:00",
    orderStatus: "processing",
    paymentStatus: "paid",
    totalAmount: 799.00,
    subtotal: 799.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Lithophane Night Light Lamp", unitPrice: 799.00, quantity: 1, discountAmount: 0, lineTotal: 799.00 },
    ],
  },

  // --- October 2026 Other Days (Orders 16-18) ---
  {
    orderNumber: "QA-DASH-016",
    createdAtIst: "2026-10-12 00:00:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 1050.00,
    subtotal: 1050.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Meditating Lord Shiva (Adiyogi) Idol", unitPrice: 650.00, quantity: 1, discountAmount: 0, lineTotal: 650.00 },
      { productName: "3D Printed Hoodie Pen Holder & Desk Organizer", unitPrice: 400.00, quantity: 1, discountAmount: 0, lineTotal: 400.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-017",
    createdAtIst: "2026-10-12 23:50:00",
    orderStatus: "delivered",
    paymentStatus: "paid",
    totalAmount: 999.00,
    subtotal: 999.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-13 01:00:00",
    deliveredAtIst: "2026-10-13 06:00:00",
    items: [
      { productName: "3D Printed Lithophane Night Light Lamp", unitPrice: 999.00, quantity: 1, discountAmount: 0, lineTotal: 999.00 },
    ],
  },
  {
    orderNumber: "QA-DASH-018",
    createdAtIst: "2026-10-14 00:00:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 200.00,
    subtotal: 200.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Knitted-Texture Puppy Keychain", unitPrice: 200.00, quantity: 1, discountAmount: 0, lineTotal: 200.00 },
    ],
  },

  // --- September 2026 (Order 19) ---
  {
    orderNumber: "QA-DASH-019",
    createdAtIst: "2026-09-30 23:50:00",
    orderStatus: "delivered",
    paymentStatus: "paid",
    totalAmount: 1299.00,
    subtotal: 1299.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-10-01 02:00:00",
    deliveredAtIst: "2026-10-01 10:00:00",
    items: [
      { productName: "3D Printed Lithophane Night Light Lamp", unitPrice: 1299.00, quantity: 1, discountAmount: 0, lineTotal: 1299.00 },
    ],
  },

  // --- Year 2025 (Order 20) ---
  {
    orderNumber: "QA-DASH-020",
    createdAtIst: "2025-12-31 23:50:00",
    orderStatus: "confirmed",
    paymentStatus: "paid",
    totalAmount: 1499.00,
    subtotal: 1499.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    items: [
      { productName: "3D Printed Radha Krishna Figurine (12.5 cm)", unitPrice: 1499.00, quantity: 1, discountAmount: 0, lineTotal: 1499.00 },
    ],
  },

  // --- Year 2026 Boundary (Order 21) ---
  {
    orderNumber: "QA-DASH-021",
    createdAtIst: "2026-01-01 00:00:00",
    orderStatus: "shipped",
    paymentStatus: "paid",
    totalAmount: 899.00,
    subtotal: 899.00,
    discountAmount: 0.00,
    shippingAmount: 0.00,
    dispatchedAtIst: "2026-01-01 02:00:00",
    items: [
      { productName: "3D Printed Meditating Lord Shiva (Adiyogi) Idol", unitPrice: 899.00, quantity: 1, discountAmount: 0, lineTotal: 899.00 },
    ],
  },
];

async function seedFixtures() {
  console.log("================================================================================");
  console.log("DEARR SYNTHETIC ORDER DASHBOARD FIXTURE SEEDER");
  console.log("================================================================================\n");

  const env = loadEnv();
  const host = env.DB_HOST || "127.0.0.1";
  const port = parseInt(env.DB_PORT || "3306", 10);
  const database = env.DB_NAME || "dearr_test";
  const user = env.DB_USER || "dearr_local_user";
  const password = env.DB_PASSWORD || "";

  // 1. Strict Fail-Closed Verification
  const APPROVED_HOSTS = ["127.0.0.1", "localhost", "::1"];
  const APPROVED_DBS = ["dearr_test"]; // Strictly dearr_test only!

  if (!APPROVED_HOSTS.includes(host.toLowerCase())) {
    console.error(`[SAFETY REFUSAL] Target host "${host}" is not local loopback!`);
    process.exit(1);
  }

  if (!APPROVED_DBS.includes(database.toLowerCase())) {
    console.error(`[SAFETY REFUSAL] Target database "${database}" is NOT the approved test database 'dearr_test'!`);
    console.error("This script is strictly refused from mutating dearr_local or production.");
    process.exit(1);
  }

  const isResetRequested = process.argv.includes("--reset-fixtures");

  console.log(`Target verified: ${database} on ${host}:${port} as ${user}`);
  console.log(`Mode: ${isResetRequested ? "RESET & RE-SEED FIXTURES" : "IDEMPOTENT SEED"}\n`);

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    // 2. Load catalog products to resolve valid product_id foreign keys
    const [dbProducts]: any = await conn.query("SELECT id, name, slug FROM products");
    if (dbProducts.length === 0) {
      throw new Error("No products found in dearr_test. Please run catalog seed first.");
    }

    const productMap = new Map<string, any>();
    for (const p of dbProducts) {
      productMap.set(p.name.toLowerCase().trim(), p);
    }
    const defaultProduct = dbProducts[0];

    // 3. Optional reset of QA fixtures only
    if (isResetRequested) {
      console.log("Safely resetting existing QA-DASH- and QA-ATT- fixture rows in dearr_test...");
      await conn.query(`
        DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'QA-DASH-%');
        DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'QA-DASH-%');
        DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_number LIKE 'QA-DASH-%');
        DELETE FROM checkout_attempts WHERE id LIKE 'QA-ATT-%' OR provider_order_id LIKE 'QA-ATT-%';
        DELETE FROM orders WHERE order_number LIKE 'QA-DASH-%';
      `);
      console.log("[PASS] Existing QA fixtures cleaned.\n");
    }

    // 4. Ensure synthetic test profiles exist
    console.log("Ensuring synthetic test customer profiles exist...");
    const customerIds: string[] = [];
    for (let i = 1; i <= 21; i++) {
      const idxStr = String(i).padStart(2, "0");
      const custId = `qa-cust-${idxStr}`;
      customerIds.push(custId);
      const email = `qa-orders-${String(i).padStart(3, "0")}@example.test`;
      const name = `QA Customer ${idxStr}`;
      const phone = `+91 99999 ${String(i).padStart(5, "0")}`;

      await conn.query(
        `INSERT INTO profiles (id, email, password_hash, full_name, phone, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'customer', NOW(), NOW())
         ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), phone=VALUES(phone)`,
        [custId, email, "$2a$10$w8T9c0sK3E1m4P0Z2Y8L.ex81f6P7P2cK0R9j7N4v5E1m8P0Z2Y8L", name, phone]
      );
    }
    console.log(`[PASS] 21 synthetic customer profiles verified.\n`);

    // 5. Seed the 21 Orders, Order Items, Payments & Status History
    console.log("Seeding exactly 21 deterministic orders...");
    let seededOrdersCount = 0;
    const orderIdMap = new Map<string, string>();

    for (let i = 0; i < FIXTURE_ORDERS.length; i++) {
      const def = FIXTURE_ORDERS[i];
      const idx = i + 1;
      const idxStr = String(idx).padStart(2, "0");
      const orderId = `qa-ord-id-${idxStr}`;
      orderIdMap.set(def.orderNumber, orderId);
      const customerId = customerIds[i];
      const customerEmail = `qa-orders-${String(idx).padStart(3, "0")}@example.test`;
      const customerName = `QA Customer ${idxStr}`;
      const customerPhone = `+91 99999 ${String(idx).padStart(5, "0")}`;

      // Insert Order record
      await conn.query(
        `INSERT INTO orders (
           id, order_number, user_id, status, payment_status,
           subtotal, discount_amount, shipping_amount, total_amount, currency,
           shipping_full_name, shipping_phone,
           shipping_address_line_1, shipping_address_line_2, shipping_city, shipping_state, shipping_postal_code, shipping_country,
           created_at, updated_at, dispatched_at, delivered_at, cancelled_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, NULL, 'Bengaluru', 'Karnataka', '560001', 'India', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status=VALUES(status), payment_status=VALUES(payment_status),
           subtotal=VALUES(subtotal), discount_amount=VALUES(discount_amount),
           shipping_amount=VALUES(shipping_amount), total_amount=VALUES(total_amount),
           dispatched_at=VALUES(dispatched_at), delivered_at=VALUES(delivered_at), cancelled_at=VALUES(cancelled_at),
           created_at=VALUES(created_at), updated_at=VALUES(updated_at)`,
        [
          orderId,
          def.orderNumber,
          customerId,
          def.orderStatus,
          def.paymentStatus,
          def.subtotal,
          def.discountAmount,
          def.shippingAmount,
          def.totalAmount,
          customerName,
          customerPhone,
          `QA Test Address ${idxStr}`,
          def.createdAtIst,
          def.createdAtIst,
          def.dispatchedAtIst || null,
          def.deliveredAtIst || null,
          def.cancelledAtIst || null,
        ]
      );

      // Clean existing items for this order to preserve idempotency
      await conn.query("DELETE FROM order_items WHERE order_id = ?", [orderId]);

      // Insert line items
      for (let itemIdx = 0; itemIdx < def.items.length; itemIdx++) {
        const item = def.items[itemIdx];
        const itemId = `qa-item-${idxStr}-${itemIdx + 1}`;
        const matchedProduct = productMap.get(item.productName.toLowerCase().trim()) || defaultProduct;

        await conn.query(
          `INSERT INTO order_items (
             id, order_id, product_id, variant_id, product_name, variant_name,
             unit_price, quantity, discount_amount, line_total, created_at
           )
           VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             product_name=VALUES(product_name), unit_price=VALUES(unit_price),
             quantity=VALUES(quantity), discount_amount=VALUES(discount_amount), line_total=VALUES(line_total)`,
          [
            itemId,
            orderId,
            matchedProduct.id,
            item.productName,
            item.unitPrice,
            item.quantity,
            item.discountAmount,
            item.lineTotal,
            def.createdAtIst,
          ]
        );
      }

      // Insert Payment record
      const paymentId = `qa-pay-${idxStr}`;
      const providerOrderId = `order_qa_dash_${idxStr}`;
      const providerPaymentId = `pay_qa_dash_${idxStr}`;
      await conn.query(
        `INSERT INTO payments (
           id, order_id, provider, provider_order_id, provider_payment_id, status, amount, currency, paid_at, created_at, updated_at
         )
         VALUES (?, ?, 'razorpay', ?, ?, 'captured', ?, 'INR', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status=VALUES(status), amount=VALUES(amount), provider_payment_id=VALUES(provider_payment_id), paid_at=VALUES(paid_at)`,
        [
          paymentId,
          orderId,
          providerOrderId,
          providerPaymentId,
          def.totalAmount,
          def.createdAtIst,
          def.createdAtIst,
          def.createdAtIst,
        ]
      );

      // Insert Order Status History
      await conn.query("DELETE FROM order_status_history WHERE order_id = ?", [orderId]);
      await conn.query(
        `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
         VALUES (?, ?, NULL, 'confirmed', 'Order placed and payment verified via Razorpay', ?)`,
        [`qa-hist-${idxStr}-1`, orderId, def.createdAtIst]
      );

      if (def.orderStatus === "processing") {
        await conn.query(
          `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
           VALUES (?, ?, 'confirmed', 'processing', 'In 3D printing production queue', DATE_ADD(?, INTERVAL 5 MINUTE))`,
          [`qa-hist-${idxStr}-2`, orderId, def.createdAtIst]
        );
      } else if (def.orderStatus === "shipped") {
        await conn.query(
          `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
           VALUES (?, ?, 'confirmed', 'shipped', 'Order dispatched via courier', ?)`,
          [`qa-hist-${idxStr}-2`, orderId, def.dispatchedAtIst || def.createdAtIst]
        );
      } else if (def.orderStatus === "delivered") {
        if (def.dispatchedAtIst) {
          await conn.query(
            `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
             VALUES (?, ?, 'confirmed', 'shipped', 'Order dispatched', ?)`,
            [`qa-hist-${idxStr}-2`, orderId, def.dispatchedAtIst]
          );
        }
        await conn.query(
          `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
           VALUES (?, ?, 'shipped', 'delivered', 'Shipment delivered to customer', ?)`,
          [`qa-hist-${idxStr}-3`, orderId, def.deliveredAtIst || def.createdAtIst]
        );
      } else if (def.orderStatus === "cancelled") {
        if (def.dispatchedAtIst) {
          await conn.query(
            `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
             VALUES (?, ?, 'confirmed', 'shipped', 'Dispatched prior to cancellation', ?)`,
            [`qa-hist-${idxStr}-2`, orderId, def.dispatchedAtIst]
          );
        }
        await conn.query(
          `INSERT INTO order_status_history (id, order_id, previous_status, new_status, notes, created_at)
           VALUES (?, ?, ?, 'cancelled', 'Order cancelled by customer/admin', ?)`,
          [`qa-hist-${idxStr}-4`, orderId, def.dispatchedAtIst ? "shipped" : "confirmed", def.cancelledAtIst || def.createdAtIst]
        );
      }

      seededOrdersCount++;
    }
    console.log(`[PASS] Seeded ${seededOrdersCount} orders with order_items, payments, and status history.\n`);

    // 6. Seed Abandoned & Converted Checkout Attempts
    console.log("Seeding synthetic checkout attempts (QA-ATT-)...");
    const sampleAddress = JSON.stringify({
      fullName: "QA Checkout Customer",
      phone: "+91 99999 11111",
      addressLine1: "123 QA Innovation Park",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "India",
    });

    const sampleCart = JSON.stringify([
      { productId: defaultProduct.id, name: defaultProduct.name, quantity: 1, unitPrice: 549, lineTotal: 549 },
    ]);

    // Attempt 1: Currently pending attempt created 10 minutes ago, expires in 20 minutes (expires_at = created_at + 30m)
    await conn.query(
      `INSERT INTO checkout_attempts (
         id, user_id, email, shipping_address, cart_snapshot, amount, currency, provider,
         provider_order_id, status, order_id, expires_at, retention_until, created_at, updated_at
       )
       VALUES (
         'QA-ATT-001', 'qa-cust-01', 'qa-orders-001@example.test', ?, ?, 549.00, 'INR', 'razorpay',
         'order_qa_att_001', 'pending', NULL,
         DATE_ADD(NOW(), INTERVAL 20 MINUTE), DATE_ADD(DATE_ADD(NOW(), INTERVAL 20 MINUTE), INTERVAL 30 DAY),
         DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_SUB(NOW(), INTERVAL 10 MINUTE)
       )
       ON DUPLICATE KEY UPDATE status=VALUES(status), expires_at=VALUES(expires_at), retention_until=VALUES(retention_until)`,
      [sampleAddress, sampleCart]
    );

    // Attempt 2: Recently expired attempt (expired 10 minutes ago, within 30-day retention)
    await conn.query(
      `INSERT INTO checkout_attempts (
         id, user_id, email, shipping_address, cart_snapshot, amount, currency, provider,
         provider_order_id, status, order_id, expires_at, retention_until, created_at, updated_at
       )
       VALUES (
         'QA-ATT-002', 'qa-cust-02', 'qa-orders-002@example.test', ?, ?, 699.00, 'INR', 'razorpay',
         'order_qa_att_002', 'expired', NULL,
         DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_ADD(DATE_SUB(NOW(), INTERVAL 10 MINUTE), INTERVAL 30 DAY),
         DATE_SUB(NOW(), INTERVAL 40 MINUTE), DATE_SUB(NOW(), INTERVAL 10 MINUTE)
       )
       ON DUPLICATE KEY UPDATE status=VALUES(status), expires_at=VALUES(expires_at), retention_until=VALUES(retention_until)`,
      [sampleAddress, sampleCart]
    );

    // Attempt 3: Expired attempt whose retention deadline passed by >1 hour (eligible for purge)
    await conn.query(
      `INSERT INTO checkout_attempts (
         id, user_id, email, shipping_address, cart_snapshot, amount, currency, provider,
         provider_order_id, status, order_id, expires_at, retention_until, created_at, updated_at
       )
       VALUES (
         'QA-ATT-003', 'qa-cust-03', 'qa-orders-003@example.test', ?, ?, 799.00, 'INR', 'razorpay',
         'order_qa_att_003', 'expired', NULL,
         DATE_SUB(NOW(), INTERVAL 31 DAY), DATE_SUB(NOW(), INTERVAL 1 HOUR),
         DATE_SUB(DATE_SUB(NOW(), INTERVAL 31 DAY), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 31 DAY)
       )
       ON DUPLICATE KEY UPDATE status=VALUES(status), expires_at=VALUES(expires_at), retention_until=VALUES(retention_until)`,
      [sampleAddress, sampleCart]
    );

    // Attempt 4: Converted attempt associated with QA-DASH-001
    const convertedOrderId = orderIdMap.get("QA-DASH-001")!;
    await conn.query(
      `INSERT INTO checkout_attempts (
         id, user_id, email, shipping_address, cart_snapshot, amount, currency, provider,
         provider_order_id, status, order_id, expires_at, retention_until, created_at, updated_at
       )
       VALUES (
         'QA-ATT-004', 'qa-cust-01', 'qa-orders-001@example.test', ?, ?, 549.00, 'INR', 'razorpay',
         'order_qa_att_004', 'converted', ?,
         '2026-10-13 09:20:00', '2026-11-12 09:20:00',
         '2026-10-13 08:50:00', '2026-10-13 09:00:00'
       )
       ON DUPLICATE KEY UPDATE status=VALUES(status), order_id=VALUES(order_id), expires_at=VALUES(expires_at), retention_until=VALUES(retention_until)`,
      [sampleAddress, sampleCart, convertedOrderId]
    );

    console.log("[PASS] 4 synthetic checkout attempts seeded (1 pending, 1 expired in retention, 1 expired past retention, 1 converted).\n");

    // 7. Verify counts in dearr_test
    const [qaOrders]: any = await conn.query("SELECT COUNT(*) AS cnt FROM orders WHERE order_number LIKE 'QA-DASH-%'");
    const [qaItems]: any = await conn.query("SELECT COUNT(*) AS cnt FROM order_items WHERE id LIKE 'qa-item-%'");
    const [qaPayments]: any = await conn.query("SELECT COUNT(*) AS cnt FROM payments WHERE id LIKE 'qa-pay-%'");
    const [qaAttempts]: any = await conn.query("SELECT COUNT(*) AS cnt FROM checkout_attempts WHERE id LIKE 'QA-ATT-%'");

    console.log("================================================================================");
    console.log("SEED VERIFICATION SUMMARY");
    console.log("================================================================================");
    console.log(`Database Target         : ${database}`);
    console.log(`QA Orders Seeded        : ${qaOrders[0].cnt} (Expected: 21)`);
    console.log(`QA Order Items Seeded   : ${qaItems[0].cnt} (Expected: 22)`);
    console.log(`QA Payments Seeded      : ${qaPayments[0].cnt} (Expected: 21)`);
    console.log(`QA Attempts Seeded      : ${qaAttempts[0].cnt} (Expected: 4)`);
    console.log("================================================================================\n");

  } finally {
    await conn.end();
  }
}

seedFixtures()
  .then(() => {
    console.log("Seeding completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding fatal error:", err);
    process.exit(1);
  });
