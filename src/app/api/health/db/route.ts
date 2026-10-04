import { NextResponse } from "next/server";
import { testDbConnection, getDbConfig } from "@/lib/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/db
 * Server-side health check for Hostinger MySQL connection.
 * Executes a minimal query (SELECT 1 AS ok) and returns a safe JSON response.
 * Credentials and internal connection strings are NEVER returned in response.
 */
export async function GET() {
  try {
    // 1. Verify required database environment variables exist
    try {
      getDbConfig();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          database: "mysql",
          error: "Database configuration is incomplete or missing",
        },
        { status: 503 }
      );
    }

    // 2. Acquire a connection from the pool and test query
    const result = await testDbConnection();

    if (result.ok) {
      return NextResponse.json(
        {
          ok: true,
          database: "mysql",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        database: "mysql",
        error: "Database connection failed",
      },
      { status: 503 }
    );
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Unexpected database health check failure";
    console.error("[Health Check DB Error]", errorMsg);

    return NextResponse.json(
      {
        ok: false,
        database: "mysql",
        error: "Internal database service error",
      },
      { status: 500 }
    );
  }
}
