const { loadTestEnvironment, assertTestDatabaseSafety } = require('./test-db-safety.cjs');

// 1. Mock 'server-only' so test runners and standalone Node processes can import server components
try {
  const p = require.resolve('server-only');
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {
  // If resolution fails before module install, fallback gracefully
}

// 2. Safe Test Environment Loader & Hardened Pre-Flight Safeguard
// Prefers .env.test.local, fails closed against remote hosts, production database names,
// missing test mode, and invalid configuration before database connections or mutations can occur.
try {
  loadTestEnvironment();
  assertTestDatabaseSafety();
} catch (err) {
  // Fail closed immediately: abort execution before any tests run
  console.error('[DATABASE SAFETY ABORT]', err.message);
  process.exit(1);
}
