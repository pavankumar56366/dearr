import { SAMPLE_PRODUCTS, type SampleProduct } from "@/data/sample-products";

export type AdminProduct = SampleProduct;


/**
 * Retrieve admin products base catalog.
 * Note: Real admin product persistence is backed directly by Hostinger MySQL via /api/admin/products.
 * This helper provides fallback base catalog data when offline or during initial hydration.
 */
export function getAllAdminProducts(): SampleProduct[] {
  return SAMPLE_PRODUCTS;
}

/**
 * Find a product by its URL slug in the base catalog.
 */
export function getAdminProductBySlug(slug: string): SampleProduct | null {
  return SAMPLE_PRODUCTS.find((p) => p.slug === slug) || null;
}

// Storefront aliases for semantic clarity across customer pages
export const getStorefrontProducts = getAllAdminProducts;
export const getStorefrontProductBySlug = getAdminProductBySlug;

/**
 * @deprecated Product edits now persist directly to Hostinger MySQL via PATCH /api/admin/products/:id.
 */
export function saveAdminProductEdit(_updatedProduct: SampleProduct): void {
  // Obsolete: Admin product persistence is backed by MySQL via Product API.
}
