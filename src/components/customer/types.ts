/**
 * Customer Navbar Types and Static Placeholder Defaults
 * Safely isolated for later integration with real cart, wishlist, and auth state.
 */

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface NavbarData {
  wishlistCount: number;
  cartCount: number;
  cartTotal: string;
  isLoggedIn?: boolean;
  userName?: string;
}

/**
 * Static placeholder values matching the visual references
 * (wishlist count: 4, cart count: 5, cart total: ₹230.00)
 */
export const DEFAULT_NAVBAR_DATA: NavbarData = {
  wishlistCount: 0,
  cartCount: 0,
  cartTotal: "₹0.00",
  isLoggedIn: false,
};

/**
 * Initial curated 3D-printing categories for the "Shop by Category" dropdown
 */
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "all", name: "All 3D Prints", slug: "all" },
  { id: "devotional", name: "Devotional & Idols", slug: "devotional" },
  { id: "keychain", name: "Custom Keychains", slug: "keychain" },
  { id: "curio", name: "Articulated & Curios", slug: "curio" },
  { id: "night-lamp", name: "Night Lamps", slug: "night-lamp" },
  { id: "name-plate", name: "Name Plates", slug: "name-plate" },
  { id: "lithophane-panel", name: "Lithophanes", slug: "lithophane-panel" },
  { id: "desktop-accessory", name: "Desktop Accessories", slug: "desktop-accessory" },
  { id: "teddy-bear", name: "Teddy Bears", slug: "teddy-bear" },
  { id: "litho-keychain", name: "Litho Keychains", slug: "litho-keychain" },
  { id: "photo-figurine", name: "Photo Figurines", slug: "photo-figurine" },
  { id: "wall-art", name: "Wall Art", slug: "wall-art" },
  { id: "other", name: "More Gifts", slug: "other" },
];
