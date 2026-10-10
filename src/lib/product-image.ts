/**
 * Product image normalization helpers.
 * Safe for use in both Server and Client Components (no server-only dependencies).
 */

export const DEFAULT_PRODUCT_FALLBACK_IMAGE = "/product-samples/1.jpeg";

function isSameOrigin(parsed: URL): boolean {
  if (typeof window !== "undefined" && window.location) {
    if (
      parsed.origin === window.location.origin ||
      parsed.hostname.toLowerCase() === window.location.hostname.toLowerCase()
    ) {
      return true;
    }
  }

  const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envAppUrl) {
    try {
      const appUrl = new URL(envAppUrl.startsWith("http") ? envAppUrl : `https://${envAppUrl}`);
      if (parsed.hostname.toLowerCase() === appUrl.hostname.toLowerCase()) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  const host = parsed.hostname.toLowerCase();
  return (
    host === "dearr.in" ||
    host === "www.dearr.in" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0"
  );
}

/**
 * Checks if an image source represents a runtime-uploaded product image
 * under /uploads/products/ (or /uploads/), including same-origin absolute URLs.
 * Returns true strictly for runtime upload paths so that they bypass
 * Next.js server optimization in standalone hosting.
 * Returns false for static assets, brand graphics, and unrelated external URLs.
 */
export function isUploadPath(src: unknown): boolean {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed) return false;

  // 1. Direct root-relative or relative upload paths
  if (
    trimmed.startsWith("/uploads/products/") ||
    trimmed.startsWith("uploads/products/") ||
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("uploads/")
  ) {
    return true;
  }

  // 2. Absolute URL with /uploads/products/ or /uploads/ pathname (strictly same-origin)
  try {
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("//")
    ) {
      const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
      const isUploadPathname =
        parsed.pathname.startsWith("/uploads/products/") ||
        parsed.pathname.startsWith("/uploads/");

      if (isUploadPathname && isSameOrigin(parsed)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Determines whether Next.js Image optimization should be bypassed.
 * Bypasses optimization for:
 * 1. Runtime-uploaded product images (isUploadPath)
 * 2. Legitimate preview URLs (blob: and data: URLs generated in client-side file previews)
 * Preserves normal optimization for static assets and remote external images.
 */
export function shouldBypassOptimization(src: unknown): boolean {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return true;
  }
  return isUploadPath(trimmed);
}

/**
 * Normalizes any image input (string URL, storage path, or image object)
 * into a valid, safe public URL string.
 */
export function normalizeImageUrl(
  imageInput: unknown,
  fallback = DEFAULT_PRODUCT_FALLBACK_IMAGE
): string {
  if (!imageInput) return fallback;

  let raw = "";

  if (typeof imageInput === "string") {
    raw = imageInput.trim();
  } else if (typeof imageInput === "object" && imageInput !== null) {
    const obj = imageInput as Record<string, unknown>;
    const candidate =
      (typeof obj.url === "string" && obj.url.trim() ? obj.url : null) ||
      (typeof obj.storagePath === "string" && obj.storagePath.trim() ? obj.storagePath : null) ||
      (typeof obj.storage_path === "string" && obj.storage_path.trim() ? obj.storage_path : null) ||
      (typeof obj.src === "string" && obj.src.trim() ? obj.src : null) ||
      (typeof obj.path === "string" && obj.path.trim() ? obj.path : null);
    if (typeof candidate === "string") {
      raw = candidate.trim();
    }
  }

  if (!raw) return fallback;

  // External URLs (http/https/data/protocol-relative) are kept intact
  if (/^(?:https?:|\/\/|data:)/i.test(raw)) {
    return raw;
  }

  // Ensure leading slash for root-relative static and upload paths
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/**
 * Extracts the primary display image URL for a product.
 * Checks product.images array (first item), product.image, product.primary_image, etc.
 */
export function getProductPrimaryImage(
  product: unknown,
  fallback = DEFAULT_PRODUCT_FALLBACK_IMAGE
): string {
  if (!product || typeof product !== "object") return fallback;

  const p = product as Record<string, unknown>;

  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    const normalized = normalizeImageUrl(first, "");
    if (normalized) return normalized;
  }

  if (p.image) {
    const normalized = normalizeImageUrl(p.image, "");
    if (normalized) return normalized;
  }

  if (p.primaryImage || p.primary_image) {
    const normalized = normalizeImageUrl(p.primaryImage || p.primary_image, "");
    if (normalized) return normalized;
  }

  return fallback;
}

/**
 * Extracts and normalizes the full gallery images list for a product.
 * Returns an array of normalized public URL strings.
 */
export function getProductGalleryImages(
  product: unknown,
  fallback = DEFAULT_PRODUCT_FALLBACK_IMAGE
): string[] {
  if (!product || typeof product !== "object") return [fallback];

  const p = product as Record<string, unknown>;
  const list: string[] = [];

  if (Array.isArray(p.images) && p.images.length > 0) {
    for (const item of p.images) {
      const url = normalizeImageUrl(item, "");
      if (url) list.push(url);
    }
  }

  if (list.length === 0) {
    const primary = getProductPrimaryImage(p, fallback);
    return [primary];
  }

  return list;
}
