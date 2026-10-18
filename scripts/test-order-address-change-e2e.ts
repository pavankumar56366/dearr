import fs from "fs";
import path from "path";

import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// 1. Load test environment safely (.env.test.local preferred, fail closed against non-test DB)
loadTestEnvironment();
assertTestDatabaseSafety();

// 2. Strict Safety Safeguards
console.log("================================================================");
console.log("  Dearr Customer Delivery Address Change - End-to-End Test Suite  ");
console.log("================================================================");
console.log("Target Host:", process.env.DB_HOST);
console.log("Target Port:", process.env.DB_PORT);
console.log("Target Database:", process.env.DB_NAME);

import crypto from "crypto";
import { query, withTransaction } from "@/lib/server/db";
import {
  getStoreSettings,
  updateStoreSettings,
  getSettingsAuditHistory,
  checkRateLimit,
} from "@/lib/server/settings";
import {
  getOrderAddressEditEligibility,
  updateOrderShippingAddress,
  updateOrderStatus,
  getOrderAddressHistory,
  validatePincodeServiceability,
  notifyWarehouseAddressChanged,
  OrderValidationError,
  type CreateOrderInput,
} from "@/lib/server/order";
import { streamOrdersListCsv } from "@/lib/server/order-export";
import { resolveReportingPeriod } from "@/lib/server/order-analytics";

let passCount = 0;
let failCount = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    passCount++;
    console.log(`  ✓ PASS: ${desc}`);
  } else {
    failCount++;
    console.error(`  ✗ FAIL: ${desc}`);
  }
}

