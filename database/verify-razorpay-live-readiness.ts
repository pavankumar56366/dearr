import fs from "fs";
import path from "path";
import crypto from "crypto";

// In standalone node scripts outside Next.js bundler, mock server-only
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

// Load .env.local manually for standalone test runner
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, "utf-8").split("\n");
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

async function runLiveReadinessAudit() {
  console.log("=================================================================");
  console.log("Dearr V1 — Razorpay LIVE MODE Payment Readiness & Integration Audit");
  console.log("Environment: Local & Hostinger Production Gateway Architecture");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`   [✓ PASS] ${title}${details ? ` — ${details}` : ""}`);
      passed++;
    } else {
      console.error(`   [✗ FAIL] ${title}${details ? ` — ${details}` : ""}`);
      failed++;
    }
  }

  // --- Section 1: Environment & Credential Structure ---
  console.log("--- Section 1: Environment & Credential Structure ---");
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const publicKeyId = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
  const publicSecretLeak = process.env.NEXT_PUBLIC_RAZORPAY_KEY_SECRET;

  assert(
    "RAZORPAY_KEY_ID is configured and non-empty",
    keyId.length > 0,
    `Prefix: ${keyId.slice(0, 9)}... (length: ${keyId.length})`
  );

  const isTestKey = keyId.startsWith("rzp_test_");
  const isLiveKey = keyId.startsWith("rzp_live_");

  assert(
    "RAZORPAY_KEY_ID follows recognized Razorpay key structure (rzp_test_ or rzp_live_)",
    isTestKey || isLiveKey,
    `Detected Mode: ${isLiveKey ? "LIVE MODE (rzp_live_)" : isTestKey ? "TEST MODE (rzp_test_)" : "INVALID"}`
  );

  assert(
    "RAZORPAY_KEY_SECRET is configured and non-empty",
    keySecret.length > 0,
    `Configured: true (value masked: [REDACTED], length: ${keySecret.length})`
  );

  assert(
    "NEXT_PUBLIC_RAZORPAY_KEY_ID matches server RAZORPAY_KEY_ID",
    publicKeyId === keyId,
    `Client key matches server key: ${publicKeyId === keyId}`
  );

  assert(
    "RAZORPAY_KEY_SECRET is strictly server-only (zero NEXT_PUBLIC leak)",
    publicSecretLeak === undefined || publicSecretLeak === "",
    "Public secret leak: NONE"
  );

  // --- Section 2: Git & Credential Protection ---
  console.log("\n--- Section 2: Git & Credential Protection ---");
  const gitignorePath = path.resolve(process.cwd(), ".gitignore");
  const gitignoreContent = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : "";

  assert(
    ".gitignore protects .env.local and local env files",
    gitignoreContent.includes(".env.local") && gitignoreContent.includes(".env*.local"),
    "Ignored: .env.local, .env*.local"
  );

  assert(
    ".gitignore protects CSV credential files (*.csv, *key*.csv)",
    gitignoreContent.includes("*.csv") && gitignoreContent.includes("*key*.csv"),
    "Ignored: *.csv, *key*.csv"
  );

  const envExamplePath = path.resolve(process.cwd(), ".env.example");
  const envExampleContent = fs.existsSync(envExamplePath)
    ? fs.readFileSync(envExamplePath, "utf-8")
    : "";

  assert(
    ".env.example contains placeholders only (zero real keys or secrets)",
    !envExampleContent.includes(keyId) &&
      !envExampleContent.includes(keySecret) &&
      envExampleContent.includes("RAZORPAY_KEY_ID=") &&
      envExampleContent.includes("RAZORPAY_KEY_SECRET="),
    "Placeholders only: verified"
  );

  // --- Section 3: Server Architecture & Helpers ---
  console.log("\n--- Section 3: Server Architecture & Helpers ---");
  const {
    getRazorpayConfig,
    getRazorpayClient,
    isRazorpayConfigured,
    isRazorpayTestMode,
    isRazorpayLiveMode,
    verifyRazorpaySignature,
  } = await import("../src/lib/server/razorpay");

  assert(
    "isRazorpayConfigured() returns true",
    isRazorpayConfigured() === true,
    `Result: ${isRazorpayConfigured()}`
  );

  const safeConfig = getRazorpayConfig();
  assert(
    "getRazorpayConfig() returns safe configuration without secret exposure",
    safeConfig.isConfigured === true &&
      (safeConfig.mode === "test" || safeConfig.mode === "live") &&
      !("keySecret" in safeConfig) &&
      !("secret" in safeConfig),
    `Mode: ${safeConfig.mode}, isConfigured: ${safeConfig.isConfigured}`
  );

  assert(
    "isRazorpayLiveMode() helper correctly identifies live vs test keys",
    isRazorpayLiveMode() === isLiveKey && isRazorpayTestMode() === isTestKey,
    `Live Mode: ${isRazorpayLiveMode()}, Test Mode: ${isRazorpayTestMode()}`
  );

  let client: any = null;
  let clientInitSuccess = false;
  try {
    client = getRazorpayClient();
    clientInitSuccess =
      client !== null &&
      typeof client === "object" &&
      typeof client.orders === "object" &&
      typeof client.payments === "object";
  } catch (err) {
    clientInitSuccess = false;
  }

  assert(
    "Razorpay official SDK initializes correctly with current credentials",
    clientInitSuccess,
    `Client initialized: ${clientInitSuccess}`
  );

  // --- Section 4: Safe Read-Only Gateway Verification (Zero Money/Orders Charged) ---
  console.log("\n--- Section 4: Safe Read-Only Gateway Verification ---");
  let apiAuthPassed = false;
  let apiError: string | null = null;

  try {
    // Read-only query fetching existing orders with limit 1
    // Strictly read-only: does NOT create orders or charge money
    const result = await client.orders.all({ count: 1 });
    apiAuthPassed =
      result !== null && typeof result === "object" && Array.isArray(result.items);
  } catch (err: any) {
    apiAuthPassed = false;
    apiError = err?.message || String(err);
  }

  assert(
    "Razorpay API credentials authenticated successfully with Gateway API (Read-Only)",
    apiAuthPassed,
    apiAuthPassed
      ? "HTTP 200 OK — Credentials authenticated with Razorpay servers"
      : `API Check failed: ${apiError}`
  );

  // --- Section 5: Cryptographic HMAC Signature Verification ---
  console.log("\n--- Section 5: Cryptographic HMAC Signature Verification ---");
  const testOrderId = "order_live_ready_001";
  const testPaymentId = "pay_live_ready_002";
  const validSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest("hex");

  assert(
    "verifyRazorpaySignature accepts valid HMAC-SHA256 signature",
    verifyRazorpaySignature(testOrderId, testPaymentId, validSignature) === true,
    "Valid signature accepted"
  );

  assert(
    "verifyRazorpaySignature rejects tampered signature",
    verifyRazorpaySignature(testOrderId, testPaymentId, validSignature.replace("a", "b")) === false,
    "Tampered signature rejected"
  );

  assert(
    "verifyRazorpaySignature rejects wrong order ID",
    verifyRazorpaySignature("order_wrong", testPaymentId, validSignature) === false,
    "Wrong order ID rejected"
  );

  assert(
    "verifyRazorpaySignature rejects wrong payment ID",
    verifyRazorpaySignature(testOrderId, "pay_wrong", validSignature) === false,
    "Wrong payment ID rejected"
  );

  assert(
    "verifyRazorpaySignature safely handles malformed / non-hex signature",
    verifyRazorpaySignature(testOrderId, testPaymentId, "invalid_sig") === false,
    "Malformed signature handled safely"
  );

  // --- Section 6: Checkout UI & Trust Banner Audit ---
  console.log("\n--- Section 6: Checkout UI & Trust Banner Audit ---");
  const paymentMethodComponentPath = path.resolve(
    process.cwd(),
    "src/components/customer/checkout/PaymentMethod.tsx"
  );
  const paymentMethodContent = fs.existsSync(paymentMethodComponentPath)
    ? fs.readFileSync(paymentMethodComponentPath, "utf-8")
    : "";

  assert(
    "No prototype/Phase 5 disclaimer banners in PaymentMethod component",
    !paymentMethodContent.includes("V1 Architecture Note: Real Razorpay API keys") &&
      !paymentMethodContent.includes("Phase 5"),
    "Prototype disclaimers removed: verified"
  );

  assert(
    "PaymentMethod displays production bank-grade SSL security assurance",
    paymentMethodContent.includes("Bank-Grade 256-bit SSL Security") &&
      paymentMethodContent.includes("PCI-DSS certified"),
    "Production security assurance present: verified"
  );

  const checkoutClientPath = path.resolve(
    process.cwd(),
    "src/components/customer/checkout/CheckoutPageClient.tsx"
  );
  const checkoutClientContent = fs.existsSync(checkoutClientPath)
    ? fs.readFileSync(checkoutClientPath, "utf-8")
    : "";

  assert(
    "Checkout modal options configure Dearr branding and server key dynamically",
    checkoutClientContent.includes("key: payData.keyId") &&
      checkoutClientContent.includes("order_id: payData.razorpayOrderId") &&
      checkoutClientContent.includes("handler: async function (paymentResp: any)"),
    "Dynamic key & order binding verified"
  );

  // --- Section 7: Source Code Secret Audit ---
  console.log("\n--- Section 7: Source Code Secret Audit ---");
  const auditedFiles = [
    "src/lib/server/razorpay.ts",
    "src/lib/server/payment.ts",
    "src/lib/server/order.ts",
    "src/app/api/payments/create/route.ts",
    "src/app/api/payments/verify/route.ts",
    "src/app/api/payments/settle/route.ts",
    "src/app/api/payments/fail/route.ts",
    "src/app/api/payments/cancel/route.ts",
    "src/app/api/payments/reconcile/route.ts",
    "src/components/customer/checkout/CheckoutPageClient.tsx",
    "src/components/customer/checkout/PaymentMethod.tsx",
  ];

  let hardcodedSecretFound = false;
  for (const relFile of auditedFiles) {
    const fullPath = path.resolve(process.cwd(), relFile);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, "utf-8");
      if (keySecret && code.includes(keySecret)) {
        hardcodedSecretFound = true;
      }
    }
  }

  assert(
    "Source code strictly does not contain hardcoded Key Secret",
    !hardcodedSecretFound,
    "Zero hardcoded secrets found in codebase"
  );

  console.log("\n=================================================================");
  console.log("RAZORPAY LIVE READINESS AUDIT SUMMARY");
  console.log("=================================================================");
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log(`CURRENT GATEWAY MODE: ${safeConfig.mode.toUpperCase()}`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveReadinessAudit().catch((err) => {
  console.error("Audit encountered an error:", err);
  process.exit(1);
});
