import fs from "fs";

function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

const rawCategories = JSON.parse(fs.readFileSync("scratch/hostinger_categories.json", "utf8"));
const rawProducts = JSON.parse(fs.readFileSync("scratch/hostinger_products.json", "utf8"));

const CATEGORY_META = {
  "TEDDY_BEAR": {
    slug: "teddy-bear",
    icon: "🧸",
    description: "Sculpted keepsake teddy bears and custom name-tagged plush companions",
  },
  "NIGHT_LAMP": {
    slug: "night-lamp",
    icon: "💡",
    description: "Softly glowing ambient moon lamps and backlit lithophane bedside lights",
  },
  "WALL_ART": {
    slug: "wall-art",
    icon: "🖼️",
    description: "Low-poly decorative accent panels and precision geometric vehicle wall art",
  },
  "NAME_PLATE": {
    slug: "name-plate",
    icon: "🏷️",
    description: "Personalized desk stands, CA professional nameplates, and custom door plates",
  },
  "KEYCHAIN": {
    slug: "keychain",
    icon: "🔑",
    description: "Custom name tags, automotive logos, superhero charms, and textured keychains",
  },
  "LITHOPHANE_PANEL": {
    slug: "lithophane-panel",
    icon: "✨",
    description: "High-resolution standing photo lithophane panels revealing memories when backlit",
  },
  "LITHO_KEYCHAIN": {
    slug: "litho-keychain",
    icon: "🔦",
    description: "Pocket-sized backlit photo lithophane keychains crafted to order",
  },
  "PHOTO_FIGURINE": {
    slug: "photo-figurine",
    icon: "👤",
    description: "Personalized full-color 3D mini-me keepsake figurines sculpted from your photos",
  },
  "DEVOTIONAL": {
    slug: "devotional",
    icon: "🪔",
    description: "Intricately detailed sacred sculptures, Krishna, Ganesha, Shiva, and divine shrines",
  },
  "CURIO": {
    slug: "curio",
    icon: "🐱",
    description: "Charming animal figurines, desktop curios, and collectible shelf miniatures",
  },
  "DESKTOP_ACCESSORY": {
    slug: "desktop-accessory",
    icon: "✏️",
    description: "Miniature hoodie pen cups, photo card stands, and workspace organizers",
  },
  "OTHER": {
    slug: "other",
    icon: "🎁",
    description: "Geometric planter pots, magnetic fridge decor sets, and custom trophies",
  },
};

const COLOR_HEX_MAP = {
  "Natural White": "#F8F9FA",
  "Charcoal Black": "#212529",
  "Blush Pink": "#F8B4D9",
  "Sage Green": "#829E85",
  "Warm White Glow": "#FFF3C4",
  "Cool White Glow": "#EDF2F7",
  "RGB Colour-Change": "#E2E8F0",
  "Gold Accent": "#D4AF37",
  "Silver Accent": "#C0C0C0",
  "Classic Bronze": "#8C6239",
};

// Build Categories list
const categories = rawCategories.map((c, idx) => {
  const meta = CATEGORY_META[c.slug] || {
    slug: c.slug.toLowerCase().replace(/_/g, "-"),
    icon: "🎁",
    description: `${c.name} precision 3D printed creations`,
  };
  return {
    id: `cat-${meta.slug}`,
    name: c.name,
    slug: meta.slug,
    rawSlug: c.slug,
    icon: meta.icon,
    description: meta.description,
    productCount: c.productCount,
    status: "confirmed",
  };
});

// Build Products list
const products = rawProducts.map((p, idx) => {
  const cleanName = decodeEntities(p.name);
  const cleanDesc = decodeEntities(p.description);
  const meta = CATEGORY_META[p.rawCategorySlug] || {
    slug: p.rawCategorySlug.toLowerCase().replace(/_/g, "-"),
    icon: "🎁",
    description: "",
  };

  // Color variants
  const colorItems = (p.colors || []).map((cName, cIdx) => ({
    id: `col-${p.slug}-${cIdx + 1}`,
    name: cName,
    slug: cName.toLowerCase().replace(/\s+/g, "-"),
    hex: COLOR_HEX_MAP[cName] || "#4A90E2",
    stock: 20,
    isActive: true,
  }));

  // Size variants
  const sizeVariants = (p.sizes || []).map((sName, sIdx) => {
    let delta = 0;
    const deltaMatch = sName.match(/\(\+₹(\d+)\)/);
    if (deltaMatch) {
      delta = parseInt(deltaMatch[1], 10);
    }
    const cleanPrefix = p.slug.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    return {
      id: `var-${p.slug}-${sIdx + 1}`,
      name: sName,
      sku: `SKU-${cleanPrefix}-${idx + 1}-S${sIdx + 1}`,
      price: p.price + delta,
      stockQuantity: 20,
      isActive: true,
    };
  });

  return {
    id: `sp-${String(idx + 1).padStart(2, "0")}`,
    name: cleanName,
    slug: p.slug,
    description: cleanDesc,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.image,
    images: p.images && p.images.length > 0 ? p.images : [p.image],
    category: p.category,
    categorySlug: meta.slug,
    rawCategorySlug: p.rawCategorySlug,
    badge: p.badge,
    leadTime: p.leadTime,
    isFeatured: idx < 12 || !!p.badge,
    isPopular: idx % 3 === 0,
    isActive: true,
    stockQuantity: 25,
    specifications: {
      material: "Eco-Friendly PLA Bioplastic",
      process: "High-Resolution FDM 3D Printing",
      finish: "Smooth Layered Finish",
      care: "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C).",
    },
    hasColors: colorItems.length > 0,
    colors: colorItems,
    variants: sizeVariants,
    codEnabled: true,
  };
});

