import type mysql from "mysql2/promise";

const safety = require("./test-db-safety.cjs");

export interface SafeDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  isTestMode?: boolean;
  nodeEnv?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  safeConfig?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
  };
}

export const ALLOWED_LOOPBACK_HOSTS: string[] = safety.ALLOWED_LOOPBACK_HOSTS;
export const ALLOWED_TEST_DB_NAME: string = safety.ALLOWED_TEST_DB_NAME;

export function validateTestDatabaseTarget(
  config?: Partial<SafeDbConfig>,
  env?: NodeJS.ProcessEnv
): ValidationResult {
  return safety.validateTestDatabaseTarget(config, env);
}

export function assertTestDatabaseSafety(
  config?: Partial<SafeDbConfig>,
  env?: NodeJS.ProcessEnv
): {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
} {
  return safety.assertTestDatabaseSafety(config, env);
}

export function loadTestEnvironment(options?: {
  skipAssert?: boolean;
  env?: NodeJS.ProcessEnv;
  testEnvPath?: string;
  localEnvPath?: string;
}): void {
  return safety.loadTestEnvironment(options);
}

export async function createSafeTestConnection(
  mysqlModule: typeof mysql,
  overrideConfig?: Partial<SafeDbConfig>
): Promise<mysql.Connection> {
  return safety.createSafeTestConnection(mysqlModule, overrideConfig);
}

export function createSafeTestPool(
  mysqlModule: typeof mysql,
  overrideConfig?: Partial<SafeDbConfig> & { connectionLimit?: number }
): mysql.Pool {
  return safety.createSafeTestPool(mysqlModule, overrideConfig);
}
