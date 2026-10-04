import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Load .env.local manually for standalone test runner
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

const baseUrl = "http://localhost:3000";
const uploadDir = path.resolve(process.cwd(), "public", "uploads", "products");

function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

// Minimal valid 1x1 image buffers
const VALID_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

const VALID_JPEG_BUFFER = Buffer.from(
  "ffd8ffe000104a46494600010101004800480000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f00bf00ffd9",
  "hex"
);

const VALID_WEBP_BUFFER = Buffer.from(
  "524946461a000000574542505650384c0e0000002f00000010071011118888fe0700",
  "hex"
);

interface TestResult {
  num: number;
  title: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(num: number, title: string, passed: boolean, details?: string) {
  results.push({ num, title, passed, details });
  const mark = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`   [TEST ${num}] [${mark}] ${title}${details ? ` — ${details}` : ""}`);
}

async function runB11StorageVerification() {
  console.log("=================================================================");
  console.log("Dearr V1 — Task B-11: Hostinger Product Image Storage Verification");
  console.log("Target Base URL:  ", baseUrl);
  console.log("Storage Directory:", uploadDir);
  console.log("Database Host:    ", process.env.DB_HOST, "(Hostinger MySQL)");
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerEmail = `qa_b11_cust_${timestamp}@dearr.test`;
  const adminEmail = `qa_b11_admin_${timestamp}@dearr.test`;
  const testPassword = "B11_SecurePassword123!";

  let cookieCustomer: string | null = null;
  let cookieAdmin: string | null = null;

  let idCustomer: string | null = null;
  let idAdmin: string | null = null;

  // Track created files for complete cleanup verification
  const createdTestFiles: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Customer and Admin accounts
    // -------------------------------------------------------------------------
    console.log("Setting up temporary QA accounts in Hostinger MySQL...");

    // 1. Customer Account
    const resCustSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "QA B11 Customer",
        email: customerEmail,
        password: testPassword,
      }),
    });
    const dataCustSignup = await resCustSignup.json();
    if (!resCustSignup.ok || !dataCustSignup.ok) {
      throw new Error(`Customer signup failed: ${JSON.stringify(dataCustSignup)}`);
    }
    idCustomer = dataCustSignup.user.id;
    const custCookieHeader = resCustSignup.headers.get("set-cookie") || "";
    const custMatch = custCookieHeader.match(/dearr_session=([^;]+)/);
    cookieCustomer = custMatch ? `dearr_session=${custMatch[1]}` : null;

    // 2. Admin Account in MySQL
    const db = await getDbConnection();
    const adminHash = await bcrypt.hash(testPassword, 10);
    idAdmin = crypto.randomUUID();
    await db.execute(
      "INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'admin')",
      [idAdmin, adminEmail, adminHash, "QA B11 Founder Admin"]
    );
    await db.end();

    const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adminEmail,
        password: testPassword,
      }),
    });
    const dataAdminLogin = await resAdminLogin.json();
    if (!resAdminLogin.ok || !dataAdminLogin.ok) {
      throw new Error(`Admin login failed: ${JSON.stringify(dataAdminLogin)}`);
    }
    const adminCookieHeader = resAdminLogin.headers.get("set-cookie") || "";
    const adminMatch = adminCookieHeader.match(/dearr_session=([^;]+)/);
    cookieAdmin = adminMatch ? `dearr_session=${adminMatch[1]}` : null;

    console.log(`✓ Customer account created: ${idCustomer}`);
    console.log(`✓ Admin account created:    ${idAdmin}\n`);

    // Helper: upload a buffer
    async function uploadBuffer(
      buffer: Buffer,
      filename: string,
      mimeType: string,
      cookie?: string | null
    ) {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      formData.append("file", blob, filename);

      const headers: Record<string, string> = {};
      if (cookie) {
        headers["Cookie"] = cookie;
      }

      return fetch(`${baseUrl}/api/admin/products/images`, {
        method: "POST",
        headers,
        body: formData,
      });
    }

    // -------------------------------------------------------------------------
    // TEST 1 — Unauthenticated upload (Expected: 401)
    // -------------------------------------------------------------------------
    const resTest1 = await uploadBuffer(VALID_PNG_BUFFER, "test.png", "image/png", null);
    const dataTest1 = await resTest1.json();
    recordTest(
      1,
      "Unauthenticated upload rejected with 401 Unauthorized",
      resTest1.status === 401 && dataTest1.ok === false,
      `Status: ${resTest1.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 2 — Customer upload (Expected: 403 Forbidden)
    // -------------------------------------------------------------------------
    const resTest2 = await uploadBuffer(VALID_PNG_BUFFER, "test.png", "image/png", cookieCustomer);
    const dataTest2 = await resTest2.json();
    recordTest(
      2,
      "Customer role upload rejected with 403 Forbidden",
      resTest2.status === 403 && dataTest2.ok === false,
      `Status: ${resTest2.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3 — Admin upload valid JPEG/PNG/WebP (Expected: 201 Created)
    // -------------------------------------------------------------------------
    const resUploadPng = await uploadBuffer(VALID_PNG_BUFFER, "sample.png", "image/png", cookieAdmin);
    const dataUploadPng = await resUploadPng.json();

    const resUploadJpg = await uploadBuffer(VALID_JPEG_BUFFER, "sample.jpg", "image/jpeg", cookieAdmin);
    const dataUploadJpg = await resUploadJpg.json();

    const resUploadWebp = await uploadBuffer(VALID_WEBP_BUFFER, "sample.webp", "image/webp", cookieAdmin);
    const dataUploadWebp = await resUploadWebp.json();

    if (dataUploadPng.image?.filename) createdTestFiles.push(dataUploadPng.image.filename);
    if (dataUploadJpg.image?.filename) createdTestFiles.push(dataUploadJpg.image.filename);
    if (dataUploadWebp.image?.filename) createdTestFiles.push(dataUploadWebp.image.filename);

    const uploadsSucceeded =
      resUploadPng.status === 201 &&
      dataUploadPng.ok === true &&
      resUploadJpg.status === 201 &&
      dataUploadJpg.ok === true &&
      resUploadWebp.status === 201 &&
      dataUploadWebp.ok === true;

    recordTest(
      3,
      "Admin upload of valid PNG, JPEG, and WebP returns 201 Created",
      uploadsSucceeded,
      `PNG: ${dataUploadPng.image?.filename}, JPG: ${dataUploadJpg.image?.filename}, WebP: ${dataUploadWebp.image?.filename}`
    );

    // -------------------------------------------------------------------------
    // TEST 4 — Uploaded file physically exists under public/uploads/products/
    // -------------------------------------------------------------------------
    const pngFilePath = path.join(uploadDir, dataUploadPng.image.filename);
    const fileExistsOnDisk = fs.existsSync(pngFilePath) && fs.statSync(pngFilePath).size > 0;
    recordTest(
      4,
      "Uploaded image physically exists in public/uploads/products/",
      fileExistsOnDisk,
      `File: ${pngFilePath}`
    );

    // -------------------------------------------------------------------------
    // TEST 5 — Returned URL is under /uploads/products/
    // -------------------------------------------------------------------------
    const urlValid =
      typeof dataUploadPng.image?.url === "string" &&
      dataUploadPng.image.url.startsWith("/uploads/products/") &&
      !dataUploadPng.image.url.includes("..") &&
      !dataUploadPng.image.url.includes("\\");

    recordTest(
      5,
      "Returned URL starts with /uploads/products/ with clean format",
      urlValid,
      `URL: ${dataUploadPng.image?.url}`
    );

    // -------------------------------------------------------------------------
    // TEST 6 — Attempted traversal filename is neutralized
    // -------------------------------------------------------------------------
    const resTraversalUpload = await uploadBuffer(
      VALID_PNG_BUFFER,
      "../../../hacked.png",
      "image/png",
      cookieAdmin
    );
    const dataTraversalUpload = await resTraversalUpload.json();
    let traversalStoredSafely = false;

    if (resTraversalUpload.status === 201 && dataTraversalUpload.image?.filename) {
      createdTestFiles.push(dataTraversalUpload.image.filename);
      // Ensure the generated filename contains NO slashes or traversal dots
      traversalStoredSafely =
        !dataTraversalUpload.image.filename.includes("..") &&
        !dataTraversalUpload.image.filename.includes("/") &&
        !dataTraversalUpload.image.filename.includes("\\") &&
        fs.existsSync(path.join(uploadDir, dataTraversalUpload.image.filename));
    }

    recordTest(
      6,
      "Traversal filename in upload is neutralized into safe random UUID filename",
      traversalStoredSafely,
      `Stored as: ${dataTraversalUpload.image?.filename}`
    );

    // -------------------------------------------------------------------------
    // TEST 7 — Unsupported MIME/type is rejected (400 Bad Request)
    // -------------------------------------------------------------------------
    const fakeTextBuffer = Buffer.from("Hello world, this is a plain text file pretending to be image", "utf-8");
    const resUnsupported = await uploadBuffer(fakeTextBuffer, "fake.jpg", "text/plain", cookieAdmin);
    const dataUnsupported = await resUnsupported.json();

    recordTest(
      7,
      "Unsupported MIME/type or invalid image content rejected with 400 Bad Request",
      resUnsupported.status === 400 && dataUnsupported.ok === false,
      `Status: ${resUnsupported.status}, Error: '${dataUnsupported.error}'`
    );

    // -------------------------------------------------------------------------
    // TEST 8 — Oversized file (> 5 MB) is rejected (400 Bad Request)
    // -------------------------------------------------------------------------
    // Create buffer larger than 5 MB (5.2 MB) starting with PNG magic bytes
    const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024);
    VALID_PNG_BUFFER.copy(oversizedBuffer, 0, 0, VALID_PNG_BUFFER.length);

    const resOversized = await uploadBuffer(oversizedBuffer, "large.png", "image/png", cookieAdmin);
    const dataOversized = await resOversized.json();

    recordTest(
      8,
      "Oversized image file (> 5 MB) rejected with 400 Bad Request",
      resOversized.status === 400 && dataOversized.ok === false,
      `Status: ${resOversized.status}, Error: '${dataOversized.error}'`
    );

    // -------------------------------------------------------------------------
    // TEST 9 — Admin can delete uploaded test image (200 OK)
    // -------------------------------------------------------------------------
    const imageToDeleteFilename = dataUploadPng.image.filename;
    const resDelete = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({ filename: imageToDeleteFilename }),
    });
    const dataDelete = await resDelete.json();

    recordTest(
      9,
      "Admin can delete previously uploaded product image (200 OK)",
      resDelete.status === 200 && dataDelete.ok === true,
      `Deleted: ${imageToDeleteFilename}`
    );

    // -------------------------------------------------------------------------
    // TEST 10 — File is actually removed from disk
    // -------------------------------------------------------------------------
    const deletedFileExists = fs.existsSync(path.join(uploadDir, imageToDeleteFilename));
    recordTest(
      10,
      "Deleted image file is physically removed from storage disk",
      !deletedFileExists,
      `Exists: ${deletedFileExists}`
    );

    // -------------------------------------------------------------------------
    // TEST 11 — Delete attempt targeting path outside upload directory is rejected (400)
    // -------------------------------------------------------------------------
    const resTraversalDelete = await fetch(`${baseUrl}/api/admin/products/images`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin!,
      },
      body: JSON.stringify({ filename: "../../package.json" }),
    });
    const dataTraversalDelete = await resTraversalDelete.json();

    recordTest(
      11,
      "Delete attempt targeting path outside product uploads directory rejected with 400",
      resTraversalDelete.status === 400 && dataTraversalDelete.ok === false,
      `Status: ${resTraversalDelete.status}, Error: '${dataTraversalDelete.error}'`
    );

    // Clean up remaining test uploaded files
    for (const f of createdTestFiles) {
      const p = path.join(uploadDir, f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }

    // -------------------------------------------------------------------------
    // TEST 12 — No temporary QA files remain after test
    // -------------------------------------------------------------------------
    let leftoverFiles = 0;
    for (const f of createdTestFiles) {
      if (fs.existsSync(path.join(uploadDir, f))) {
        leftoverFiles++;
      }
    }

    recordTest(
      12,
      "No temporary QA files remain in public/uploads/products/ after test cleanup",
      leftoverFiles === 0,
      `Leftover files: ${leftoverFiles}`
    );

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n=================================================================");
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log(`B-11 VERIFICATION SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
    console.log("=================================================================\n");

    if (passedCount !== totalCount) {
      throw new Error(`B-11 verification failed: ${totalCount - passedCount} test(s) failed.`);
    }
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Delete temporary QA accounts and test images
    // -------------------------------------------------------------------------
    console.log("Cleaning up temporary QA accounts and files...");
    try {
      const dbClean = await getDbConnection();
      const [delRes] = await dbClean.execute(
        "DELETE FROM profiles WHERE email LIKE 'qa_b11_%@dearr.test'"
      );
      console.log(`✓ Cleaned up ${(delRes as any).affectedRows} test profile(s) from Hostinger MySQL.`);
      await dbClean.end();
    } catch (cleanErr) {
      console.error("Database cleanup error:", cleanErr);
    }

    // Ensure all test images are purged
    for (const f of createdTestFiles) {
      const p = path.join(uploadDir, f);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
  }
}

runB11StorageVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nTEST SUITE EXECUTION ERROR:", err);
    process.exit(1);
  });
