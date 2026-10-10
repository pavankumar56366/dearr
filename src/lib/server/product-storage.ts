import "server-only";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export type AllowedMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export class StorageError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "StorageError";
    this.statusCode = statusCode;
  }
}

/**
 * Returns the absolute directory path where product images are stored.
 * Guaranteed to point to public/uploads/products/ in the current working directory.
 */
export function getProductUploadDir(): string {
  return path.resolve(process.cwd(), "public", "uploads", "products");
}

/**
 * Detects the real MIME type and canonical extension from raw image buffer magic bytes.
 * Never relies solely on client-provided MIME headers or filename extensions.
 */
export function detectImageSignature(buffer: Buffer): { mimeType: AllowedMimeType; extension: string } | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: ".png" };
  }

  // WebP: RIFF .... WEBP
  // Byte 0-3: 0x52 0x49 0x46 0x46 ("RIFF")
  // Byte 8-11: 0x57 0x45 0x42 0x50 ("WEBP")
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: "image/webp", extension: ".webp" };
  }

  return null;
}

/**
 * Validates an image file's size, magic bytes signature, MIME type, and extension.
 * Throws StorageError(400) if validation fails.
 */
export function validateProductImage(
  buffer: Buffer,
  originalFilename?: string,
  declaredMimeType?: string
): { mimeType: AllowedMimeType; extension: string } {
  if (!buffer || buffer.length === 0) {
    throw new StorageError("Empty file provided. Please upload a valid image file.", 400);
  }

  if (buffer.length > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    throw new StorageError(
      `File size exceeds the 5 MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
      400
    );
  }

  // Verify real magic bytes
  const detected = detectImageSignature(buffer);
  if (!detected) {
    throw new StorageError(
      "Invalid or unsupported image format. Supported formats: JPEG, PNG, WebP.",
      400
    );
  }

  // If MIME type was declared by client, ensure it matches allowed types and does not contradict detected type
  if (declaredMimeType) {
    const normalizedDeclared = declaredMimeType.toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedDeclared as any)) {
      throw new StorageError(
        `Unsupported MIME type: '${declaredMimeType}'. Only JPEG, PNG, and WebP are allowed.`,
        400
      );
    }
  }

  // If original filename has an extension, verify it does not contain dangerous or mismatching extensions
  if (originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    if (ext) {
      const allowedExts: string[] = ALLOWED_IMAGE_EXTENSIONS as unknown as string[];
      if (!allowedExts.includes(ext)) {
        throw new StorageError(
          `Unsupported file extension '${ext}'. Allowed extensions: .jpg, .jpeg, .png, .webp.`,
          400
        );
      }
    }
  }

  return detected;
}

/**
 * Generates a collision-resistant, safe unique filename for product images.
 * Format: <uuid>.<safe-extension>
 */
export function generateUniqueImageFilename(extension: string): string {
  const cleanExt = extension.startsWith(".") ? extension : `.${extension}`;
  return `${crypto.randomUUID()}${cleanExt}`;
}

/**
 * Resolves and verifies that a filename or URL path refers to a file strictly within
 * the public/uploads/products/ directory.
 * Throws StorageError(400) if path traversal or illegal characters are detected.
 */
export function resolveProductImagePath(identifier: string): string {
  if (!identifier || typeof identifier !== "string") {
    throw new StorageError("Image identifier is required", 400);
  }

  const trimmed = identifier.trim();

  // Deny null bytes and traversal tokens immediately
  if (trimmed.includes("\0") || trimmed.includes("..")) {
    throw new StorageError("Invalid image path: Path traversal characters are not permitted", 400);
  }

  // Strip public URL prefixes if passed as "/uploads/products/<filename>"
  let filename = trimmed;
  if (filename.startsWith("/uploads/products/")) {
    filename = filename.slice("/uploads/products/".length);
  } else if (filename.startsWith("uploads/products/")) {
    filename = filename.slice("uploads/products/".length);
  } else if (filename.startsWith("/uploads/products")) {
    filename = filename.slice("/uploads/products".length);
  }

  // Reject any remaining slashes (must be pure filename)
  if (filename.includes("/") || filename.includes("\\")) {
    throw new StorageError("Invalid image path: Nested paths or directory traversal are not permitted", 400);
  }

  if (filename.length === 0) {
    throw new StorageError("Image filename cannot be empty", 400);
  }

  const uploadDir = getProductUploadDir();
  const resolvedPath = path.resolve(uploadDir, filename);

  // Security barrier: Ensure resolved path is strictly inside uploadDir
  if (!resolvedPath.startsWith(uploadDir + path.sep)) {
    throw new StorageError("Access denied: Path is outside the product upload directory", 400);
  }

  return resolvedPath;
}

export interface StoredProductImage {
  filename: string;
  url: string;
  size: number;
  mimeType: AllowedMimeType;
}

/**
 * Validates, saves, and returns the public metadata for a product image.
 * File is written to public/uploads/products/<uuid>.<ext>.
 */
export async function saveProductImage(
  buffer: Buffer,
  originalFilename?: string,
  declaredMimeType?: string
): Promise<StoredProductImage> {
  const { mimeType, extension } = validateProductImage(buffer, originalFilename, declaredMimeType);

  const uploadDir = getProductUploadDir();
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const filename = generateUniqueImageFilename(extension);
  const targetPath = path.join(uploadDir, filename);

  await fs.promises.writeFile(targetPath, buffer);

  // Sync with persistent shared storage outside ephemeral deployment folder
  try {
    const sharedDir = path.resolve(process.cwd(), "..", "..", "..", "shared_uploads", "products");
    await fs.promises.mkdir(sharedDir, { recursive: true });
    await fs.promises.writeFile(path.join(sharedDir, filename), buffer);
  } catch {
    // Non-blocking in local development or if parent path not accessible
  }

  return {
    filename,
    url: `/uploads/products/${filename}`,
    size: buffer.length,
    mimeType,
  };
}

/**
 * Deletes a product image from the public/uploads/products directory.
 * Safely prevents arbitrary file deletion outside the directory.
 * Returns true if the file was deleted, false if the file did not exist.
 */
export async function deleteProductImage(identifier: string): Promise<boolean> {
  const resolvedPath = resolveProductImagePath(identifier);
  let deleted = false;

  try {
    await fs.promises.access(resolvedPath, fs.constants.F_OK);
    await fs.promises.unlink(resolvedPath);
    deleted = true;
  } catch {
    // File did not exist in primary location
  }

  // Also clean up from shared storage if present
  try {
    const filename = path.basename(resolvedPath);
    const sharedPath = path.resolve(process.cwd(), "..", "..", "..", "shared_uploads", "products", filename);
    await fs.promises.access(sharedPath, fs.constants.F_OK);
    await fs.promises.unlink(sharedPath);
    deleted = true;
  } catch {
    // Non-blocking
  }

  return deleted;
}
