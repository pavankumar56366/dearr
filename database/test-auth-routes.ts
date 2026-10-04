// In standalone node scripts outside Next.js bundler, mock server-only
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

import fs from "fs";
import path from "path";

// Load .env.local manually for standalone script execution
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

async function runRouteTests() {
  console.log("===============================================================");
  console.log("Dearr V1 — Auth API Routes Verification (/api/auth/*)");
  console.log("===============================================================\n");

  const { POST: signupHandler } = await import("../src/app/api/auth/signup/route");
  const { POST: loginHandler } = await import("../src/app/api/auth/login/route");
  const { getDbPool } = await import("../src/lib/server");

  const testEmail = `route_test_${Date.now()}@dearr.test`;
  const testPassword = "RoutePassword123!";
  const testName = "Route Test Customer";
  let createdUserId: string | null = null;

  try {
    // 1. Validation test: missing name
    console.log("1. Testing Signup Validation (Missing Name)...");
    const resNoName = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      })
    );
    if (resNoName.status !== 400) {
      throw new Error(`Expected 400 for missing name, got ${resNoName.status}`);
    }
    const dataNoName = await resNoName.json();
    console.log(`   ✓ Correctly rejected with status 400: "${dataNoName.error}"`);

    // 2. Validation test: short password
    console.log("2. Testing Signup Validation (Short Password)...");
    const resShortPass = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName,
          email: testEmail,
          password: "short",
        }),
      })
    );
    if (resShortPass.status !== 400) {
      throw new Error(`Expected 400 for short password, got ${resShortPass.status}`);
    }
    const dataShortPass = await resShortPass.json();
    console.log(`   ✓ Correctly rejected with status 400: "${dataShortPass.error}"`);

    // 3. Successful signup
    console.log("3. Testing Successful Signup POST /api/auth/signup...");
    const resSignup = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName,
          email: testEmail,
          password: testPassword,
          phone: "+919876543210",
        }),
      })
    );
    if (resSignup.status !== 201) {
      const err = await resSignup.json();
      throw new Error(`Signup failed with status ${resSignup.status}: ${JSON.stringify(err)}`);
    }
    const dataSignup = await resSignup.json();
    if (!dataSignup.ok || !dataSignup.user?.id) {
      throw new Error("Signup response did not return ok: true and user object");
    }
    createdUserId = dataSignup.user.id;
    if (dataSignup.user.passwordHash || dataSignup.user.password_hash) {
      throw new Error("SECURITY VIOLATION: password_hash leaked in signup API response!");
    }
    console.log(`   ✓ Signup returned 201 Created with user ID: ${createdUserId}`);

    // 4. Duplicate email conflict test
    console.log("4. Testing Duplicate Email Conflict (409)...");
    const resDup = await signupHandler(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Another Name",
          email: testEmail,
          password: "AnotherPassword123!",
        }),
      })
    );
    if (resDup.status !== 409) {
      throw new Error(`Expected 409 for duplicate email, got ${resDup.status}`);
    }
    const dataDup = await resDup.json();
    console.log(`   ✓ Correctly returned 409 Conflict: "${dataDup.error}"`);

    // 5. Login test: wrong password
    console.log("5. Testing Login with Invalid Password (401)...");
    const resWrongPass = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "IncorrectPassword!",
        }),
      })
    );
    if (resWrongPass.status !== 401) {
      throw new Error(`Expected 401 for wrong password, got ${resWrongPass.status}`);
    }
    const dataWrongPass = await resWrongPass.json();
    console.log(`   ✓ Correctly returned 401 Unauthorized: "${dataWrongPass.error}"`);

    // 6. Login test: successful login
    console.log("6. Testing Successful Login POST /api/auth/login...");
    const resLogin = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })
    );
    if (resLogin.status !== 200) {
      const err = await resLogin.json();
      throw new Error(`Login failed with status ${resLogin.status}: ${JSON.stringify(err)}`);
    }
    const dataLogin = await resLogin.json();
    if (!dataLogin.ok || dataLogin.user?.id !== createdUserId) {
      throw new Error("Login failed to match created user ID");
    }
    if (dataLogin.user.passwordHash || dataLogin.user.password_hash) {
      throw new Error("SECURITY VIOLATION: password_hash leaked in login API response!");
    }
    console.log(`   ✓ Login returned 200 OK for user: ${dataLogin.user.email}`);

    console.log("\n===============================================================");
    console.log("ALL AUTH API ROUTE TESTS PASSED SUCCESSFULLY!");
    console.log("===============================================================");
  } finally {
    if (createdUserId) {
      console.log(`Cleaning up test user ${createdUserId}...`);
      const pool = getDbPool();
      await pool.execute("DELETE FROM profiles WHERE id = ?", [createdUserId]);
      console.log("✓ Test user cleaned up.");
    }
  }
}

runRouteTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  });
