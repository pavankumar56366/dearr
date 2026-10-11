/**
 * Comprehensive Verification & Regression Test Suite for Customer Order Tracking
 *
 * Implements the complete automated status test matrix (Tests A - L):
 * - Test A: Prepaid order with pending payment
 * - Test B: Prepaid order with verified successful payment
 * - Test C: Prepaid order with failed payment
 * - Test D: Cash on Delivery before delivery
 * - Test E: Cash on Delivery after delivery (delivered alone != collected)
 * - Test F: Order is pending or confirmed
 * - Test G: Order is processing
 * - Test H: Order is shipped
 * - Test I: Order is delivered
 * - Test J: Cancelled order
 * - Test K: Legacy or unknown order state
 * - Test L: Timeline structural consistency and code audits
 */

import fs from "fs";
import path from "path";
import assert from "assert";

const ROOT = process.cwd();

console.log("================================================================================");
console.log("DEARR 4-STAGE CUSTOMER ORDER TRACKING AUTOMATED TEST MATRIX");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}:`, err.message);
    throw err;
  }
}

// Dynamically import order-tracking module
const {
  getOrderTrackingStages,
  isCodPaymentMethod,
  isPaidPaymentStatus,
  isFailedPaymentStatus,
} = await import("../src/lib/order-tracking.ts");

const CANONICAL_LABELS = [
  "Order Received",
  "Payment",
  "Packed & Dispatched",
  "Delivered",
];

// --- TEST A: PREPAID ORDER WITH PENDING PAYMENT ---
console.log("--- TEST A: PREPAID ORDER WITH PENDING PAYMENT ---");

runTest("Test A: Order received with prepaid payment pending", () => {
  const stages = getOrderTrackingStages({
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "Razorpay (Prepaid Online)",
  });

  const [orderReceived, payment, packedDispatched, delivered] = stages;

  assert.strictEqual(orderReceived.status, "completed", "Order Received should be completed");
  assert.strictEqual(payment.status, "current", "Payment should be current/active");
  assert.strictEqual(payment.badge, "Pending", "Payment badge should indicate Pending");
  assert(payment.description.toLowerCase().includes("pending"), `Payment description should indicate pending: ${payment.description}`);
  assert.notStrictEqual(payment.status, "completed", "Payment MUST NOT be marked completed when pending");

  assert.strictEqual(packedDispatched.status, "upcoming", "Packed & Dispatched should be upcoming");
  assert.strictEqual(delivered.status, "upcoming", "Delivered should be upcoming");
  assert.notStrictEqual(delivered.status, "completed", "Delivered MUST NOT be completed");
});

// --- TEST B: PREPAID ORDER WITH VERIFIED SUCCESSFUL PAYMENT ---
console.log("\n--- TEST B: PREPAID ORDER WITH VERIFIED SUCCESSFUL PAYMENT ---");

runTest("Test B: Prepaid order with verified successful payment", () => {
  const stages = getOrderTrackingStages({
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "Razorpay (Cards/UPI)",
  });

  const [orderReceived, payment, packedDispatched, delivered] = stages;

  assert.strictEqual(orderReceived.status, "completed", "Order Received should be completed");
  assert.strictEqual(payment.status, "completed", "Payment should be completed for verified paid prepaid order");
  assert(payment.description.toLowerCase().includes("confirmed"), `Payment description should reflect confirmation: ${payment.description}`);
  assert.strictEqual(packedDispatched.status, "upcoming", "Packed & Dispatched should be upcoming for confirmed order");
  assert.strictEqual(delivered.status, "upcoming", "Delivered should be upcoming");
});

runTest("Test B2: Simulated demo payment is also treated as verified payment", () => {
  const stages = getOrderTrackingStages({
    status: "confirmed",
    paymentStatus: "simulated",
    paymentMethod: "Razorpay",
  });

  assert.strictEqual(stages[1].status, "completed", "Simulated payment should be marked completed");
});

// --- TEST C: PREPAID ORDER WITH FAILED PAYMENT ---
console.log("\n--- TEST C: PREPAID ORDER WITH FAILED PAYMENT ---");

runTest("Test C: Prepaid order with failed payment", () => {
  const stages = getOrderTrackingStages({
    status: "pending",
    paymentStatus: "failed",
    paymentMethod: "Razorpay",
  });

  const [orderReceived, payment, packedDispatched, delivered] = stages;

  assert.strictEqual(orderReceived.status, "completed", "Order Received should be completed");
  assert.strictEqual(payment.status, "failed", "Payment status should be failed");
  assert.strictEqual(payment.badge, "Failed", "Payment badge should be Failed");
  assert(payment.description.toLowerCase().includes("failed"), `Payment description should mention failed: ${payment.description}`);
  assert.notStrictEqual(payment.status, "completed", "Failed payment MUST NEVER be marked completed");
  assert.strictEqual(packedDispatched.status, "upcoming", "Packed & Dispatched should be upcoming");
  assert.strictEqual(delivered.status, "upcoming", "Delivered should be upcoming");
});

// --- TEST D: CASH ON DELIVERY BEFORE DELIVERY ---
console.log("\n--- TEST D: CASH ON DELIVERY BEFORE DELIVERY ---");

runTest("Test D: COD order before delivery displays Due on Delivery and does not block dispatch", () => {
  const stages = getOrderTrackingStages({
    status: "processing",
    paymentStatus: "pending",
    paymentMethod: "Cash on Delivery",
  });

  const [orderReceived, payment, packedDispatched, delivered] = stages;

  assert.strictEqual(orderReceived.status, "completed", "Order Received should be completed");
  assert.notStrictEqual(payment.status, "completed", "COD payment MUST NOT be marked completed before collection");
  assert.strictEqual(payment.badge, "Due on Delivery", "Payment badge should state 'Due on Delivery'");
  assert(payment.description.toLowerCase().includes("due on delivery"), `Payment description should state due on delivery: ${payment.description}`);
  assert.strictEqual(packedDispatched.status, "current", "Packed & Dispatched should be active/current during processing");
  assert.strictEqual(packedDispatched.badge, "Active", "Packed & Dispatched badge should be Active");
  assert.strictEqual(delivered.status, "upcoming", "Delivered should be upcoming");
});

// --- TEST E: CASH ON DELIVERY AFTER DELIVERY ---
console.log("\n--- TEST E: CASH ON DELIVERY AFTER DELIVERY ---");

runTest("Test E1: COD delivered with unconfirmed collection does NOT falsely claim payment collected", () => {
  const stages = getOrderTrackingStages({
    status: "delivered",
    paymentStatus: "pending",
    paymentMethod: "Cash on Delivery",
  });

  const [orderReceived, payment, packedDispatched, delivered] = stages;

  assert.strictEqual(orderReceived.status, "completed", "Order Received should be completed");
  assert.strictEqual(delivered.status, "completed", "Delivered should be completed when status is delivered");
  assert.notStrictEqual(payment.status, "completed", "Payment MUST NOT be marked completed if collection is unconfirmed");
  assert.strictEqual(payment.badge, "Collection Pending", "Payment badge should state 'Collection Pending'");
  assert(payment.description.toLowerCase().includes("reconciliation") || payment.description.toLowerCase().includes("collection"),
    `Payment description should indicate awaiting collection: ${payment.description}`);
  assert.strictEqual(packedDispatched.status, "completed", "Packed & Dispatched should be completed");
});

runTest("Test E2: COD delivered with confirmed collection in backend IS marked paid", () => {
  const stages = getOrderTrackingStages({
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "Cash on Delivery",
  });

  const [orderReceived, payment, packedDispatched, delivered] = stages;

  assert.strictEqual(orderReceived.status, "completed", "Order Received should be completed");
  assert.strictEqual(payment.status, "completed", "Payment should be completed when confirmed paid in backend");
  assert(payment.description.toLowerCase().includes("collected"), `Payment description should mention collected: ${payment.description}`);
  assert.strictEqual(packedDispatched.status, "completed", "Packed & Dispatched should be completed");
  assert.strictEqual(delivered.status, "completed", "Delivered should be completed");
});

// --- TEST F: ORDER IS PENDING OR CONFIRMED ---
console.log("\n--- TEST F: ORDER IS PENDING OR CONFIRMED ---");

runTest("Test F: Pending and Confirmed orders do not appear dispatched or delivered prematurely", () => {
  const pendingStages = getOrderTrackingStages({ status: "pending", paymentStatus: "pending" });
  assert.strictEqual(pendingStages[0].status, "completed");
  assert.strictEqual(pendingStages[2].status, "upcoming");
  assert.strictEqual(pendingStages[3].status, "upcoming");

  const confirmedStages = getOrderTrackingStages({ status: "confirmed", paymentStatus: "paid" });
  assert.strictEqual(confirmedStages[0].status, "completed");
  assert.strictEqual(confirmedStages[1].status, "completed");
  assert.strictEqual(confirmedStages[2].status, "upcoming");
  assert.strictEqual(confirmedStages[3].status, "upcoming");
});

// --- TEST G: ORDER IS PROCESSING ---
console.log("\n--- TEST G: ORDER IS PROCESSING ---");

runTest("Test G: Processing order makes Packed & Dispatched active", () => {
  const stages = getOrderTrackingStages({
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "Prepaid",
  });

  assert.strictEqual(stages[0].status, "completed");
  assert.strictEqual(stages[1].status, "completed");
  assert.strictEqual(stages[2].status, "current", "Packed & Dispatched should be active");
  assert.strictEqual(stages[2].badge, "Active");
  assert(stages[2].description.toLowerCase().includes("being packed"), `Description should mention being packed: ${stages[2].description}`);
  assert.strictEqual(stages[3].status, "upcoming");
});

// --- TEST H: ORDER IS SHIPPED ---
console.log("\n--- TEST H: ORDER IS SHIPPED ---");

runTest("Test H: Shipped order marks Packed & Dispatched complete and Delivered in transit", () => {
  const stages = getOrderTrackingStages({
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "Prepaid",
  });

  assert.strictEqual(stages[0].status, "completed");
  assert.strictEqual(stages[1].status, "completed");
  assert.strictEqual(stages[2].status, "completed", "Packed & Dispatched must be completed");
  assert(stages[2].description.toLowerCase().includes("handed over"), `Description should mention handover: ${stages[2].description}`);
  assert.strictEqual(stages[3].status, "current", "Delivered should be current");
  assert.strictEqual(stages[3].badge, "In Transit");
  assert.notStrictEqual(stages[3].status, "completed", "Delivered must NOT be completed for shipped order");
});

// --- TEST I: ORDER IS DELIVERED ---
console.log("\n--- TEST I: ORDER IS DELIVERED ---");

runTest("Test I: Delivered order marks Delivered stage completed", () => {
  const stages = getOrderTrackingStages({
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "Prepaid",
  });

  assert.strictEqual(stages[0].status, "completed");
  assert.strictEqual(stages[1].status, "completed");
  assert.strictEqual(stages[2].status, "completed");
  assert.strictEqual(stages[3].status, "completed", "Delivered stage should be completed");
  assert(stages[3].description.toLowerCase().includes("arrived"), `Description should mention arrived: ${stages[3].description}`);
});

// --- TEST J: CANCELLED ORDER ---
console.log("\n--- TEST J: CANCELLED ORDER ---");

runTest("Test J: Cancelled order does not proceed toward delivery", () => {
  const stages = getOrderTrackingStages({
    status: "cancelled",
    paymentStatus: "pending",
    paymentMethod: "Razorpay",
  });

  assert.notStrictEqual(stages[2].status, "completed", "Cancelled order must not have completed dispatch");
  assert.notStrictEqual(stages[3].status, "completed", "Cancelled order must not have completed delivery");
  assert.notStrictEqual(stages[3].status, "current", "Cancelled order must not be active for delivery");
});

// --- TEST K: LEGACY OR UNKNOWN ORDER STATE ---
console.log("\n--- TEST K: LEGACY OR UNKNOWN ORDER STATE ---");

runTest("Test K: Legacy or unexpected status safely defaults without crashing or false completion", () => {
  const stages = getOrderTrackingStages({
    status: "custom_legacy_status_v1",
    paymentStatus: "some_unknown_status",
    paymentMethod: "legacy_method",
  });

  assert.strictEqual(stages.length, 4, "Must always return 4 stages");
  assert.notStrictEqual(stages[3].status, "completed", "Unknown status must never be marked delivered");
  assert.notStrictEqual(stages[2].status, "completed", "Unknown status must never be marked dispatched");
});

// --- TEST L: TIMELINE STRUCTURAL CONSISTENCY ---
console.log("\n--- TEST L: TIMELINE STRUCTURAL CONSISTENCY & AUDITS ---");

runTest("Test L1: Exactly four canonical stages across all permutations", () => {
  const samplePermutations = [
    { status: "pending", paymentStatus: "pending" },
    { status: "confirmed", paymentStatus: "paid" },
    { status: "confirmed", paymentStatus: "pending", paymentMethod: "COD" },
    { status: "processing", paymentStatus: "paid" },
    { status: "shipped", paymentStatus: "paid" },
    { status: "delivered", paymentStatus: "paid" },
    { status: "cancelled", paymentStatus: "paid" },
    { status: "cancelled", paymentStatus: "failed" },
  ];

  for (const p of samplePermutations) {
    const stages = getOrderTrackingStages(p);
    assert.strictEqual(stages.length, 4);
    assert.deepStrictEqual(stages.map((s) => s.label), CANONICAL_LABELS);
  }
});

runTest("Test L2: Component source audits confirm 4 stages and zero obsolete steps", () => {
  const orderDetailCode = fs.readFileSync(path.join(ROOT, "src/components/customer/account/OrderDetail.tsx"), "utf8");
  const timelineCode = fs.readFileSync(path.join(ROOT, "src/components/customer/order/OrderStatusTimeline.tsx"), "utf8");

  assert(!orderDetailCode.includes("3D Print Preparation"));
  assert(!orderDetailCode.includes("Quality Inspection"));
  assert(!orderDetailCode.includes("Payment Verified"));
  assert(orderDetailCode.includes("Order Tracking Timeline"));

  assert(!timelineCode.includes("3D Print Preparation"));
  assert(!timelineCode.includes("Quality Inspection"));
  assert(!timelineCode.includes("Payment Verified"));
  assert(timelineCode.includes("Order Tracking Timeline"));
});

console.log("\n================================================================================");
console.log(`AUTOMATED STATUS TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log("================================================================================\n");
