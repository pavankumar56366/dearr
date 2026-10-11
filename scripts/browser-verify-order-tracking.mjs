/**
 * Automated Browser Testing Suite for Dearr 4-Stage Customer Order Tracking
 *
 * Uses Playwright (Chromium/msedge) against the local running application:
 * - Tests both Order Details page (/account/orders/[orderNumber])
 *   and Order Confirmation page (/order-confirmed?orderNumber=[orderNumber])
 * - Exercises all 9 controlled test scenarios:
 *   1. Prepaid pending payment
 *   2. Prepaid successful payment
 *   3. Prepaid failed payment
 *   4. COD before delivery
 *   5. COD after delivery (unconfirmed collection)
 *   6. COD after delivery (confirmed collection)
 *   7. Processing order
 *   8. Shipped order
 *   9. Delivered order
 *   10. Cancelled order
 * - Tests both Desktop (1280x800) and Mobile (375x667) viewports
 * - Verifies rendered DOM, 4 canonical labels, absence of obsolete steps,
 *   indicators, badges, descriptions, and console error cleanliness
 * - Captures screenshots
 */

import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import assert from "assert";

const ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT, "test-results", "browser-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const BASE_URL = "http://localhost:3000";

const SCENARIOS = [
  {
    id: "prepaid_pending",
    name: "Scenario 1: Prepaid Pending Payment",
    orderNumber: "DEAR-TEST-PREPAID-PENDING",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "Razorpay (Prepaid Online)",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPaymentBadge: "Pending",
    expectedPaymentDescSubstring: "pending",
  },
  {
    id: "prepaid_paid",
    name: "Scenario 2: Prepaid Successful Payment",
    orderNumber: "DEAR-TEST-PREPAID-PAID",
    status: "confirmed",
    paymentStatus: "paid",
    paymentMethod: "Razorpay (Cards/UPI)",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPaymentDescSubstring: "confirmed",
  },
  {
    id: "prepaid_failed",
    name: "Scenario 3: Prepaid Failed Payment",
    orderNumber: "DEAR-TEST-PREPAID-FAILED",
    status: "pending",
    paymentStatus: "failed",
    paymentMethod: "Razorpay",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPaymentBadge: "Failed",
    expectedPaymentDescSubstring: "failed",
  },
  {
    id: "cod_before_delivery",
    name: "Scenario 4: COD Before Delivery (Dispatch Not Blocked)",
    orderNumber: "DEAR-TEST-COD-PROCESSING",
    status: "processing",
    paymentStatus: "pending",
    paymentMethod: "Cash on Delivery",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPaymentBadge: "Due on Delivery",
    expectedPaymentDescSubstring: "due on delivery",
  },
  {
    id: "cod_delivered_unconfirmed",
    name: "Scenario 5: COD Delivered with Unconfirmed Collection",
    orderNumber: "DEAR-TEST-COD-DELIVERED-PENDING",
    status: "delivered",
    paymentStatus: "pending",
    paymentMethod: "Cash on Delivery",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPaymentBadge: "Collection Pending",
  },
  {
    id: "cod_delivered_collected",
    name: "Scenario 6: COD Delivered with Confirmed Collection",
    orderNumber: "DEAR-TEST-COD-DELIVERED-PAID",
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "Cash on Delivery",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPaymentDescSubstring: "collected",
  },
  {
    id: "processing_order",
    name: "Scenario 7: Processing Order (Packing Active)",
    orderNumber: "DEAR-TEST-PROCESSING",
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "Razorpay",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedPackedBadge: "Active",
  },
  {
    id: "shipped_order",
    name: "Scenario 8: Shipped Order (In Transit Active)",
    orderNumber: "DEAR-TEST-SHIPPED",
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "Razorpay",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
    expectedDeliveredBadge: "In Transit",
  },
  {
    id: "delivered_order",
    name: "Scenario 9: Delivered Order (Delivery Completed)",
    orderNumber: "DEAR-TEST-DELIVERED",
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "Razorpay",
    expectedLabels: ["Order Received", "Payment", "Packed & Dispatched", "Delivered"],
  },
  {
    id: "cancelled_order",
    name: "Scenario 10: Cancelled Order",
    orderNumber: "DEAR-TEST-CANCELLED",
    status: "cancelled",
    paymentStatus: "pending",
    paymentMethod: "Razorpay",
    isCancelled: true,
  },
];

