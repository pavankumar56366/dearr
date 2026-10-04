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
  wishlistCount: 4,
  cartCount: 5,
  cartTotal: "₹230.00",
  isLoggedIn: false,
};

/**
 * Initial curated 3D-printing categories for the "Shop by Category" dropdown
 */
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "all", name: "All 3D Prints", slug: "all" },
  { id: "spiritual", name: "Spiritual Idols", slug: "spiritual-idols" },
  { id: "articulated", name: "Articulated & Toys", slug: "articulated-toys" },
  { id: "keychains", name: "Custom Keychains", slug: "custom-keychains" },
  { id: "organizers", name: "Desk Organizers", slug: "desk-organizers" },
  { id: "lithophanes", name: "Lithophane Lamps", slug: "lithophane-lamps" },
  { id: "miniatures", name: "Miniatures & Decor", slug: "miniatures-decor" },
];
