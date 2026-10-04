import { getAllAdminProducts } from "./admin-catalog";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  isActive: boolean;
  productCount?: number;
  activeProductCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryMetrics {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  productsWithoutCategory: number;
}

export const BASE_CATEGORIES: AdminCategory[] = [
  {
    id: "cat-spiritual",
    name: "Spiritual Idols",
    slug: "spiritual-idols",
    icon: "🪔",
    description: "Intricately detailed 3D printed devotional sculptures & sacred deities",
    isActive: true,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "cat-articulated",
    name: "Articulated & Toys",
    slug: "articulated-toys",
    icon: "🧩",
    description: "Poseable jointed characters and physics center-of-gravity desk toys",
    isActive: true,
    createdAt: "2026-01-16T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "cat-keychains",
    name: "Custom Keychains",
    slug: "custom-keychains",
    icon: "🔑",
    description: "Personalized vehicle replicas and textured 3D printed everyday carry",
    isActive: true,
    createdAt: "2026-01-18T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "cat-organizers",
    name: "Desk Organizers",
    slug: "desk-organizers",
    icon: "✏️",
    description: "Creative functional pen cups, stands, and workspace accessories",
    isActive: true,
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "cat-lithophanes",
    name: "Lithophane Lamps",
    slug: "lithophane-lamps",
    icon: "💡",
    description: "Backlit 3D lithophane globes that reveal illuminated artwork when turned on",
    isActive: true,
    createdAt: "2026-01-22T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "cat-miniatures",
    name: "Miniatures & Decor",
    slug: "miniatures-decor",
    icon: "✨",
    description: "Knitted-texture faux-crochet figurines and unique shelf collectibles",
    isActive: true,
    createdAt: "2026-01-25T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
];

const STORAGE_KEY_CATEGORIES = "dearr_admin_categories";

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
 * Retrieve all admin categories, merging base dataset with session demo overrides
 * and enriching with live product counts from getAllAdminProducts().
 */
export function getAllAdminCategories(): AdminCategory[] {
  let categories: AdminCategory[] = [...BASE_CATEGORIES];

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (stored) {
        const parsed = safeParseJSON<AdminCategory[]>(stored, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          categories = parsed;
        }
      }
    } catch (err) {
      console.warn("Failed to read admin categories from session:", err);
    }
  }

  // Calculate live product counts for each category
  const products = getAllAdminProducts();

  return categories.map((cat) => {
    const matchingProducts = products.filter(
      (p) =>
        p.categorySlug === cat.slug ||
        p.category.toLowerCase().trim() === cat.name.toLowerCase().trim()
    );
    const activeProducts = matchingProducts.filter((p) => p.isActive);

    return {
      ...cat,
      productCount: matchingProducts.length,
      activeProductCount: activeProducts.length,
    };
  });
}

/**
 * Find an admin category by its URL slug across base and session data.
 */
export function getAdminCategoryBySlug(slug: string): AdminCategory | null {
  const all = getAllAdminCategories();
  return all.find((c) => c.slug === slug) || null;
}

/**
 * Persist a newly created category into session storage.
 */
export function saveAdminCategory(category: AdminCategory): void {
  if (typeof window === "undefined") return;

  try {
    const current = getAllAdminCategories().map(({ productCount, activeProductCount, ...rest }) => rest);
    const exists = current.some((c) => c.id === category.id || c.slug === category.slug);

    let updated: AdminCategory[];
    if (exists) {
      updated = current.map((c) => (c.id === category.id ? category : c));
    } else {
      updated = [category, ...current];
    }

    sessionStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save admin category:", err);
  }
}

/**
 * Update an existing category in session storage.
 */
export function updateAdminCategory(updatedCategory: AdminCategory): void {
  if (typeof window === "undefined") return;

  try {
    const current = getAllAdminCategories().map(({ productCount, activeProductCount, ...rest }) => rest);
    const index = current.findIndex((c) => c.id === updatedCategory.id || c.slug === updatedCategory.slug);

    let updated: AdminCategory[];
    if (index !== -1) {
      updated = [...current];
      updated[index] = {
        ...updatedCategory,
        updatedAt: new Date().toISOString(),
      };
    } else {
      updated = [updatedCategory, ...current];
    }

    sessionStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to update admin category:", err);
  }
}

/**
 * Toggle active/inactive status of a category.
 */
export function toggleAdminCategoryStatus(categoryId: string): {
  success: boolean;
  newStatus: boolean;
  affectedProductCount: number;
} {
  if (typeof window === "undefined") {
    return { success: false, newStatus: false, affectedProductCount: 0 };
  }

  try {
    const all = getAllAdminCategories();
    const target = all.find((c) => c.id === categoryId);
    if (!target) {
      return { success: false, newStatus: false, affectedProductCount: 0 };
    }

    const newStatus = !target.isActive;
    const cleanList = all.map(({ productCount, activeProductCount, ...rest }) => {
      if (rest.id === categoryId) {
        return {
          ...rest,
          isActive: newStatus,
          updatedAt: new Date().toISOString(),
        };
      }
      return rest;
    });

    sessionStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(cleanList));

    return {
      success: true,
      newStatus,
      affectedProductCount: target.productCount || 0,
    };
  } catch (err) {
    console.warn("Failed to toggle admin category status:", err);
    return { success: false, newStatus: false, affectedProductCount: 0 };
  }
}

/**
 * Calculate summary metrics for admin categories dashboard.
 */
export function getCategoryMetrics(): CategoryMetrics {
  const categories = getAllAdminCategories();
  const products = getAllAdminProducts();

  const totalCategories = categories.length;
  const activeCategories = categories.filter((c) => c.isActive).length;
  const inactiveCategories = totalCategories - activeCategories;

  const knownSlugs = new Set(categories.map((c) => c.slug.toLowerCase()));
  const knownNames = new Set(categories.map((c) => c.name.toLowerCase()));

  const productsWithoutCategory = products.filter(
    (p) =>
      !knownSlugs.has(p.categorySlug?.toLowerCase()) &&
      !knownNames.has(p.category?.toLowerCase())
  ).length;

  return {
    totalCategories,
    activeCategories,
    inactiveCategories,
    productsWithoutCategory,
  };
}

/**
 * Storefront alias: returns only active categories.
 */
export function getStorefrontCategories(): AdminCategory[] {
  return getAllAdminCategories().filter((c) => c.isActive);
}
