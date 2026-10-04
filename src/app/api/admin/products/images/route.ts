import { NextResponse } from "next/server";
import {
  requireAdmin,
  handleAuthError,
  saveProductImage,
  deleteProductImage,
  StorageError,
} from "@/lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/products/images
 * Uploads a product image to public/uploads/products/.
 *
 * Security Requirements:
 * - Admin/founder authorization strictly enforced via requireAdmin() (401 unauth, 403 customer).
 * - Accepts multipart/form-data.
 * - Enforces magic bytes verification, format whitelist (JPEG, PNG, WebP), and <= 5 MB size limit.
 * - Generates collision-resistant unique filename (<uuid>.<ext>).
 * - Returns sanitized public URL, never exposing internal server paths.
 */
export async function POST(request: Request) {
  try {
    // Assert administrator privileges
    await requireAdmin();

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Failed to parse multipart form data" },
        { status: 400 }
      );
    }

    // Accept file from 'file' or 'image' field
    const file = (formData.get("file") || formData.get("image")) as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "No image file provided in 'file' or 'image' field" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save image with full validation
    const stored = await saveProductImage(buffer, file.name, file.type);

    return NextResponse.json(
      {
        ok: true,
        image: {
          url: stored.url,
          filename: stored.filename,
          size: stored.size,
          mimeType: stored.mimeType,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof StorageError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to upload product image");
  }
}

/**
 * DELETE /api/admin/products/images
 * Deletes a previously uploaded product image from public/uploads/products/.
 *
 * Security Requirements:
 * - Admin/founder authorization strictly enforced via requireAdmin() (401 unauth, 403 customer).
 * - Path traversal defense: Confined exclusively within public/uploads/products/.
 * - Accepts JSON payload { filename: "..." } or { url: "/uploads/products/..." }, or query params.
 */
export async function DELETE(request: Request) {
  try {
    // Assert administrator privileges
    await requireAdmin();

    let identifier: string | null = null;

    // Check query parameters first
    const { searchParams } = new URL(request.url);
    const queryFilename = searchParams.get("filename") || searchParams.get("url") || searchParams.get("path");

    if (queryFilename) {
      identifier = queryFilename;
    } else {
      // Try parsing JSON body
      try {
        const body = await request.json();
        identifier = body.filename || body.url || body.path || null;
      } catch {
        // Request had no JSON body
      }
    }

    if (!identifier || typeof identifier !== "string" || identifier.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "Image identifier (filename or url) is required" },
        { status: 400 }
      );
    }

    const wasDeleted = await deleteProductImage(identifier);

    if (!wasDeleted) {
      return NextResponse.json(
        { ok: false, error: "Image file not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Image deleted successfully",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof StorageError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return handleAuthError(err, "Failed to delete product image");
  }
}