const fileContent = `/**
 * Dearr V1 Complete Product Catalog — 3D Printing Catalog Foundation
 *
 * Scraped and synchronized directly from Hostinger production storefront:
 * https://purple-leopard-280444.hostingersite.com/shop
 *
 * Total Products: ${products.length}
 * Total Categories: ${categories.length}
 */

export interface SampleProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
}

export interface SampleProductSpecification {
  material?: string;
  process?: string;
  dimensions?: string;
  finish?: string;
  care?: string;
  customization?: string;
  weight?: string;
}

export interface SampleProductColor {
  id: string;
  name: string;
  slug: string;
  hex: string;
  sku?: string | null;
  stock: number;
  reservedStock?: number;
  availableStock?: number;
  priceOverride?: number | null;
  sortOrder?: number;
  isActive: boolean;
  images?: any[];
}

export interface SampleProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  images?: string[];
  category: string;
  categorySlug: string;
  rawCategorySlug?: string;
  badge?: string | null;
  leadTime?: string | null;
  isFeatured: boolean;
  isPopular: boolean;
  isActive: boolean;
  stockQuantity: number;
  specifications?: SampleProductSpecification;
  variants?: SampleProductVariant[];
  hasColors?: boolean;
  colors?: SampleProductColor[];
  codEnabled?: boolean;
}

export interface SampleCategory {
  id: string;
  name: string;
  slug: string;
  rawSlug?: string;
  icon: string;
  description: string;
  productCount: number;
  status: "confirmed" | "requires_confirmation";
}

export interface SamplePromotion {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
}

export interface TrustBenefit {
  id: string;
  icon: string;
  title: string;
  description: string;
}

// ─── 3D Printing Categories (${categories.length} Categories from Hostinger Storefront) ─────

export const SAMPLE_CATEGORIES: SampleCategory[] = ${JSON.stringify(categories, null, 2)};

// ─── All 3D Printed Products (${products.length} Items Scraped from Hostinger Storefront) ──

export const SAMPLE_PRODUCTS: SampleProduct[] = ${JSON.stringify(products, null, 2)};

// ─── Filtered Sets for Home Page ────────────────────────────────────────────

export const FEATURED_PRODUCTS: SampleProduct[] = SAMPLE_PRODUCTS.filter(
  (p) => p.isFeatured
);

export const POPULAR_PRODUCTS: SampleProduct[] = SAMPLE_PRODUCTS.filter(
  (p) => p.isPopular
);

// ─── Home Promotion (3D Printing Focus) ─────────────────────────────────────

export const HOME_PROMOTION: SamplePromotion = {
  id: "promo-3d-custom",
  title: "Bespoke 3D Printed Creations",
  subtitle:
    "From personalized car keychains to illuminated photo moon lamps. Precision crafted layer by layer, delivered across India.",
  ctaText: "Explore Collections",
  ctaHref: "/shop",
};

// ─── Trust / Value Propositions ─────────────────────────────────────────────

export const TRUST_BENEFITS: TrustBenefit[] = [
  {
    id: "tb-1",
    icon: "🖨️",
    title: "Precision 3D Printed",
    description: "High-resolution prints with smooth layer lines & rich detailing",
  },
  {
    id: "tb-2",
    icon: "✨",
    title: "Custom Personalization",
    description: "Personalized number plates, names, & backlit photo lithophanes",
  },
  {
    id: "tb-3",
    icon: "🌱",
    title: "Eco-Friendly PLA",
    description: "Crafted from durable, non-toxic, plant-based bioplastics",
  },
  {
    id: "tb-4",
    icon: "🚚",
    title: "Carefully Packaged",
    description: "Cushioned shockproof packaging delivered across India",
  },
];
`;

fs.writeFileSync("src/data/sample-products.ts", fileContent, "utf8");
console.log("Successfully generated src/data/sample-products.ts with 86 products and 12 categories!");

// Also copy to dearr-original if present
const origFile = "d:/Desktop/dearr-original/src/data/sample-products.ts";
if (fs.existsSync("d:/Desktop/dearr-original/src/data")) {
  fs.writeFileSync(origFile, fileContent, "utf8");
  console.log("Successfully synced to dearr-original/src/data/sample-products.ts!");
}