async function runBrowserTests() {
  console.log("================================================================================");
  console.log("DEARR AUTOMATED PLAYWRIGHT BROWSER VERIFICATION SUITE");
  console.log("================================================================================\n");

  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch (err) {
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch (err2) {
      throw new Error(`Failed to launch browser: ${err.message}; ${err2.message}`);
    }
  }

  console.log("  [INFO] Headless browser launched successfully.\n");

  let passedScenarios = 0;
  let totalScenarios = 0;

  for (const scenario of SCENARIOS) {
    totalScenarios++;
    console.log(`--- RUNNING ${scenario.name} ---`);

    for (const viewport of [
      { name: "desktop", width: 1280, height: 800 },
      { name: "mobile", width: 375, height: 667 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        userAgent:
          viewport.name === "mobile"
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
            : undefined,
      });

      const page = await context.newPage();
      const jsRuntimeErrors = [];
      page.on("pageerror", (err) => {
        jsRuntimeErrors.push(err.message || String(err));
      });

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (!text.includes("Failed to load resource") && !text.includes("404") && !text.includes("favicon")) {
            jsRuntimeErrors.push(text);
          }
        }
      });

      // 1. Mock Auth state & background header endpoints
      await page.route("**/api/auth/me", (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            user: {
              id: "usr_mock_test_1",
              email: "customer@dearr.in",
              fullName: "Pavan Kumar",
              role: "customer",
            },
          }),
        });
      });
      await page.route("**/api/cart**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: [] }) }));
      await page.route("**/api/wishlist**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: [] }) }));
      await page.route("**/api/products**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [] }) }));
      await page.route("**/api/categories**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, categories: [] }) }));

      // 2. Mock Order API endpoint
      const mockOrder = {
        id: `ord_${scenario.id}`,
        orderNumber: scenario.orderNumber,
        status: scenario.status,
        paymentStatus: scenario.paymentStatus,
        paymentMethod: scenario.paymentMethod,
        subtotal: 1248,
        shippingAmount: 0,
        discountAmount: 0,
        totalAmount: 1248,
        currency: "INR",
        shippingFullName: "Pavan Kumar",
        shippingPhone: "+91 98765 43210",
        shippingAddressLine1: "42, Creative Lane, Ameerpet",
        shippingCity: "Hyderabad",
        shippingState: "Telangana",
        shippingPostalCode: "500038",
        shippingCountry: "India",
        createdAt: "2026-10-10T14:25:00.000Z",
        items: [
          {
            id: "item_001",
            productId: "sp-01",
            productName: "3D Printed Golden Ganesha Idol",
            unitPrice: 1248,
            quantity: 1,
            lineTotal: 1248,
          },
        ],
      };

      await page.route("**/api/orders/**", (route) => {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, order: mockOrder }),
        });
      });

      // 3. Test Order Details page
      const orderDetailsUrl = `${BASE_URL}/account/orders/${scenario.orderNumber}`;
      await page.goto(orderDetailsUrl, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForSelector("text=Order Tracking Timeline", { timeout: 10000 });

      // Verify DOM content
      const bodyText = await page.innerText("body");

      // Verify absence of obsolete steps
      assert(!bodyText.includes("3D Print Preparation"), "Found obsolete '3D Print Preparation' on Order Details page");
      assert(!bodyText.includes("Quality Inspection"), "Found obsolete 'Quality Inspection' on Order Details page");
      assert(!bodyText.includes("Payment Verified"), "Found obsolete 'Payment Verified' on Order Details page");

      if (scenario.isCancelled) {
        // Must show cancellation notice
        assert(bodyText.includes("Order Cancelled"), "Cancelled order must display 'Order Cancelled' banner");
        assert(bodyText.includes("This order has been cancelled"), "Cancelled order must display cancellation description");
      } else {
        // Must verify 4 stage labels
        for (const label of scenario.expectedLabels) {
          assert(bodyText.includes(label), `Missing expected label '${label}' on Order Details page (${viewport.name})`);
        }

        if (scenario.expectedPaymentBadge) {
          assert(bodyText.toLowerCase().includes(scenario.expectedPaymentBadge.toLowerCase()),
            `Missing expected Payment badge '${scenario.expectedPaymentBadge}' (${viewport.name})`);
        }

        if (scenario.expectedPaymentDescSubstring) {
          assert(bodyText.toLowerCase().includes(scenario.expectedPaymentDescSubstring.toLowerCase()),
            `Missing expected payment description containing '${scenario.expectedPaymentDescSubstring}' (${viewport.name})`);
        }

        if (scenario.expectedPackedBadge) {
          assert(bodyText.toLowerCase().includes(scenario.expectedPackedBadge.toLowerCase()),
            `Missing expected Packed badge '${scenario.expectedPackedBadge}' (${viewport.name})`);
        }

        if (scenario.expectedDeliveredBadge) {
          assert(bodyText.toLowerCase().includes(scenario.expectedDeliveredBadge.toLowerCase()),
            `Missing expected Delivered badge '${scenario.expectedDeliveredBadge}' (${viewport.name})`);
        }
      }

      // Capture screenshot
      const ssPath = path.join(SCREENSHOT_DIR, `${scenario.id}_${viewport.name}_order_detail.png`);
      await page.screenshot({ path: ssPath, fullPage: false });

      // 4. Test Order Confirmation timeline
      const confirmUrl = `${BASE_URL}/order-confirmed?orderNumber=${scenario.orderNumber}`;
      await page.goto(confirmUrl, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForSelector("text=Order Tracking Timeline", { timeout: 10000 });

      const confirmBody = await page.innerText("body");

      assert(!confirmBody.includes("3D Print Preparation"), "Found obsolete '3D Print Preparation' on Confirmation page");
      assert(!confirmBody.includes("Quality Inspection"), "Found obsolete 'Quality Inspection' on Confirmation page");

      if (scenario.isCancelled) {
        assert(confirmBody.includes("Order Cancelled"), "Cancelled order must display 'Order Cancelled' on confirmation page");
      } else {
        for (const label of scenario.expectedLabels) {
          assert(confirmBody.includes(label), `Missing expected label '${label}' on Confirmation page (${viewport.name})`);
        }
      }

      const ssConfirmPath = path.join(SCREENSHOT_DIR, `${scenario.id}_${viewport.name}_confirm.png`);
      await page.screenshot({ path: ssConfirmPath, fullPage: false });

      assert.strictEqual(jsRuntimeErrors.length, 0, `Encountered runtime errors in ${scenario.name} (${viewport.name}): ${jsRuntimeErrors.join("; ")}`);

      await context.close();
    }

    console.log(`  [PASS] ${scenario.name} verified on Desktop & Mobile`);
    passedScenarios++;
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log(`BROWSER VERIFICATION RESULTS: ${passedScenarios} / ${totalScenarios} SCENARIOS PASSED (100%)`);
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log("================================================================================\n");
}

runBrowserTests().catch((err) => {
  console.error("\n[BROWSER TEST ERROR]:", err);
  process.exit(1);
});
