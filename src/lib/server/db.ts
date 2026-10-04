import "server-only";
import mysql, { Pool, PoolConnection } from "mysql2/promise";

declare global {
  // Allow global connection pool caching in non-production environments across Next.js HMR
  // eslint-disable-next-line no-var
  var _dearrMysqlPool: Pool | undefined;
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
  const host = process.env.DB_HOST?.trim();
  const port = parseInt(process.env.DB_PORT || "3306", 10);
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;

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
  if (globalThis._dearrMysqlPool) {
    return globalThis._dearrMysqlPool;
  }

  const config = getDbConfig();

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
  return pool;
}

/**
 * Executes a parameterized SQL query using the connection pool.
 */
export async function query<T = any>(
  sql: string,
  params?: any
): Promise<T> {
  const pool = getDbPool();
  try {
    const [results] = await pool.execute(sql, params);
    return results as T;
  } catch (err: any) {
    if (
      err &&
      (err.code === "ECONNRESET" ||
        err.code === "PROTOCOL_CONNECTION_LOST" ||
        err.code === "ETIMEDOUT")
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
