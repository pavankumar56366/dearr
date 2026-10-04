/**
 * Dearr V1 Home Page Mock Data
 * Source of Truth: docs/4.DESIGN(1) (1).md, docs/1.PRD(1).md
 * This file provides static mock data for the Customer Home Page.
 * It will be replaced by real database queries in later tasks.
 */

export interface MockProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  category: string;
  imageEmoji: string;
  rating: number;
  reviewCount: number;
  isNew?: boolean;
  isBestseller?: boolean;
}

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  productCount: number;
}

export interface MockPromotion {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export const MOCK_CATEGORIES: MockCategory[] = [
  { id: "c1", name: "Gift Hampers", slug: "gift-hampers", emoji: "🎁", productCount: 48 },
  { id: "c2", name: "Personalized", slug: "personalized", emoji: "✨", productCount: 36 },
  { id: "c3", name: "Chocolates", slug: "chocolates", emoji: "🍫", productCount: 24 },
  { id: "c4", name: "Home Decor", slug: "home-decor", emoji: "🏠", productCount: 32 },
  { id: "c5", name: "Candles", slug: "candles", emoji: "🕯️", productCount: 18 },
  { id: "c6", name: "Flowers", slug: "flowers", emoji: "💐", productCount: 20 },
  { id: "c7", name: "Keepsakes", slug: "keepsakes", emoji: "💝", productCount: 15 },
  { id: "c8", name: "Cards", slug: "cards", emoji: "💌", productCount: 28 },
];

// ─── Featured Products ──────────────────────────────────────────────────────

export const FEATURED_PRODUCTS: MockProduct[] = [
  {
    id: "p1",
    name: "Artisan Celebration Hamper",
    slug: "artisan-celebration-hamper",
    price: 1499,
    originalPrice: 1999,
    discountPercent: 25,
    category: "Gift Hampers",
    imageEmoji: "🎁",
    rating: 4.8,
    reviewCount: 124,
    isBestseller: true,
  },
  {
    id: "p2",
    name: "Custom Engraved Wooden Frame",
    slug: "custom-engraved-wooden-frame",
    price: 899,
    originalPrice: 1199,
    discountPercent: 25,
    category: "Personalized",
    imageEmoji: "🖼️",
    rating: 4.6,
    reviewCount: 89,
    isNew: true,
  },
  {
    id: "p3",
    name: "Premium Chocolate Trunk Box",
    slug: "premium-chocolate-trunk-box",
    price: 749,
    originalPrice: null,
    discountPercent: null,
    category: "Chocolates",
    imageEmoji: "🍫",
    rating: 4.9,
    reviewCount: 203,
    isBestseller: true,
  },
  {
    id: "p4",
    name: "Handcrafted Aroma Candle Set",
    slug: "handcrafted-aroma-candle-set",
    price: 599,
    originalPrice: 799,
    discountPercent: 25,
    category: "Candles",
    imageEmoji: "🕯️",
    rating: 4.5,
    reviewCount: 67,
  },
  {
    id: "p5",
    name: "Luxury Rose Bouquet",
    slug: "luxury-rose-bouquet",
    price: 1299,
    originalPrice: 1599,
    discountPercent: 19,
    category: "Flowers",
    imageEmoji: "🌹",
    rating: 4.7,
    reviewCount: 156,
    isNew: true,
  },
  {
    id: "p6",
    name: "Personalized Photo Album",
    slug: "personalized-photo-album",
    price: 999,
    originalPrice: null,
    discountPercent: null,
    category: "Keepsakes",
    imageEmoji: "📸",
    rating: 4.4,
    reviewCount: 42,
  },
];

// ─── Popular / Best Sellers ─────────────────────────────────────────────────

export const POPULAR_PRODUCTS: MockProduct[] = [
  {
    id: "p7",
    name: "Dry Fruit Gift Basket",
    slug: "dry-fruit-gift-basket",
    price: 1199,
    originalPrice: 1499,
    discountPercent: 20,
    category: "Gift Hampers",
    imageEmoji: "🧺",
    rating: 4.7,
    reviewCount: 178,
    isBestseller: true,
  },
  {
    id: "p8",
    name: "Ceramic Couple Mugs Set",
    slug: "ceramic-couple-mugs-set",
    price: 649,
    originalPrice: 849,
    discountPercent: 24,
    category: "Home Decor",
    imageEmoji: "☕",
    rating: 4.5,
    reviewCount: 93,
  },
  {
    id: "p9",
    name: "Scented Soy Candle Trio",
    slug: "scented-soy-candle-trio",
    price: 499,
    originalPrice: null,
    discountPercent: null,
    category: "Candles",
    imageEmoji: "🕯️",
    rating: 4.3,
    reviewCount: 54,
  },
  {
    id: "p10",
    name: "Handmade Leather Journal",
    slug: "handmade-leather-journal",
    price: 799,
    originalPrice: 999,
    discountPercent: 20,
    category: "Keepsakes",
    imageEmoji: "📖",
    rating: 4.6,
    reviewCount: 112,
    isBestseller: true,
  },
  {
    id: "p11",
    name: "Birthday Explosion Box",
    slug: "birthday-explosion-box",
    price: 1099,
    originalPrice: 1399,
    discountPercent: 21,
    category: "Personalized",
    imageEmoji: "🎉",
    rating: 4.8,
    reviewCount: 87,
    isNew: true,
  },
  {
    id: "p12",
    name: "Premium Gift Card Set",
    slug: "premium-gift-card-set",
    price: 349,
    originalPrice: null,
    discountPercent: null,
    category: "Cards",
    imageEmoji: "💌",
    rating: 4.2,
    reviewCount: 38,
  },
];

// ─── Promotion ──────────────────────────────────────────────────────────────

export const HOME_PROMOTION: MockPromotion = {
  id: "promo1",
  title: "Celebrate Every Moment",
  subtitle: "Up to 30% off on curated gift hampers & personalized keepsakes. Make every occasion unforgettable.",
  ctaText: "Shop the Sale",
  ctaHref: "/shop?promo=celebrate",
};

// ─── Trust / Benefits ───────────────────────────────────────────────────────

export interface TrustBenefit {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const TRUST_BENEFITS: TrustBenefit[] = [
  {
    id: "tb1",
    icon: "🎁",
    title: "Gift-Ready Packaging",
    description: "Every order wrapped with love",
  },
  {
    id: "tb2",
    icon: "🚚",
    title: "Nationwide Delivery",
    description: "We deliver across India",
  },
  {
    id: "tb3",
    icon: "✨",
    title: "Handpicked Quality",
    description: "Curated with care",
  },
  {
    id: "tb4",
    icon: "💝",
    title: "Personal Touch",
    description: "Custom messages & engraving",
  },
];
