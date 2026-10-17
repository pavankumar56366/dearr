/**
 * Verification script for HTTP Security Headers (Phase 3)
 */

async function main() {
  console.log("=== Verifying HTTP Security Headers on http://localhost:3000 ===\n");

  try {
    const res = await fetch("http://localhost:3000/");
    console.log(`HTTP Status: ${res.status}`);

    const expectedHeaders: Record<string, (val: string | null) => boolean> = {
      "x-content-type-options": (v) => v === "nosniff",
      "x-frame-options": (v) => v === "DENY",
      "referrer-policy": (v) => v === "strict-origin-when-cross-origin",
      "content-security-policy": (v) => {
        if (!v) return false;
        return (
          v.includes("default-src 'self'") &&
          v.includes("https://checkout.razorpay.com") &&
          v.includes("https://api.razorpay.com") &&
          v.includes("frame-ancestors 'none'")
        );
      },
    };

    let allPassed = true;
    for (const [header, validator] of Object.entries(expectedHeaders)) {
      const val = res.headers.get(header);
      const passed = validator(val);
      if (passed) {
        console.log(`  [PASS] ${header}: ${val}`);
      } else {
        console.log(`  [FAIL] ${header}: ${val}`);
        allPassed = false;
      }
    }

    // Verify HSTS behavior: In local dev (NODE_ENV !== "production"), HSTS must NOT be set
    const hsts = res.headers.get("strict-transport-security");
    if (process.env.NODE_ENV === "production") {
      if (hsts && hsts.includes("max-age=63072000")) {
        console.log(`  [PASS] strict-transport-security: ${hsts} (Production mode enabled)`);
      } else {
        console.log(`  [FAIL] strict-transport-security missing in production!`);
        allPassed = false;
      }
    } else {
      if (!hsts) {
        console.log(`  [PASS] strict-transport-security correctly omitted in local dev environment`);
      } else {
        console.log(`  [WARN] strict-transport-security present in local dev: ${hsts}`);
      }
    }

    if (!allPassed) {
      process.exit(1);
    }
    console.log("\nAll security headers verified successfully!");
  } catch (err) {
    console.error("Failed to connect to http://localhost:3000:", err);
    process.exit(1);
  }
}

main();
