import { SAMPLE_PRODUCTS, type SampleProduct } from "@/data/sample-products";

export type AdminProduct = SampleProduct;

const STORAGE_KEY_NEW = "dearr_admin_new_products";
const STORAGE_KEY_EDITED = "dearr_admin_edited_products";

function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value || typeof value !== "string" || !value.trim()) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Retrieve all admin products, merging default sample catalog with session demo-created
 * and demo-edited products.
 */
export function getAllAdminProducts(): SampleProduct[] {
  if (typeof window === "undefined") {
    return SAMPLE_PRODUCTS;
  }

  try {
    const editedMap: Record<string, SampleProduct> = {};
    const parsedEdited = safeParseJSON<Record<string, SampleProduct>>(
      sessionStorage.getItem(STORAGE_KEY_EDITED),
      {}
    );
    if (typeof parsedEdited === "object" && parsedEdited !== null) {
      Object.assign(editedMap, parsedEdited);
    }

    // Apply edits to sample products
    const baseProducts = SAMPLE_PRODUCTS.map((p) => editedMap[p.id] || p);

    // Get any newly created products
    const newProducts = safeParseJSON<SampleProduct[]>(
      sessionStorage.getItem(STORAGE_KEY_NEW),
      []
    );

    // Apply any edits to newly created products
    const mappedNew = newProducts.map((p) => editedMap[p.id] || p);

    // Merge, ensuring unique IDs
    const seenIds = new Set<string>();
    const result: SampleProduct[] = [];

    for (const p of mappedNew) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        result.push(p);
      }
    }

    for (const p of baseProducts) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        result.push(p);
      }
    }

    return result;
  } catch (err) {
    console.warn("Failed to retrieve admin session products:", err);
    return SAMPLE_PRODUCTS;
  }
}

/**
 * Find a product by its URL slug across sample data and session state.
 */
export function getAdminProductBySlug(slug: string): SampleProduct | null {
  const all = getAllAdminProducts();
  return all.find((p) => p.slug === slug) || null;
}

// Storefront aliases for semantic clarity across customer pages
export const getStorefrontProducts = getAllAdminProducts;
export const getStorefrontProductBySlug = getAdminProductBySlug;

/**
 * Persist an edited or updated product into session demo state.
 */
export function saveAdminProductEdit(updatedProduct: SampleProduct): void {
  if (typeof window === "undefined") return;

  try {
    // 1. If it's in new products list, update it in place
    const newProducts = safeParseJSON<SampleProduct[]>(
      sessionStorage.getItem(STORAGE_KEY_NEW),
      []
    );
    if (newProducts.length > 0) {
      const index = newProducts.findIndex((p) => p.id === updatedProduct.id);
      if (index !== -1) {
        newProducts[index] = updatedProduct;
        sessionStorage.setItem(STORAGE_KEY_NEW, JSON.stringify(newProducts));
      }
    }

    // 2. Also register in edited map
    const editedMap = safeParseJSON<Record<string, SampleProduct>>(
      sessionStorage.getItem(STORAGE_KEY_EDITED),
      {}
    );
    editedMap[updatedProduct.id] = updatedProduct;
    sessionStorage.setItem(STORAGE_KEY_EDITED, JSON.stringify(editedMap));
  } catch (err) {
    console.warn("Failed to save admin product edit:", err);
  }
}
