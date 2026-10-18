/**
 * Comprehensive Database Safety Regression Test Suite for Dearr
 *
 * Verifies that:
 * 1. Loopback host plus dearr_test: allowed in explicit test mode (127.0.0.1, localhost, ::1).
 * 2. Remote database host: strictly rejected before connection or mutation.
 * 3. Production database name: strictly rejected before connection or mutation.
 * 4. Missing test-mode confirmation: rejected before connection or mutation.
 * 5. Missing required database configuration: rejected before connection or mutation.
 * 6. Invalid or contradictory environment configuration: rejected before connection or mutation.
 * 7. CI environment & test mode separation: CI=true alone does not authorize test mode without explicit test confirmation.
 * 8. Live connection safety: runtime DATABASE() check strictly validates dearr_test.
 * 9. Application db.ts getDbConfig(): enforces test safety fail-closed guards.
 * 10. Runtime database target verification.
 * 11. Test-mode loader hardening: rejects contradictory configurations before changing environment or applying defaults.
 */

import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import {
  validateTestDatabaseTarget,
  assertTestDatabaseSafety,
  loadTestEnvironment,
  createSafeTestConnection,
  ALLOWED_LOOPBACK_HOSTS,
  ALLOWED_TEST_DB_NAME,
} from "./test-db-safety";
import { getDbConfig } from "../src/lib/server/db";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTestCase(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`  ✓ [PASS] Case ${totalTests}: ${name}`);
        })
        .catch((err) => {
          failedTests++;
          console.error(`  ✗ [FAIL] Case ${totalTests}: ${name}`);
          console.error(`          Error: ${err.message}`);
        });
    }
    passedTests++;
    console.log(`  ✓ [PASS] Case ${totalTests}: ${name}`);
  } catch (err: any) {
    failedTests++;
    console.error(`  ✗ [FAIL] Case ${totalTests}: ${name}`);
    console.error(`          Error: ${err.message}`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("DEARR V1.4.1 — TEST DATABASE SAFETY CONTROLS & REGRESSION VERIFICATION");
  console.log("================================================================================\n");

  // Save current process.env to restore after tests
  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // CATEGORY 1: Loopback Host + dearr_test in Explicit Test Mode (Allowed)
    // -------------------------------------------------------------------------
    console.log("--- 1. Loopback Host & dearr_test Acceptance ---");

    for (const host of ["127.0.0.1", "localhost", "::1"]) {
      runTestCase(`Accept loopback host "${host}" with "${ALLOWED_TEST_DB_NAME}" in test mode`, () => {
        const res = validateTestDatabaseTarget(
          {
            host,
            port: 3306,
            database: ALLOWED_TEST_DB_NAME,
            user: "dearr_local_user",
            password: "safe_password",
            isTestMode: true,
          },
          {} as any
        );
        if (!res.valid) {
          throw new Error(`Expected valid for ${host}, but got error: ${res.error}`);
        }
        if (res.safeConfig?.host !== host.toLowerCase() || res.safeConfig?.database !== ALLOWED_TEST_DB_NAME) {
          throw new Error(`Mismatched safeConfig output`);
        }
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY 2: Remote Database Hosts (Strictly Rejected)
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Remote Database Host Rejection (Fail-Closed) ---");

    const remoteHosts = [
      "srv1741.hstgr.io",
      "hostinger.com",
      "192.168.1.100",
      "10.0.0.1",
      "172.16.0.5",
      "8.8.8.8",
      "db.production.dearr.in",
      "127.0.0.2",
    ];

    for (const remoteHost of remoteHosts) {
      runTestCase(`Reject remote host "${remoteHost}" before connection`, () => {
        const res = validateTestDatabaseTarget(
          {
            host: remoteHost,
            port: 3306,
            database: ALLOWED_TEST_DB_NAME,
            user: "test_user",
            password: "test_password",
            isTestMode: true,
          },
          {} as any
        );
        if (res.valid) {
          throw new Error(`Expected remote host "${remoteHost}" to be rejected!`);
        }
        if (!res.error?.includes("Remote database host") && !res.error?.includes("rejected")) {
          throw new Error(`Expected remote host error message, got: ${res.error}`);
        }
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY 3: Production & Non-Test Database Names (Strictly Rejected)
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Production & Non-Test Database Name Rejection ---");

    const rejectedDatabases = [
      "u209580425_Dearr",
      "dearr_production",
      "dearr_prod",
      "dearr_live",
      "dearr_local",
      "production",
      "dearr",
      "mysql",
      "information_schema",
      "test",
    ];

    for (const dbName of rejectedDatabases) {
      runTestCase(`Reject database name "${dbName}" before connection`, () => {
        const res = validateTestDatabaseTarget(
          {
            host: "127.0.0.1",
            port: 3306,
            database: dbName,
            user: "test_user",
            password: "test_password",
            isTestMode: true,
          },
          {} as any
        );
        if (res.valid) {
          throw new Error(`Expected database "${dbName}" to be rejected!`);
        }
        if (!res.error?.includes("Target database") && !res.error?.includes("rejected")) {
          throw new Error(`Expected database rejection error message, got: ${res.error}`);
        }
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY 4: Missing Test-Mode Confirmation (Strictly Rejected)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Missing Test-Mode Confirmation Rejection ---");

    runTestCase("Reject execution when test-mode is not confirmed (isTestMode=false & clean env)", () => {
      const res = validateTestDatabaseTarget(
        {
          host: "127.0.0.1",
          port: 3306,
          database: ALLOWED_TEST_DB_NAME,
          user: "test_user",
          password: "test_password",
          isTestMode: false,
        },
        {
          DEARR_TEST_MODE: "",
          NODE_ENV: "development",
          CI: "",
        } as any
      );
      if (res.valid) {
        throw new Error("Expected rejection when test-mode confirmation is missing!");
      }
      if (!res.error?.includes("Missing required test-mode confirmation")) {
        throw new Error(`Unexpected error message: ${res.error}`);
      }
    });

    runTestCase("assertTestDatabaseSafety throws DatabaseSafetyError on missing test mode", () => {
      let threw = false;
      try {
        assertTestDatabaseSafety(
          {
            host: "127.0.0.1",
            port: 3306,
            database: ALLOWED_TEST_DB_NAME,
            user: "test_user",
            password: "test_password",
            isTestMode: false,
          },
          {
            DEARR_TEST_MODE: "",
            NODE_ENV: "development",
            CI: "",
          } as any
        );
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Missing required test-mode confirmation")) {
          throw new Error(`Wrong exception message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("assertTestDatabaseSafety did not throw!");
      }
    });

    // -------------------------------------------------------------------------
    // CATEGORY 5: Missing Required Database Configuration (Strictly Rejected)
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Missing Required Database Configuration Rejection ---");

    const requiredFields = [
      { field: "host", val: "" },
      { field: "database", val: "" },
      { field: "user", val: "" },
      { field: "password", val: undefined },
    ];

    for (const { field, val } of requiredFields) {
      runTestCase(`Reject when ${field} is missing`, () => {
        const base: any = {
          host: "127.0.0.1",
          port: 3306,
          database: ALLOWED_TEST_DB_NAME,
          user: "test_user",
          password: "test_password",
          isTestMode: true,
        };
        base[field] = val;
        const res = validateTestDatabaseTarget(base, {} as any);
        if (res.valid) {
          throw new Error(`Expected missing ${field} to fail validation!`);
        }
        if (!res.error?.includes("Missing required database configuration")) {
          throw new Error(`Unexpected error message: ${res.error}`);
        }
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY 6: Invalid or Contradictory Environment (Strictly Rejected)
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Contradictory or Invalid Environment Configuration ---");

    runTestCase("Reject when NODE_ENV is explicitly 'production' during test run", () => {
      const res = validateTestDatabaseTarget(
        {
          host: "127.0.0.1",
          port: 3306,
          database: ALLOWED_TEST_DB_NAME,
          user: "test_user",
          password: "test_password",
          isTestMode: true,
          nodeEnv: "production",
        },
        { NODE_ENV: "production" } as any
      );
      if (res.valid) {
        throw new Error("Expected failure when NODE_ENV is production in test run!");
      }
      if (!res.error?.includes("NODE_ENV cannot be \"production\"")) {
        throw new Error(`Unexpected error message: ${res.error}`);
      }
    });

    runTestCase("Reject when DEARR_TEST_MODE is explicitly disabled ('false')", () => {
      const res = validateTestDatabaseTarget(
        {
          host: "127.0.0.1",
          port: 3306,
          database: ALLOWED_TEST_DB_NAME,
          user: "test_user",
          password: "test_password",
          isTestMode: true,
        },
        { DEARR_TEST_MODE: "false" } as any
      );
      if (res.valid) {
        throw new Error("Expected failure when DEARR_TEST_MODE='false'!");
      }
      if (!res.error?.includes("DEARR_TEST_MODE is explicitly disabled")) {
        throw new Error(`Unexpected error message: ${res.error}`);
      }
    });

    runTestCase("Reject invalid port number (out of range: 70000)", () => {
      const res = validateTestDatabaseTarget(
        {
          host: "127.0.0.1",
          port: 70000,
          database: ALLOWED_TEST_DB_NAME,
          user: "test_user",
          password: "test_password",
          isTestMode: true,
        },
        {} as any
      );
      if (res.valid) {
        throw new Error("Expected failure for port 70000!");
      }
      if (!res.error?.includes("Invalid database port")) {
        throw new Error(`Unexpected error message: ${res.error}`);
      }
    });

    runTestCase("Reject non-numeric port string ('invalid_port')", () => {
      const res = validateTestDatabaseTarget(
        {
          host: "127.0.0.1",
          port: "invalid_port" as any,
          database: ALLOWED_TEST_DB_NAME,
          user: "test_user",
          password: "test_password",
          isTestMode: true,
        },
        {} as any
      );
      if (res.valid) {
        throw new Error("Expected failure for non-numeric port!");
      }
      if (!res.error?.includes("Invalid database port")) {
        throw new Error(`Unexpected error message: ${res.error}`);
      }
    });

    // -------------------------------------------------------------------------
    // CATEGORY 7: Simulated CI Environment (Separation of CI from Test Mode)
    // -------------------------------------------------------------------------
    console.log("\n--- 7. CI Environment & Test Mode Separation ---");

    runTestCase("Isolated CI environment with explicit DEARR_TEST_MODE passes test safety validation", () => {
      const ciEnv = {
        CI: "true",
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "dearr_test",
        DB_USER: "root",
        DB_PASSWORD: "rootpassword",
        NODE_ENV: "test",
        DEARR_TEST_MODE: "true",
      };
      const res = validateTestDatabaseTarget(undefined, ciEnv as any);
      if (!res.valid) {
        throw new Error(`Expected CI env to pass, got error: ${res.error}`);
      }
      if (res.safeConfig?.host !== "127.0.0.1" || res.safeConfig?.database !== "dearr_test") {
        throw new Error("Safe config mismatch for CI env");
      }
    });

    runTestCase("CI=true alone does not authorize test mode without explicit test confirmation", () => {
      const ciOnlyEnv = {
        CI: "true",
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "dearr_test",
        DB_USER: "root",
        DB_PASSWORD: "rootpassword",
      };
      const res = validateTestDatabaseTarget(undefined, ciOnlyEnv as any);
      if (res.valid) {
        throw new Error("Expected validation failure when CI=true has no explicit DEARR_TEST_MODE=true or NODE_ENV=test");
      }
      if (!res.error?.includes("Missing required test-mode confirmation")) {
        throw new Error(`Unexpected error message: ${res.error}`);
      }
    });

    runTestCase("CI=true with explicit DEARR_TEST_MODE=true and valid isolated test database settings is accepted", () => {
      const ciTestEnv = {
        CI: "true",
        DEARR_TEST_MODE: "true",
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "dearr_test",
        DB_USER: "root",
        DB_PASSWORD: "rootpassword",
      };
      const res = validateTestDatabaseTarget(undefined, ciTestEnv as any);
      if (!res.valid) {
        throw new Error(`Expected valid test configuration in CI with DEARR_TEST_MODE=true, got error: ${res.error}`);
      }
      if (res.safeConfig?.database !== ALLOWED_TEST_DB_NAME) {
        throw new Error("Safe config mismatch for CI test env");
      }
    });

    // -------------------------------------------------------------------------
    // CATEGORY 8: Application db.ts getDbConfig() Safety Guard
    // -------------------------------------------------------------------------
    console.log("\n--- 8. Application db.ts getDbConfig() Safety Guards ---");

    runTestCase("getDbConfig() throws when DEARR_TEST_MODE=true and host is remote", () => {
      process.env.DEARR_TEST_MODE = "true";
      process.env.NODE_ENV = "test";
      process.env.DB_HOST = "srv1741.hstgr.io";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "dearr_test";
      process.env.DB_USER = "remote_user";
      process.env.DB_PASSWORD = "remote_password";

      let threw = false;
      try {
        getDbConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Database safety refusal") || !err.message.includes("non-loopback host")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("getDbConfig() did not reject remote host in test mode!");
      }
    });

    runTestCase("getDbConfig() throws when DEARR_TEST_MODE=true and DB_NAME is not dearr_test", () => {
      process.env.DEARR_TEST_MODE = "true";
      process.env.NODE_ENV = "test";
      process.env.DB_HOST = "127.0.0.1";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "u209580425_Dearr"; // Production DB name
      process.env.DB_USER = "local_user";
      process.env.DB_PASSWORD = "local_password";

      let threw = false;
      try {
        getDbConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Database safety refusal") || !err.message.includes("Tests must strictly target \"dearr_test\"")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("getDbConfig() did not reject production database name in test mode!");
      }
    });

    runTestCase("getDbConfig() throws when NODE_ENV=production in test mode", () => {
      process.env.DEARR_TEST_MODE = "true";
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "127.0.0.1";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "dearr_test";
      process.env.DB_USER = "local_user";
      process.env.DB_PASSWORD = "local_password";

      let threw = false;
      try {
        getDbConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Contradictory environment configuration")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("getDbConfig() did not reject contradictory NODE_ENV=production in test mode!");
      }
    });

    // -------------------------------------------------------------------------
    // CATEGORY 9: Production & Development Compatibility (Non-Test Environments)
    // -------------------------------------------------------------------------
    console.log("\n--- 9. Production & Development Compatibility Verification ---");

    runTestCase("getDbConfig() allows Hostinger production host and DB when NODE_ENV=production", () => {
      delete process.env.DEARR_TEST_MODE;
      delete process.env.CI;
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "srv1741.hstgr.io";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "u209580425_Dearr";
      process.env.DB_USER = "u209580425_dearr_admin";
      process.env.DB_PASSWORD = "prod_password_mock";

      const config = getDbConfig();
      if (config.host !== "srv1741.hstgr.io" || config.database !== "u209580425_Dearr") {
        throw new Error(`Production getDbConfig did not return expected target. Got host: ${config.host}, db: ${config.database}`);
      }
    });

    runTestCase("getDbConfig() throws descriptive error on missing database credentials in production", () => {
      delete process.env.DEARR_TEST_MODE;
      delete process.env.CI;
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "srv1741.hstgr.io";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "u209580425_Dearr";
      process.env.DB_USER = "u209580425_dearr_admin";
      delete process.env.DB_PASSWORD;

      let threw = false;
      try {
        getDbConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Missing required environment variable")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("getDbConfig() did not throw on missing DB_PASSWORD");
      }
    });

    runTestCase("getDbConfig() allows dev target when NODE_ENV=development and test mode is inactive", () => {
      delete process.env.DEARR_TEST_MODE;
      delete process.env.CI;
      process.env.NODE_ENV = "development";
      process.env.DB_HOST = "localhost";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "dearr_dev";
      process.env.DB_USER = "dev_user";
      process.env.DB_PASSWORD = "dev_password";

      const config = getDbConfig();
      if (config.host !== "localhost" || config.database !== "dearr_dev") {
        throw new Error(`Development getDbConfig did not return expected target. Got host: ${config.host}, db: ${config.database}`);
      }
    });

    runTestCase("getDbConfig() activates test-mode safeguards whenever DEARR_TEST_MODE=true", () => {
      process.env.DEARR_TEST_MODE = "true";
      delete process.env.CI;
      process.env.NODE_ENV = "development";
      process.env.DB_HOST = "srv1741.hstgr.io";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "dearr_test";
      process.env.DB_USER = "user";
      process.env.DB_PASSWORD = "pwd";

      let threw = false;
      try {
        getDbConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Database safety refusal")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("getDbConfig() did not enforce test safety with DEARR_TEST_MODE=true");
      }
    });

    runTestCase("Production mode with CI=true does not activate test-only restrictions solely because CI is set", () => {
      delete process.env.DEARR_TEST_MODE;
      process.env.CI = "true";
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "srv1741.hstgr.io";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "u209580425_Dearr";
      process.env.DB_USER = "u209580425_dearr_admin";
      process.env.DB_PASSWORD = "prod_password_mock";

      const config = getDbConfig();
      if (config.host !== "srv1741.hstgr.io" || config.database !== "u209580425_Dearr") {
        throw new Error(`Production getDbConfig in CI did not return expected target. Got host: ${config.host}, db: ${config.database}`);
      }
    });

    runTestCase("Production mode combined with explicit DEARR_TEST_MODE=true is rejected (even in CI)", () => {
      process.env.CI = "true";
      process.env.DEARR_TEST_MODE = "true";
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "127.0.0.1";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "dearr_test";
      process.env.DB_USER = "test_user";
      process.env.DB_PASSWORD = "test_password";

      let threw = false;
      try {
        getDbConfig();
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("Contradictory environment configuration")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("getDbConfig() did not reject contradictory NODE_ENV=production with DEARR_TEST_MODE=true");
      }
    });

    runTestCase("Normal production configuration can be inspected using mocked environment variables without opening a database connection", () => {
      delete process.env.DEARR_TEST_MODE;
      delete process.env.CI;
      process.env.NODE_ENV = "production";
      process.env.DB_HOST = "srv1741.hstgr.io";
      process.env.DB_PORT = "3306";
      process.env.DB_NAME = "u209580425_Dearr";
      process.env.DB_USER = "u209580425_dearr_admin";
      process.env.DB_PASSWORD = "prod_password_mock";

      const config = getDbConfig();
      if (
        config.host !== "srv1741.hstgr.io" ||
        config.port !== 3306 ||
        config.database !== "u209580425_Dearr" ||
        config.user !== "u209580425_dearr_admin" ||
        config.password !== "prod_password_mock"
      ) {
        throw new Error("Production config did not match expected mocked environment values");
      }
    });

    // -------------------------------------------------------------------------
    // CATEGORY 10: Runtime MySQL DATABASE() Query Check
    // -------------------------------------------------------------------------
    console.log("\n--- 10. Runtime Database Target Verification ---");

    // Restore test environment for real connection test
    process.env = { ...originalEnv };
    loadTestEnvironment();

    await runTestCase("createSafeTestConnection connects to verified local dearr_test", async () => {
      const conn = await createSafeTestConnection(mysql);
      try {
        const [rows]: any = await conn.query("SELECT DATABASE() as db, @@port as port");
        if (rows[0].db !== ALLOWED_TEST_DB_NAME) {
          throw new Error(`Expected database ${ALLOWED_TEST_DB_NAME}, got ${rows[0].db}`);
        }
      } finally {
        await conn.end();
      }
    });

    // -------------------------------------------------------------------------
    // CATEGORY 11: Test-Mode Loader Hardening & Contradictory Configuration Refusal
    // -------------------------------------------------------------------------
    console.log("\n--- 11. Test-Mode Loader Hardening & Contradictory Config Rejection ---");

    runTestCase("loadTestEnvironment() rejects existing DEARR_TEST_MODE=false before changing environment", () => {
      const mockEnv: NodeJS.ProcessEnv = {
        DEARR_TEST_MODE: "false",
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "dearr_test",
        DB_USER: "test_user",
        DB_PASSWORD: "test_password",
      };
      let threw = false;
      try {
        loadTestEnvironment({ env: mockEnv, skipAssert: true });
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("DEARR_TEST_MODE is explicitly disabled")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("loadTestEnvironment() did not reject existing DEARR_TEST_MODE=false");
      }
      if (mockEnv.DEARR_TEST_MODE !== "false") {
        throw new Error(`mockEnv.DEARR_TEST_MODE was mutated to: ${mockEnv.DEARR_TEST_MODE}`);
      }
    });

    runTestCase("loadTestEnvironment() rejects existing NODE_ENV=production during test-runner initialization", () => {
      const mockEnv: NodeJS.ProcessEnv = {
        NODE_ENV: "production",
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "dearr_test",
        DB_USER: "test_user",
        DB_PASSWORD: "test_password",
      };
      let threw = false;
      try {
        loadTestEnvironment({ env: mockEnv, skipAssert: true });
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("NODE_ENV cannot be \"production\"")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("loadTestEnvironment() did not reject existing NODE_ENV=production");
      }
      if (mockEnv.NODE_ENV !== "production") {
        throw new Error(`mockEnv.NODE_ENV was mutated to: ${mockEnv.NODE_ENV}`);
      }
    });

    runTestCase("loadTestEnvironment() rejects test environment file explicitly disabling test mode", () => {
      const scratchDir = path.resolve(process.cwd(), "scratch");
      const tempFile = path.resolve(scratchDir, "test-contradictory-disabled.env");
      fs.mkdirSync(scratchDir, { recursive: true });
      fs.writeFileSync(tempFile, "DEARR_TEST_MODE=false\nDB_NAME=dearr_test\nDB_HOST=127.0.0.1\nDB_USER=test\nDB_PASSWORD=test\n");
      try {
        const mockEnv: NodeJS.ProcessEnv = {};
        let threw = false;
        try {
          loadTestEnvironment({ env: mockEnv, testEnvPath: tempFile, skipAssert: true });
        } catch (err: any) {
          threw = true;
          if (!err.message.includes("explicitly disables test mode")) {
            throw new Error(`Unexpected error message: ${err.message}`);
          }
        }
        if (!threw) {
          throw new Error("loadTestEnvironment() did not reject test environment file with DEARR_TEST_MODE=false");
        }
        if (mockEnv.DEARR_TEST_MODE === "true") {
          throw new Error("Defaults were incorrectly applied after contradictory test env file");
        }
      } finally {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }
    });

    runTestCase("loadTestEnvironment() rejects test environment file specifying NODE_ENV=production", () => {
      const scratchDir = path.resolve(process.cwd(), "scratch");
      const tempFile = path.resolve(scratchDir, "test-contradictory-production.env");
      fs.mkdirSync(scratchDir, { recursive: true });
      fs.writeFileSync(tempFile, "NODE_ENV=production\nDB_NAME=dearr_test\nDB_HOST=127.0.0.1\nDB_USER=test\nDB_PASSWORD=test\n");
      try {
        const mockEnv: NodeJS.ProcessEnv = {};
        let threw = false;
        try {
          loadTestEnvironment({ env: mockEnv, testEnvPath: tempFile, skipAssert: true });
        } catch (err: any) {
          threw = true;
          if (!err.message.includes("NODE_ENV=\"production\"")) {
            throw new Error(`Unexpected error message: ${err.message}`);
          }
        }
        if (!threw) {
          throw new Error("loadTestEnvironment() did not reject test environment file with NODE_ENV=production");
        }
        if (mockEnv.NODE_ENV === "test") {
          throw new Error("Defaults were incorrectly applied after contradictory test env file");
        }
      } finally {
        try { fs.unlinkSync(tempFile); } catch (_) {}
      }
    });

    runTestCase("loadTestEnvironment() applies test-mode defaults when no contradictory config exists", () => {
      const mockEnv: NodeJS.ProcessEnv = {
        DB_HOST: "127.0.0.1",
        DB_PORT: "3306",
        DB_NAME: "dearr_test",
        DB_USER: "dearr_user",
        DB_PASSWORD: "safe_password",
      };
      const nonExistentFile = path.resolve(process.cwd(), "scratch", "nonexistent.env");
      loadTestEnvironment({
        env: mockEnv,
        testEnvPath: nonExistentFile,
        localEnvPath: nonExistentFile,
      });
      if (mockEnv.DEARR_TEST_MODE !== "true") {
        throw new Error(`Expected DEARR_TEST_MODE="true", got "${mockEnv.DEARR_TEST_MODE}"`);
      }
      if (mockEnv.NODE_ENV !== "test") {
        throw new Error(`Expected NODE_ENV="test", got "${mockEnv.NODE_ENV}"`);
      }
    });

    runTestCase("validateTestDatabaseTarget() and assertTestDatabaseSafety() reject NODE_ENV=production before database connection", () => {
      const targetConfig = {
        host: "127.0.0.1",
        port: 3306,
        database: "dearr_test",
        user: "test_user",
        password: "safe_password",
        nodeEnv: "production",
        isTestMode: true,
      };
      const res = validateTestDatabaseTarget(targetConfig, {} as any);
      if (res.valid) {
        throw new Error("validateTestDatabaseTarget() unexpectedly allowed NODE_ENV=production");
      }
      if (!res.error?.includes("NODE_ENV cannot be \"production\"")) {
        throw new Error(`Unexpected validation error: ${res.error}`);
      }

      let threw = false;
      try {
        assertTestDatabaseSafety(targetConfig, {} as any);
      } catch (err: any) {
        threw = true;
        if (!err.message.includes("NODE_ENV cannot be \"production\"")) {
          throw new Error(`Unexpected assertion error: ${err.message}`);
        }
      }
      if (!threw) {
        throw new Error("assertTestDatabaseSafety() did not throw on NODE_ENV=production");
      }
    });

    runTestCase("loadTestEnvironment() rejects local environment fallback file if it specifies contradictory settings", () => {
      const scratchDir = path.resolve(process.cwd(), "scratch");
      const tempLocalFile = path.resolve(scratchDir, "test-contradictory-local.env");
      const nonExistentFile = path.resolve(scratchDir, "nonexistent.env");
      fs.mkdirSync(scratchDir, { recursive: true });
      fs.writeFileSync(tempLocalFile, "DEARR_TEST_MODE=false\nDB_NAME=dearr_test\nDB_HOST=127.0.0.1\nDB_USER=test\nDB_PASSWORD=test\n");
      try {
        const mockEnv: NodeJS.ProcessEnv = {};
        let threw = false;
        try {
          loadTestEnvironment({
            env: mockEnv,
            testEnvPath: nonExistentFile,
            localEnvPath: tempLocalFile,
            skipAssert: true,
          });
        } catch (err: any) {
          threw = true;
          if (!err.message.includes("Contradictory environment configuration")) {
            throw new Error(`Unexpected error message: ${err.message}`);
          }
        }
        if (!threw) {
          throw new Error("loadTestEnvironment() did not reject contradictory localEnvPath file");
        }
      } finally {
        try { fs.unlinkSync(tempLocalFile); } catch (_) {}
      }
    });

  } finally {
    // Always restore original process.env
    process.env = originalEnv;
  }

  console.log("\n================================================================================");
  console.log(`DATABASE SAFETY REGRESSION TEST RESULTS:`);
  console.log(`  Total Test Cases : ${totalTests}`);
  console.log(`  Passed           : ${passedTests}`);
  console.log(`  Failed           : ${failedTests}`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal suite failure:", err);
  process.exit(1);
});
