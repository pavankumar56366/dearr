const fs = require('fs');
const path = require('path');

// Auto-mock 'server-only' for Node standalone test runners
try {
  const p = require.resolve('server-only');
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {}

const ALLOWED_LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];
const ALLOWED_TEST_DB_NAME = 'dearr_test';

/**
 * Validates database target parameters against strict test-mode safety rules.
 * Never logs or returns passwords or secrets.
 *
 * @param {Object} [config] Explicit configuration override
 * @param {NodeJS.ProcessEnv} [env] Environment source (defaults to process.env)
 * @returns {{ valid: boolean, error?: string, safeConfig?: { host: string, port: number, database: string, user: string, password?: string } }}
 */
function validateTestDatabaseTarget(config, env = process.env) {
  const effectiveNodeEnv = ((config && config.nodeEnv) || env.NODE_ENV || '').trim().toLowerCase();
  const explicitTestMode = config && typeof config.isTestMode === 'boolean' ? config.isTestMode : undefined;
  const dearrTestMode = (env.DEARR_TEST_MODE || '').trim().toLowerCase();
  const ciEnv = (env.CI || '').trim().toLowerCase();

  // 1. Contradictory Environment Check
  if (effectiveNodeEnv === 'production') {
    return {
      valid: false,
      error: 'Contradictory environment configuration: NODE_ENV cannot be "production" during test execution.',
    };
  }

  if (dearrTestMode === 'false') {
    return {
      valid: false,
      error: 'Contradictory environment configuration: DEARR_TEST_MODE is explicitly disabled ("false").',
    };
  }

  // 2. Explicit Test-Mode Confirmation Check
  const isConfirmed = Boolean(
    explicitTestMode === true ||
    dearrTestMode === 'true' ||
    effectiveNodeEnv === 'test' ||
    ciEnv === 'true'
  );

  if (!isConfirmed) {
    return {
      valid: false,
      error: 'Missing required test-mode confirmation: DEARR_TEST_MODE must be "true" or NODE_ENV must be "test".',
    };
  }

  // 3. Required Database Configuration Check
  const host = ((config && config.host) || env.DB_HOST || '').trim();
  const portRaw = config && config.port !== undefined ? config.port : env.DB_PORT;
  const database = ((config && config.database) || env.DB_NAME || '').trim();
  const user = ((config && config.user) || env.DB_USER || '').trim();
  const password = config && config.password !== undefined ? config.password : env.DB_PASSWORD;

  const missing = [];
  if (!host) missing.push('DB_HOST');
  if (!database) missing.push('DB_NAME');
  if (!user) missing.push('DB_USER');
  if (password === undefined || password === null) missing.push('DB_PASSWORD');

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required database configuration: ${missing.join(', ')} must be provided.`,
    };
  }

  // 4. Port Validation
  const port = parseInt(String(portRaw || '3306'), 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    return {
      valid: false,
      error: `Invalid database port: ${portRaw}. Must be a valid integer between 1 and 65535.`,
    };
  }

  // 5. Host Validation (Strict Loopback Only)
  const trimmedHost = host.toLowerCase();
  if (!ALLOWED_LOOPBACK_HOSTS.includes(trimmedHost)) {
    return {
      valid: false,
      error: `Remote database host "${host}" is rejected. Test execution must strictly use a local loopback hostname (127.0.0.1, localhost, or ::1).`,
    };
  }

  // 6. Strict Database Name Validation (dearr_test Only)
  if (database !== ALLOWED_TEST_DB_NAME) {
    return {
      valid: false,
      error: `Target database "${database}" is rejected. Test execution must strictly target "${ALLOWED_TEST_DB_NAME}".`,
    };
  }

  return {
    valid: true,
    safeConfig: {
      host: trimmedHost,
      port,
      database,
      user,
      password: String(password),
    },
  };
}

/**
 * Asserts database target safety. Throws a descriptive error if validation fails.
 * Never leaks passwords or secrets.
 *
 * @param {Object} [config]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ host: string, port: number, database: string, user: string, password?: string }}
 */
function assertTestDatabaseSafety(config, env = process.env) {
  const result = validateTestDatabaseTarget(config, env);
  if (!result.valid) {
    const errorMsg = `[DATABASE SAFETY REFUSAL] ${result.error}`;
    const err = new Error(errorMsg);
    err.name = 'DatabaseSafetyError';
    throw err;
  }
  return result.safeConfig;
}

/**
 * Helper to parse a KEY=VALUE env file into a key-value dictionary.
 */
function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      result[k] = v;
    }
  }
  return result;
}

/**
 * Safely loads test environment settings without exposing production credentials.
 * Priority:
 *   1. Existing process.env
 *   2. .env.test.local (dedicated ignored test file)
 *   3. Safe fallback to .env.local ONLY if target is explicitly verified loopback + dearr_test
 *
 * Never injects remote or production database credentials from .env.local into test processes.
 * Fail closed: rejects explicit DEARR_TEST_MODE=false or NODE_ENV=production before changing environment variables.
 *
 * @param {Object} [options]
 * @param {boolean} [options.skipAssert=false]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} [options.testEnvPath]
 * @param {string} [options.localEnvPath]
 */
function loadTestEnvironment(options = {}) {
  const env = options.env || process.env;
  const cwd = process.cwd();
  const testEnvPath = options.testEnvPath || path.resolve(cwd, '.env.test.local');
  const localEnvPath = options.localEnvPath || path.resolve(cwd, '.env.local');

  // 1. Contradictory check on existing environment BEFORE changing any environment variables
  const existingDearrTestMode = (env.DEARR_TEST_MODE || '').trim().toLowerCase();
  if (existingDearrTestMode === 'false') {
    const err = new Error(
      '[DATABASE SAFETY REFUSAL] Contradictory environment configuration: DEARR_TEST_MODE is explicitly disabled ("false").'
    );
    err.name = 'DatabaseSafetyError';
    throw err;
  }

  const existingNodeEnv = (env.NODE_ENV || '').trim().toLowerCase();
  if (existingNodeEnv === 'production') {
    const err = new Error(
      '[DATABASE SAFETY REFUSAL] Contradictory environment configuration: NODE_ENV cannot be "production" during test execution.'
    );
    err.name = 'DatabaseSafetyError';
    throw err;
  }

  // 2. Inspect testEnvPath before applying variables or defaults
  let testVars = {};
  if (fs.existsSync(testEnvPath)) {
    testVars = parseEnvFile(testEnvPath);
    const fileDearrTestMode = (testVars.DEARR_TEST_MODE || '').trim().toLowerCase();
    if (fileDearrTestMode === 'false') {
      const err = new Error(
        `[DATABASE SAFETY REFUSAL] Contradictory environment configuration: "${path.basename(testEnvPath)}" explicitly disables test mode (DEARR_TEST_MODE="false").`
      );
      err.name = 'DatabaseSafetyError';
      throw err;
    }
    const fileNodeEnv = (testVars.NODE_ENV || '').trim().toLowerCase();
    if (fileNodeEnv === 'production') {
      const err = new Error(
        `[DATABASE SAFETY REFUSAL] Contradictory environment configuration: "${path.basename(testEnvPath)}" specifies NODE_ENV="production".`
      );
      err.name = 'DatabaseSafetyError';
      throw err;
    }
  }

  // 3. Apply variables from .env.test.local (or safe fallback to .env.local)
  if (fs.existsSync(testEnvPath)) {
    for (const [k, v] of Object.entries(testVars)) {
      if (!env[k]) {
        env[k] = v;
      }
    }
  } else if (fs.existsSync(localEnvPath)) {
    const localVars = parseEnvFile(localEnvPath);
    for (const [k, v] of Object.entries(localVars)) {
      if (k === 'DEARR_TEST_MODE' || k === 'NODE_ENV') {
        const val = (v || '').trim().toLowerCase();
        if (val === 'false' || val === 'production') {
          const err = new Error(
            `[DATABASE SAFETY REFUSAL] Contradictory environment configuration: "${path.basename(localEnvPath)}" specifies ${k}="${v}".`
          );
          err.name = 'DatabaseSafetyError';
          throw err;
        }
      }
      if (k.startsWith('DB_')) {
        const localHost = (localVars.DB_HOST || '').trim().toLowerCase();
        const localDb = (localVars.DB_NAME || '').trim();
        if (ALLOWED_LOOPBACK_HOSTS.includes(localHost) && localDb === ALLOWED_TEST_DB_NAME) {
          if (!env[k]) {
            env[k] = v;
          }
        }
      } else {
        if (!env[k]) {
          env[k] = v;
        }
      }
    }
  }

  // 4. Apply test-mode defaults ONLY when no contradictory configuration exists
  if (!env.DEARR_TEST_MODE) {
    env.DEARR_TEST_MODE = 'true';
  }
  if (!env.NODE_ENV) {
    env.NODE_ENV = 'test';
  }

  // 5. Final safety assertion
  if (!options.skipAssert) {
    assertTestDatabaseSafety(undefined, env);
  }
}

/**
 * Creates a verified safe connection to the test database.
 * Double-checks database name via SELECT DATABASE() runtime query.
 *
 * @param {any} mysqlModule
 * @param {Object} [overrideConfig]
 */
async function createSafeTestConnection(mysqlModule, overrideConfig) {
  const safeConfig = assertTestDatabaseSafety(overrideConfig);
  const conn = await mysqlModule.createConnection(safeConfig);
  try {
    const [rows] = await conn.query('SELECT DATABASE() as db, @@port as port');
    const connectedDb = rows && rows[0] && rows[0].db;
    if (connectedDb !== ALLOWED_TEST_DB_NAME) {
      await conn.end();
      throw new Error(
        `[DATABASE SAFETY REFUSAL] Connected database "${connectedDb}" does not match authorized test database "${ALLOWED_TEST_DB_NAME}". Connection aborted.`
      );
    }
    return conn;
  } catch (err) {
    try { await conn.end(); } catch (_) {}
    throw err;
  }
}

/**
 * Creates a verified safe connection pool to the test database.
 *
 * @param {any} mysqlModule
 * @param {Object} [overrideConfig]
 */
function createSafeTestPool(mysqlModule, overrideConfig) {
  const safeConfig = assertTestDatabaseSafety(overrideConfig);
  return mysqlModule.createPool({
    ...safeConfig,
    waitForConnections: true,
    connectionLimit: (overrideConfig && overrideConfig.connectionLimit) || 5,
  });
}

module.exports = {
  ALLOWED_LOOPBACK_HOSTS,
  ALLOWED_TEST_DB_NAME,
  validateTestDatabaseTarget,
  assertTestDatabaseSafety,
  loadTestEnvironment,
  createSafeTestConnection,
  createSafeTestPool,
};
