import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/**
 * Discovers and resolves the physical file path for an uploaded product image
 * across current version, persistent shared storage, and prior deployment versions.
 */
function findImageFile(filename: string): string | null {
  const currentUploadDir = path.resolve(process.cwd(), "public", "uploads", "products");
  const currentTarget = path.join(currentUploadDir, filename);
  if (fs.existsSync(currentTarget)) {
    return currentTarget;
  }

  // Candidate locations across Hostinger standalone filesystem
  const candidateDirs: string[] = [
    // Shared persistent storage outside ephemeral deployment folder
    path.resolve(process.cwd(), "..", "..", "..", "shared_uploads", "products"),
    path.resolve(process.cwd(), "..", "..", "..", "uploads", "products"),
    path.resolve(process.cwd(), "..", "..", "..", "public_html", "uploads", "products"),
    path.resolve(process.cwd(), "..", "..", "..", "public_html"),
    path.resolve(process.cwd(), "..", "..", "source", "repository", "public", "uploads", "products"),
  ];

  for (const dir of candidateDirs) {
    try {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore unreadable dirs
    }
  }

  // Search prior deployment version folders under ../../versions
  try {
    const versionsDir = path.resolve(process.cwd(), "..", "..");
    if (fs.existsSync(versionsDir)) {
      const entries = fs.readdirSync(versionsDir);
      for (const entry of entries) {
        const candidate = path.join(versionsDir, entry, "nodejs", "public", "uploads", "products", filename);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * GET /uploads/products/[filename]
 * Serves uploaded product images directly with correct MIME type, cache headers,
 * and automatic synchronization to the current standalone version and shared storage.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Strict filename sanitize: UUID/hash format, prevent path traversal
  if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename) || filename.includes("..")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const foundPath = findImageFile(filename);
  if (!foundPath) {
    return new NextResponse("Image not found", { status: 404 });
  }

  try {
    const fileBuffer = await fs.promises.readFile(foundPath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    // Replicate into current version public/uploads/products and shared storage for instant subsequent serving
    const currentUploadDir = path.resolve(process.cwd(), "public", "uploads", "products");
    const currentTarget = path.join(currentUploadDir, filename);
    if (foundPath !== currentTarget) {
      try {
        await fs.promises.mkdir(currentUploadDir, { recursive: true });
        await fs.promises.writeFile(currentTarget, fileBuffer);
      } catch {
        // non-blocking
      }
    }

    const sharedDir = path.resolve(process.cwd(), "..", "..", "..", "shared_uploads", "products");
    const sharedTarget = path.join(sharedDir, filename);
    if (foundPath !== sharedTarget) {
      try {
        await fs.promises.mkdir(sharedDir, { recursive: true });
        await fs.promises.writeFile(sharedTarget, fileBuffer);
      } catch {
        // non-blocking
      }
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[Serve Image Error]", err);
    return new NextResponse("Error reading image", { status: 500 });
  }
}
