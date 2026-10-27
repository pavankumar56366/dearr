import "server-only";
import fs from "fs";
import path from "path";
import mysql, { Pool, PoolConnection } from "mysql2/promise";

declare global {
  // Allow global connection pool caching in non-production environments across Next.js HMR
  var _dearrMysqlPool: Pool | undefined;
  var _dearrMysqlTargetKey: string | undefined;
}

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

/**
 * Validates and retrieves database connection configuration from environment variables.
 * Throws a descriptive configuration error if any required variable is missing.
 * Never logs or exposes password values.
 */
export function getDbConfig(): DbConfig {
  let host = process.env.DB_HOST?.trim();
  let port = parseInt(process.env.DB_PORT || "3306", 10);
  let database = process.env.DB_NAME?.trim();
  let user = process.env.DB_USER?.trim();
  let password = process.env.DB_PASSWORD;

  const isTestMode =
    process.env.NODE_ENV === "test" ||
    process.env.DEARR_TEST_MODE === "true";

  // In development and testing, load environment configuration safely from disk
  if (process.env.NODE_ENV !== "production") {
    try {
      const testEnvPath = path.resolve(process.cwd(), ".env.test.local");
      const localEnvPath = path.resolve(process.cwd(), ".env.local");

      // Prefer dedicated test environment file (.env.test.local) when in test mode
      const envPath =
        isTestMode && fs.existsSync(testEnvPath) ? testEnvPath : localEnvPath;

      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const k = trimmed.slice(0, eqIdx).trim();
            const v = trimmed.slice(eqIdx + 1).trim();
            if (k === "DB_HOST" && (isTestMode || !host)) host = v;
            if (k === "DB_PORT" && (isTestMode || isNaN(port))) port = parseInt(v, 10);
            if (k === "DB_NAME" && (isTestMode || !database)) database = v;
            if (k === "DB_USER" && (isTestMode || !user)) user = v;
            if (k === "DB_PASSWORD" && (isTestMode || password === undefined)) password = v;
          }
        }
      }
    } catch {
      // Fallback to existing process.env
    }
  }

  // Strict Fail-Closed Safeguard: Enforce loopback and dearr_test during test execution
  if (isTestMode) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Database safety error: Contradictory environment configuration (NODE_ENV cannot be 'production' in test mode)."
      );
    }
    const ALLOWED_TEST_HOSTS = ["127.0.0.1", "localhost", "::1"];
    if (!host || !ALLOWED_TEST_HOSTS.includes(host.toLowerCase())) {
      throw new Error(
        `Database safety refusal: Test execution is blocked against non-loopback host "${host}". Tests must strictly target local loopback (127.0.0.1, localhost, or ::1).`
      );
    }
    if (database !== "dearr_test") {
      throw new Error(
        `Database safety refusal: Test execution is blocked against database "${database}". Tests must strictly target "dearr_test".`
      );
    }
  }

  const missing: string[] = [];
  if (!host) missing.push("DB_HOST");
  if (!database) missing.push("DB_NAME");
  if (!user) missing.push("DB_USER");
  if (password === undefined || password === null) missing.push("DB_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `Database configuration error: Missing required environment variable(s): ${missing.join(
        ", "
      )}. Please configure them in .env.local or Hostinger environment settings.`
    );
  }

  return {
    host: host!,
    port: isNaN(port) ? 3306 : port,
    database: database!,
    user: user!,
    password,
  };
}

/**
 * Obtains or initializes the reusable MySQL connection pool for Hostinger MySQL.
 * In development, caches on globalThis to prevent pool exhaustion across Next.js hot reloads.
 */
export function getDbPool(): Pool {
  const config = getDbConfig();
  const targetKey = `${config.host}:${config.port}:${config.database}:${config.user}`;

  if (globalThis._dearrMysqlPool && globalThis._dearrMysqlTargetKey === targetKey) {
    return globalThis._dearrMysqlPool;
  }

  if (globalThis._dearrMysqlPool) {
    try {
      globalThis._dearrMysqlPool.end();
    } catch {
      // Ignore cleanup error
    }
    globalThis._dearrMysqlPool = undefined;
  }

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 5,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  globalThis._dearrMysqlPool = pool;
  globalThis._dearrMysqlTargetKey = targetKey;
  return pool;
}

/**
 * Executes a parameterized SQL query using the connection pool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = any>(
  sql: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any
): Promise<T> {
  const pool = getDbPool();
  try {
    const [results] = await pool.execute(sql, params);
    return results as T;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (
      error &&
      (error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST" ||
        error.code === "ETIMEDOUT")
    ) {
      const [results] = await pool.execute(sql, params);
      return results as T;
    }
    throw err;
  }
}

/**
 * Executes a callback within a managed MySQL transaction.
 * Automatically commits on success and rolls back on failure.
 */
export async function withTransaction<T>(
  fn: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Performs a lightweight database connectivity check (SELECT 1 AS ok).
 * Catches connection errors safely and prevents credential leakage.
 */
export async function testDbConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    const pool = getDbPool();
    const connection = await pool.getConnection();
    try {
      await connection.query("SELECT 1 AS ok");
      return { ok: true };
    } finally {
      connection.release();
    }
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown database connection error";
    // Log server-side diagnostic message without printing credentials
    console.error("[Dearr DB Health Check]", errorMessage);
    return {
      ok: false,
      message: "Database connection failed",
    };
  }
}