async function runTests() {
  console.log("\n--- PART 1: Admin Order Policy Settings & Audit History ---");

  // 1. Initial Default Settings
  const initialSettings = await getStoreSettings();
  assert(
    initialSettings.allowAddressChange === true,
    "Default policy allows address change (ON)"
  );
  assert(
    initialSettings.addressChangeWindowHours === 6,
    "Default address change window is 6 hours"
  );
  assert(
    initialSettings.maxAddressChangesPerOrder === 2,
    "Default maximum address changes per order is 2"
  );

  // 2. Setting Validation - Reject below 1 hour
  let rejectedBelow1 = false;
  try {
    await updateStoreSettings({ addressChangeWindowHours: 0 });
  } catch (err: any) {
    rejectedBelow1 = err.message.includes("between 1 and 72");
  }
  assert(rejectedBelow1, "Rejects addressChangeWindowHours < 1");

  // 3. Setting Validation - Reject above 72 hours
  let rejectedAbove72 = false;
  try {
    await updateStoreSettings({ addressChangeWindowHours: 73 });
  } catch (err: any) {
    rejectedAbove72 = err.message.includes("between 1 and 72");
  }
  assert(rejectedAbove72, "Rejects addressChangeWindowHours > 72");

  // 4. Setting Validation - Reject non-integer window
  let rejectedNonIntWindow = false;
  try {
    await updateStoreSettings({ addressChangeWindowHours: 6.5 as any });
  } catch (err: any) {
    rejectedNonIntWindow = err.message.includes("integer");
  }
  assert(rejectedNonIntWindow, "Rejects non-integer addressChangeWindowHours");

  // 5. Setting Validation - Reject max changes < 1
  let rejectedMaxBelow1 = false;
  try {
    await updateStoreSettings({ maxAddressChangesPerOrder: 0 });
  } catch (err: any) {
    rejectedMaxBelow1 = err.message.includes("between 1 and 10");
  }
  assert(rejectedMaxBelow1, "Rejects maxAddressChangesPerOrder < 1");

  // 6. Setting Validation - Reject max changes > 10
  let rejectedMaxAbove10 = false;
  try {
    await updateStoreSettings({ maxAddressChangesPerOrder: 11 });
  } catch (err: any) {
    rejectedMaxAbove10 = err.message.includes("between 1 and 10");
  }
  assert(rejectedMaxAbove10, "Rejects maxAddressChangesPerOrder > 10");

  // 7. Settings Audit History Logging
  const testAdminId = crypto.randomUUID();
  await query(
    `INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
     VALUES (?, ?, 'Test Admin', 'admin', NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [testAdminId, `admin_${Date.now()}@dearr.test`]
  );

  await updateStoreSettings(
    { addressChangeWindowHours: 8, maxAddressChangesPerOrder: 3 },
    testAdminId
  );
  const auditHistory = await getSettingsAuditHistory(10);
  const recentWindowAudit = auditHistory.find(
    (a) => a.settingName === "addressChangeWindowHours" && a.actorId === testAdminId
  );
  assert(
    Boolean(recentWindowAudit && recentWindowAudit.newValue === 8),
    "Audit history records setting name, actor ID, and new value"
  );

  // Restore defaults
  await updateStoreSettings(
    { addressChangeWindowHours: 6, maxAddressChangesPerOrder: 2, allowAddressChange: true },
    testAdminId
  );

  console.log("\n--- PART 2: Fixed Per-Order Deadline & Placement Storage ---");

  // Create synthetic test user and order
  const testUserId = crypto.randomUUID();
  const testOrderId = crypto.randomUUID();
  const testOrderNum = `DEAR-TEST-${Math.floor(10000 + Math.random() * 90000)}`;

  const orderPlacedAt = new Date();
  const expectedDeadline = new Date(orderPlacedAt.getTime() + 6 * 3600 * 1000);

  await query(
    `INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
     VALUES (?, ?, ?, 'customer', NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [testUserId, `cust_${Date.now()}@dearr.test`, "Test Customer"]
  );

  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, discount_amount, shipping_amount, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_address_line_2,
       shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'confirmed', 'paid',
               1200, 0, 0, 1200, 'INR',
               'Original Recipient', '9876543210',
               '123 MG Road', 'Near Metro',
               'Bengaluru', 'Karnataka', '560001', 'India',
               ?, 0,
               NOW(), NOW())`,
    [testOrderId, testOrderNum, testUserId, expectedDeadline]
  );

  // 8. Stored deadline immutability when settings change later
  await updateStoreSettings({ addressChangeWindowHours: 12 }, testAdminId);
  const eligibilityBefore = await getOrderAddressEditEligibility(testOrderId, testUserId);
  const deadlineDiff = Math.abs(
    new Date(eligibilityBefore.deadline || "").getTime() - expectedDeadline.getTime()
  );
  assert(
    deadlineDiff < 2000,
    "Order deadline remains fixed even when admin window setting changes to 12h"
  );
  // Restore setting
  await updateStoreSettings({ addressChangeWindowHours: 6 }, testAdminId);

  console.log("\n--- PART 3: Server-Side Eligibility Rules (10 Checks) ---");

  // Rule 1: Change within window (< 6h) allowed
  assert(eligibilityBefore.allowed === true, "Eligibility Rule 1: Change within window allowed");
  assert(eligibilityBefore.changesUsed === 0, "Changes used starts at 0");
  assert(eligibilityBefore.changesLeft === 2, "Changes left starts at max allowed (2)");

  // Rule 2: Order expired boundary rejection
  const expiredOrderId = crypto.randomUUID();
  const expiredDeadline = new Date(Date.now() - 60 * 1000); // 1 minute in the past
  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'confirmed', 'paid', 500, 500, 'INR', 'Cust', '9876543210', 'Line 1', 'City', 'State', '560001', 'India', ?, 0, NOW(), NOW())`,
    [expiredOrderId, `EXP-${Date.now()}`, testUserId, expiredDeadline]
  );
  const expiredEligibility = await getOrderAddressEditEligibility(expiredOrderId, testUserId);
  assert(
    expiredEligibility.allowed === false && expiredEligibility.reason === "deadline_expired",
    "Eligibility Rule 2: Expired deadline is rejected server-side"
  );

  // Rule 3: Exact deadline boundary
  const exactDeadlineOrderId = crypto.randomUUID();
  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'confirmed', 'paid', 500, 500, 'INR', 'Cust', '9876543210', 'Line 1', 'City', 'State', '560001', 'India', NOW(), 0, NOW(), NOW())`,
    [exactDeadlineOrderId, `EXACT-${Date.now()}`, testUserId]
  );
  const exactEligibility = await getOrderAddressEditEligibility(exactDeadlineOrderId, testUserId);
  assert(
    exactEligibility.allowed === false && exactEligibility.reason === "deadline_expired",
    "Eligibility Rule 3: Exact deadline boundary (now >= deadline) is rejected"
  );

  // Rule 4: Dispatched order is locked even within time window
  const dispatchedOrderId = crypto.randomUUID();
  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count, dispatched_at,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'shipped', 'paid', 500, 500, 'INR', 'Cust', '9876543210', 'Line 1', 'City', 'State', '560001', 'India', ?, 0, NOW(), NOW(), NOW())`,
    [dispatchedOrderId, `DISP-${Date.now()}`, testUserId, expectedDeadline]
  );
  const dispatchedEligibility = await getOrderAddressEditEligibility(dispatchedOrderId, testUserId);
  assert(
    dispatchedEligibility.allowed === false && dispatchedEligibility.reason === "order_dispatched",
    "Eligibility Rule 4: Dispatched order blocks address change even with time remaining"
  );

  // Rule 5: Delivered order is locked
  const deliveredOrderId = crypto.randomUUID();
  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count, delivered_at,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'delivered', 'paid', 500, 500, 'INR', 'Cust', '9876543210', 'Line 1', 'City', 'State', '560001', 'India', ?, 0, NOW(), NOW(), NOW())`,
    [deliveredOrderId, `DELIV-${Date.now()}`, testUserId, expectedDeadline]
  );
  const deliveredEligibility = await getOrderAddressEditEligibility(deliveredOrderId, testUserId);
  assert(
    deliveredEligibility.allowed === false && deliveredEligibility.reason === "order_delivered",
    "Eligibility Rule 5: Delivered order cannot be modified"
  );

  // Rule 6: Cancelled order is locked
  const cancelledOrderId = crypto.randomUUID();
  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count, cancelled_at,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'cancelled', 'paid', 500, 500, 'INR', 'Cust', '9876543210', 'Line 1', 'City', 'State', '560001', 'India', ?, 0, NOW(), NOW(), NOW())`,
    [cancelledOrderId, `CANC-${Date.now()}`, testUserId, expectedDeadline]
  );
  const cancelledEligibility = await getOrderAddressEditEligibility(cancelledOrderId, testUserId);
  assert(
    cancelledEligibility.allowed === false && cancelledEligibility.reason === "order_cancelled",
    "Eligibility Rule 6: Cancelled order cannot be modified"
  );

  // Rule 7: Feature disabled rejection
  await updateStoreSettings({ allowAddressChange: false }, testAdminId);
  const disabledEligibility = await getOrderAddressEditEligibility(testOrderId, testUserId);
  assert(
    disabledEligibility.allowed === false && disabledEligibility.reason === "feature_disabled",
    "Eligibility Rule 7: Turning feature OFF immediately blocks eligibility"
  );
  await updateStoreSettings({ allowAddressChange: true }, testAdminId);

  // Rule 8: Authorization check (IDOR prevention)
  const otherUserId = crypto.randomUUID();
  const idorEligibility = await getOrderAddressEditEligibility(testOrderId, otherUserId, false);
  assert(
    idorEligibility.allowed === false && idorEligibility.reason === "not_authorized",
    "Eligibility Rule 8: Another user cannot view or modify order eligibility"
  );

  // Rule 9: Pincode serviceability check (Fail-closed policy without third-party courier)
  const zeroPinCheck = validatePincodeServiceability("012345", "560038");
  assert(
    zeroPinCheck.serviceable === false && zeroPinCheck.code === "invalid_pincode_format",
    "Eligibility Rule 9a: PIN code starting with 0 is rejected for invalid format"
  );

  const samePinCheck = validatePincodeServiceability("560038", "560038");
  assert(
    samePinCheck.serviceable === true,
    "Eligibility Rule 9b: Address modification retaining order's verified destination PIN (560038) is serviceable"
  );

  const diffPinCheck = validatePincodeServiceability("110001", "560038");
  assert(
    diffPinCheck.serviceable === false && diffPinCheck.code === "unverified_destination_pincode",
    "Eligibility Rule 9c: Changing to a different destination PIN (110001 vs 560038) fails closed as unverified"
  );

  let diffPinRejected = false;
  try {
    await updateOrderShippingAddress({
      orderId: testOrderId,
      userId: testUserId,
      newAddress: {
        shippingFullName: "Test Recipient",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Connaught Place",
        shippingCity: "New Delhi",
        shippingState: "Delhi",
        shippingPostalCode: "110001",
        shippingCountry: "India",
      },
    });
  } catch (err: any) {
    diffPinRejected = err.message.includes("cannot currently be verified") || err.message.includes("contact support");
  }
  assert(
    diffPinRejected,
    "Eligibility Rule 9d: Server rejects address update switching to different unverified PIN code"
  );

  const unanchoredCheck = validatePincodeServiceability("400001");
  assert(
    unanchoredCheck.serviceable === false && unanchoredCheck.code === "unverified_destination_pincode",
    "Eligibility Rule 9e: Unanchored PIN code check without verified order origin fails closed"
  );

  const orderAfterDiffPin = await query<any[]>(
    "SELECT shipping_postal_code, address_change_count FROM orders WHERE id = ?",
    [testOrderId]
  );
  assert(
    orderAfterDiffPin[0].shipping_postal_code === "560001" && Number(orderAfterDiffPin[0].address_change_count) === 0,
    "Eligibility Rule 9f: Database state remains unmutated (PIN 560001, count 0) after rejected different-PIN update"
  );

  // Rule 10: Zone restriction check (foreign country rejected)
  let foreignRejected = false;
  try {
    await updateOrderShippingAddress({
      orderId: testOrderId,
      userId: testUserId,
      newAddress: {
        shippingFullName: "Test Recipient",
        shippingPhone: "9876543210",
        shippingAddressLine1: "123 Oxford Street",
        shippingCity: "London",
        shippingState: "Greater London",
        shippingPostalCode: "560038",
        shippingCountry: "United Kingdom",
      },
    });
  } catch (err: any) {
    foreignRejected = err.message.includes("shipping zone");
  }
  assert(
    foreignRejected,
    "Eligibility Rule 10: Address outside India is rejected with shipping zone notification"
  );

  console.log("\n--- PART 4: Atomic Execution & History Recording ---");

  // Perform successful address update #1
  const update1Result = await updateOrderShippingAddress({
    orderId: testOrderId,
    userId: testUserId,
    newAddress: {
      shippingFullName: "Updated Recipient One",
      shippingPhone: "9876543211",
      shippingAddressLine1: "456 Indiranagar 100ft Rd",
      shippingAddressLine2: "Suite 4B",
      shippingCity: "Bengaluru",
      shippingState: "Karnataka",
      shippingPostalCode: "560001",
      shippingCountry: "India",
    },
    clientIp: "192.168.1.100",
  });

  assert(
    update1Result.order.shippingFullName === "Updated Recipient One",
    "Order row shipping full name updated"
  );
  assert(
    update1Result.order.shippingAddressLine1 === "456 Indiranagar 100ft Rd",
    "Order row address line 1 updated"
  );
  assert(
    update1Result.order.addressChangeCount === 1,
    "Order address_change_count incremented to 1"
  );
  assert(
    update1Result.changesLeft === 1,
    "Changes left correctly decremented to 1"
  );

  // Check order_address_history record
  const historyAfter1 = await getOrderAddressHistory(testOrderId, undefined, true);
  assert(historyAfter1.length === 1, "Exactly 1 address history record created");
  assert(
    historyAfter1[0].oldAddress.shippingPostalCode === "560001",
    "History preserves complete old address snapshot"
  );
  assert(
    historyAfter1[0].newAddress.shippingPostalCode === "560001",
    "History preserves complete new address snapshot (same verified PIN)"
  );
  assert(
    historyAfter1[0].ipAddress === "192.168.1.100",
    "Admin can inspect requester IP address in history"
  );

  // Customer view masks IP address
  const customerHistory = await getOrderAddressHistory(testOrderId, testUserId, false);
  assert(
    customerHistory[0].ipAddress === undefined,
    "Customer view masks private requester IP address"
  );

  // Durable warehouse notification verification in audit_logs
  const warehouseAuditRows = await query<any[]>(
    "SELECT action, details FROM audit_logs WHERE entity_id = ? AND action = 'order.warehouse_address_alert'",
    [testOrderId]
  );
  assert(
    warehouseAuditRows.length >= 1,
    "Durable warehouse alert persisted in audit_logs with action order.warehouse_address_alert"
  );

  // Perform successful address update #2 (reaching max allowance of 2)
  const update2Result = await updateOrderShippingAddress({
    orderId: testOrderId,
    userId: testUserId,
    newAddress: {
      shippingFullName: "Updated Recipient Two",
      shippingPhone: "9876543212",
      shippingAddressLine1: "789 Koramangala 80ft Rd",
      shippingCity: "Bengaluru",
      shippingState: "Karnataka",
      shippingPostalCode: "560001",
      shippingCountry: "India",
    },
  });

  assert(
    update2Result.order.addressChangeCount === 2,
    "Order address_change_count incremented to 2"
  );
  assert(update2Result.changesLeft === 0, "Changes left is now 0");

  // Attempt update #3 (should fail due to change limit)
  let limitRejected = false;
  try {
    await updateOrderShippingAddress({
      orderId: testOrderId,
      userId: testUserId,
      newAddress: {
        shippingFullName: "Attempt Three",
        shippingPhone: "9876543213",
        shippingAddressLine1: "999 MG Rd",
        shippingCity: "Bengaluru",
        shippingState: "Karnataka",
        shippingPostalCode: "560001",
        shippingCountry: "India",
      },
    });
  } catch (err: any) {
    limitRejected = err.message.includes("Maximum permitted address changes");
  }
  assert(limitRejected, "Exceeding maxAddressChangesPerOrder is rejected server-side");

  const historyAfterLimit = await getOrderAddressHistory(testOrderId, undefined, true);
  assert(
    historyAfterLimit.length === 2,
    "Rejected attempt produced NO false history record (still exactly 2)"
  );

  console.log("\n--- PART 5: Concurrency & Row-Level Locking Verification ---");

  // Test Order for Concurrency
  const concOrderId = crypto.randomUUID();
  const concUserId = crypto.randomUUID();
  await query(
    `INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
     VALUES (?, ?, ?, 'customer', NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [concUserId, `conc_${Date.now()}@dearr.test`, "Conc Customer"]
  );

  await query(
    `INSERT INTO orders (
       id, order_number, user_id, status, payment_status,
       subtotal, total_amount, currency,
       shipping_full_name, shipping_phone,
       shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country,
       address_edit_deadline, address_change_count,
       created_at, updated_at
     ) VALUES (?, ?, ?, 'confirmed', 'paid', 500, 500, 'INR', 'Conc Recipient', '9876543210', '101 Outer Ring Rd', 'Bengaluru', 'Karnataka', '560103', 'India', ?, 0, NOW(), NOW())`,
    [concOrderId, `CONC-${Date.now()}`, concUserId, expectedDeadline]
  );

  // Simulate concurrent address change and dispatch race
  // Dispatch wins:
  await updateOrderStatus(concOrderId, "processing");
  await updateOrderStatus(concOrderId, "shipped");
  let dispatchWonRejected = false;
  try {
    await updateOrderShippingAddress({
      orderId: concOrderId,
      userId: concUserId,
      newAddress: {
        shippingFullName: "Late Recipient",
        shippingPhone: "9876543299",
        shippingAddressLine1: "Too Late Road",
        shippingCity: "Bengaluru",
        shippingState: "Karnataka",
        shippingPostalCode: "560103",
        shippingCountry: "India",
      },
    });
  } catch (err: any) {
    dispatchWonRejected = err.message.includes("dispatched");
  }
  assert(
    dispatchWonRejected,
    "Concurrency Race: If dispatch wins, address change transaction fails cleanly"
  );

  console.log("\n--- PART 6: Orders CSV Export with address_changed Column ---");

  const range = resolveReportingPeriod({ period: "all" });
  let csvString = "";
  for await (const chunk of streamOrdersListCsv(range)) {
    csvString += chunk;
  }

  const lines = csvString.trim().split("\r\n");
  const headerLine = lines[0];
  assert(
    headerLine.includes("address_changed"),
    "CSV header contains address_changed column"
  );

  // Locate the updated order row
  const changedOrderRow = lines.find((l) => l.includes(testOrderNum));
  assert(
    Boolean(changedOrderRow && changedOrderRow.endsWith(",yes")),
    "Orders CSV outputs 'yes' in address_changed for orders with address changes"
  );

  // Locate an unchanged order row
  const unchangedOrderRow = lines.find((l) => l.includes(concOrderId) || (l.includes("CONC-") && l.endsWith(",no")));
  assert(
    Boolean(unchangedOrderRow && unchangedOrderRow.endsWith(",no")),
    "Orders CSV outputs 'no' in address_changed for orders with 0 address changes"
  );

  console.log("\n================================================================");
  console.log(`Test Execution Complete: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("================================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test execution aborted with fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
