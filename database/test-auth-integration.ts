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

async function runAuthIntegrationTests() {
  console.log("===============================================================");
  console.log("Dearr V1 — Task B-04/B-05: Server Auth & Profile Access Verification");
  console.log("===============================================================\n");

  const {
    hashPassword,
    comparePassword,
    createSessionToken,
    verifySessionToken,
    getDbPool,
    findProfileByEmail,
    findProfileWithPasswordByEmail,
    findProfileById,
    createProfile,
    updateProfile,
  } = await import("../src/lib/server");

  const testEmail = `test_customer_${Date.now()}@dearr.test`;
  const testPassword = "SuperSecurePassword123!";
  const testName = "Test Verification Customer";
  const testPhone = "+919876543210";

  let createdUserId: string | null = null;

  try {
    // 1. Password Hashing & Safe Verification
    console.log("1. Testing Password Hashing & Bcrypt Verification...");
    const hash = await hashPassword(testPassword);
    if (!hash || !hash.startsWith("$2")) {
      throw new Error(`Invalid bcrypt hash generated: ${hash}`);
    }
    const isMatch = await comparePassword(testPassword, hash);
    if (!isMatch) {
      throw new Error("Password verification failed for matching password");
    }
    const isMismatch = await comparePassword("WrongPassword123!", hash);
    if (isMismatch) {
      throw new Error("Password verification returned true for mismatched password");
    }
    console.log("   ✓ Bcrypt hashing and safe comparison passed.");

    // 2. JWT Session Token Signing & Verification (jose)
    console.log("2. Testing JWT Session Token (jose HS256)...");
    const samplePayload = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "jwt-test@dearr.in",
      fullName: "JWT Test User",
      role: "customer" as const,
    };
    const token = await createSessionToken(samplePayload, "1h");
    if (!token || typeof token !== "string") {
      throw new Error("Failed to create signed JWT token");
    }
    const verified = await verifySessionToken(token);
    if (!verified || verified.sub !== samplePayload.id || verified.email !== samplePayload.email) {
      throw new Error("JWT token verification failed or payload mismatch");
    }
    const tampered = await verifySessionToken(token + "tampered");
    if (tampered !== null) {
      throw new Error("Tampered JWT token did not fail safely");
    }
    console.log("   ✓ JWT token creation, signature verification, and tamper rejection passed.");

    // 3. MySQL Profile Repository: Create Profile
    console.log("3. Testing Profile Creation in Hostinger MySQL...");
    const createdProfile = await createProfile({
      email: testEmail,
      fullName: testName,
      passwordHash: hash,
      phone: testPhone,
      role: "customer",
    });

    createdUserId = createdProfile.id;
    console.log(`   ✓ Profile created successfully with UUID: ${createdUserId}`);

    if ((createdProfile as any).passwordHash || (createdProfile as any).password_hash) {
      throw new Error("CRITICAL SECURITY VIOLATION: password_hash was exposed in UserProfile!");
    }
    if (createdProfile.email !== testEmail.toLowerCase()) {
      throw new Error(`Email mismatch: expected ${testEmail.toLowerCase()}, got ${createdProfile.email}`);
    }
    if (createdProfile.fullName !== testName) {
      throw new Error(`Full name mismatch: expected ${testName}, got ${createdProfile.fullName}`);
    }

    // 4. MySQL Profile Repository: Find by Email (Sanitized)
    console.log("4. Testing findProfileByEmail (Sanitized)...");
    const foundByEmail = await findProfileByEmail(testEmail);
    if (!foundByEmail || foundByEmail.id !== createdUserId) {
      throw new Error("findProfileByEmail failed to locate created profile");
    }
    if ((foundByEmail as any).passwordHash || (foundByEmail as any).password_hash) {
      throw new Error("CRITICAL SECURITY VIOLATION: password_hash exposed in findProfileByEmail!");
    }
    console.log("   ✓ findProfileByEmail returned sanitized profile without password hash.");

    // 5. MySQL Profile Repository: Find by ID (Sanitized)
    console.log("5. Testing findProfileById (Sanitized)...");
    const foundById = await findProfileById(createdUserId);
    if (!foundById || foundById.email !== testEmail.toLowerCase()) {
      throw new Error("findProfileById failed to locate created profile");
    }
    if ((foundById as any).passwordHash || (foundById as any).password_hash) {
      throw new Error("CRITICAL SECURITY VIOLATION: password_hash exposed in findProfileById!");
    }
    console.log("   ✓ findProfileById returned sanitized profile without password hash.");

    // 6. MySQL Profile Repository: Internal findProfileWithPasswordByEmail
    console.log("6. Testing findProfileWithPasswordByEmail (Restricted Server Auth)...");
    const authProfile = await findProfileWithPasswordByEmail(testEmail);
    if (!authProfile || !authProfile.passwordHash) {
      throw new Error("findProfileWithPasswordByEmail failed to return passwordHash for auth");
    }
    const authPasswordCheck = await comparePassword(testPassword, authProfile.passwordHash);
    if (!authPasswordCheck) {
      throw new Error("Auth password check failed against stored passwordHash");
    }
    console.log("   ✓ Internal auth helper retrieved passwordHash and verified password successfully.");

    // 7. MySQL Profile Repository: Update Profile
    console.log("7. Testing updateProfile (Parameterized)...");
    const updatedName = "Updated Customer Name";
    const updated = await updateProfile(createdUserId, {
      fullName: updatedName,
      phone: "+919999988888",
    });
    if (!updated || updated.fullName !== updatedName || updated.phone !== "+919999988888") {
      throw new Error("updateProfile failed to persist updates");
    }
    if ((updated as any).passwordHash || (updated as any).password_hash) {
      throw new Error("CRITICAL SECURITY VIOLATION: password_hash exposed in updateProfile!");
    }
    console.log("   ✓ updateProfile successfully updated fields and returned sanitized model.");

    console.log("\n===============================================================");
    console.log("ALL SERVER AUTHENTICATION & PROFILE TESTS PASSED SUCCESSFULLY!");
    console.log("===============================================================");
  } finally {
    // Clean up test customer from Hostinger MySQL
    if (createdUserId) {
      console.log(`Cleaning up test profile ${createdUserId}...`);
      const pool = getDbPool();
      await pool.execute("DELETE FROM profiles WHERE id = ?", [createdUserId]);
      console.log("✓ Test profile cleaned up.");
    }
  }
}

runAuthIntegrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  });
