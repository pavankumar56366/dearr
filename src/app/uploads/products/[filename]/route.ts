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
    path.resolve(process.cwd(), "..", "..", "..", "shared_uploads", "products"),
    path.resolve(process.cwd(), "..", "..", "..", "uploads", "products"),
    path.resolve(process.cwd(), "..", "..", "..", "public_html", "uploads", "products"),
    path.resolve(process.cwd(), "..", "..", "source", "repository", "public", "uploads", "products"),
    "/home/u209580425/domains/dearr.in/shared_uploads/products",
    "/home/u209580425/domains/dearr.in/uploads/products",
    "/home/u209580425/domains/dearr.in/public_html/uploads/products",
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

  // Search all deployment version folders under hbuilds/versions/<version_uuid>/nodejs/public/uploads/products/
  const possibleVersionsDirs = [
    path.resolve(process.cwd(), "..", "..", "versions"),
    path.resolve(process.cwd(), "..", "versions"),
    "/home/u209580425/domains/dearr.in/hbuilds/versions",
  ];

  for (const vDir of possibleVersionsDirs) {
    try {
      if (fs.existsSync(vDir)) {
        const entries = fs.readdirSync(vDir);
        for (const entry of entries) {
          const candidate1 = path.join(vDir, entry, "nodejs", "public", "uploads", "products", filename);
          if (fs.existsSync(candidate1)) {
            return candidate1;
          }
          const candidate2 = path.join(vDir, entry, "public", "uploads", "products", filename);
          if (fs.existsSync(candidate2)) {
            return candidate2;
          }
        }
      }
    } catch {
      // ignore
    }
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
    const url = new URL(_request.url);
    if (url.searchParams.get("debug") === "1") {
      let versionsList: any = null;
      try {
        versionsList = fs.readdirSync("/home/u209580425/domains/dearr.in/hbuilds/versions");
      } catch (e: any) {
        versionsList = e.message;
      }
      let currentUploads: any = null;
      try {
        currentUploads = fs.readdirSync(path.resolve(process.cwd(), "public", "uploads", "products"));
      } catch (e: any) {
        currentUploads = e.message;
      }
      let parentListing: any = null;
      try {
        parentListing = fs.readdirSync(path.resolve(process.cwd(), "..", ".."));
      } catch (e: any) {
        parentListing = e.message;
      }
      return NextResponse.json(
        {
          cwd: process.cwd(),
          versionsList,
          currentUploads,
          parentListing,
        },
        { status: 404 }
      );
    }
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
