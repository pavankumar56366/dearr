/**
 * Dearr V1 Search UI Mock & Static Data — 3D Printing Storefront
 * Source of Truth: docs/4.DESIGN(1) (1).md & src/data/sample-products.ts
 *
 * Replaces generic gifting / hamper data with genuine 3D printing search content.
 */

export interface PopularSearchItem {
  id: string;
  query: string;
}

export interface CategorySearchItem {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface TrendingSearchItem {
  id: string;
  title: string;
  ctaText: string;
  category: string;
  href: string;
  image: string;
  price: number;
}

export const POPULAR_SEARCHES: PopularSearchItem[] = [
  { id: "1", query: "Radha Krishna" },
  { id: "2", query: "Ganesha idol" },
  { id: "3", query: "articulated dragon" },
  { id: "4", query: "lithophane lamp" },
  { id: "5", query: "custom keychains" },
  { id: "6", query: "desk organizers" },
];

export const SEARCH_CATEGORIES: CategorySearchItem[] = [
  { id: "1", name: "Spiritual Idols", slug: "spiritual-idols", count: 5 },
  { id: "2", name: "Articulated & Toys", slug: "articulated-toys", count: 3 },
  { id: "3", name: "Custom Keychains", slug: "custom-keychains", count: 2 },
  { id: "4", name: "Desk Organizers", slug: "desk-organizers", count: 1 },
  { id: "5", name: "Lithophane Lamps", slug: "lithophane-lamps", count: 1 },
  { id: "6", name: "Miniatures & Decor", slug: "miniatures-decor", count: 1 },
];

export const TRENDING_PRODUCTS: TrendingSearchItem[] = [
  {
    id: "t1",
    title: "Radha Krishna Figurine (12.5cm)",
    ctaText: "view creation →",
    category: "Spiritual Idols",
    href: "/product/3d-printed-radha-krishna-figurine-12-5cm",
    image: "/product-samples/1.jpeg",
    price: 1499,
  },
  {
    id: "t2",
    title: "Golden Ganesha Devotional Idol",
    ctaText: "view creation →",
    category: "Spiritual Idols",
    href: "/product/3d-printed-golden-ganesha-idol",
    image: "/product-samples/2.jpeg",
    price: 1299,
  },
  {
    id: "t3",
    title: "Articulated Crystal Dragon",
    ctaText: "view creation →",
    category: "Articulated & Toys",
    href: "/product/articulated-dragon-with-egg-container",
    image: "/product-samples/4.jpeg",
    price: 899,
  },
  {
    id: "t4",
    title: "Spherical Moon Lithophane Lamp",
    ctaText: "view creation →",
    category: "Lithophane Lamps",
    href: "/product/spherical-moon-lithophane-lamp-with-wooden-base",
    image: "/product-samples/5.jpeg",
    price: 2199,
  },
];

export const RECENT_SEARCHES: string[] = [
  "Radha Krishna",
  "articulated dragon",
  "Ganesha",
];
