/**
 * Dearr V1 Sample Product Data — 3D Printing Catalog Foundation
 *
 * Source of Truth: public/product-samples/
 * This file replaces generic gifting mock data with actual 3D printed products
 * supplied in the local catalog.
 *
 * Data structure maps cleanly to MySQL schema defined in docs/5.SCHEMA(1).md:
 * - id -> products.id (char(36))
 * - name -> products.name (text)
 * - slug -> products.slug (text unique)
 * - description -> products.description (text)
 * - price -> products.price (decimal(10,2))
 * - compareAtPrice -> products.compare_at_price (decimal(10,2) nullable)
 * - image -> product image local public path
 * - category -> category name
 * - categorySlug -> category URL slug
 * - isFeatured -> products.is_featured (tinyint(1))
 * - isPopular -> storefront popular flag
 * - isActive -> products.is_active (tinyint(1))
 * - stockQuantity -> products.stock_quantity (int)
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
  isFeatured: boolean;
  isPopular: boolean;
  isActive: boolean;
  stockQuantity: number;
  specifications?: SampleProductSpecification;
  variants?: SampleProductVariant[];
}

export interface SampleCategory {
  id: string;
  name: string;
  slug: string;
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

// ─── 3D Printing Categories (Derived strictly from supplied assets) ───────────

export const SAMPLE_CATEGORIES: SampleCategory[] = [
  {
    id: "cat-spiritual",
    name: "Spiritual Idols",
    slug: "spiritual-idols",
    icon: "🪔",
    description: "Intricately detailed 3D printed devotional sculptures & sacred deities",
    productCount: 5,
    status: "confirmed",
  },
  {
    id: "cat-articulated",
    name: "Articulated & Toys",
    slug: "articulated-toys",
    icon: "🧩",
    description: "Poseable jointed characters and physics center-of-gravity desk toys",
    productCount: 3,
    status: "confirmed",
  },
  {
    id: "cat-keychains",
    name: "Custom Keychains",
    slug: "custom-keychains",
    icon: "🔑",
    description: "Personalized vehicle replicas and textured 3D printed everyday carry",
    productCount: 2,
    status: "confirmed",
  },
  {
    id: "cat-organizers",
    name: "Desk Organizers",
    slug: "desk-organizers",
    icon: "✏️",
    description: "Creative functional pen cups, stands, and workspace accessories",
    productCount: 1,
    status: "requires_confirmation",
  },
  {
    id: "cat-lithophanes",
    name: "Lithophane Lamps",
    slug: "lithophane-lamps",
    icon: "💡",
    description: "Backlit 3D lithophane globes that reveal illuminated artwork when turned on",
    productCount: 1,
    status: "confirmed",
  },
  {
    id: "cat-miniatures",
    name: "Miniatures & Decor",
    slug: "miniatures-decor",
    icon: "✨",
    description: "Knitted-texture faux-crochet figurines and unique shelf collectibles",
    productCount: 1,
    status: "requires_confirmation",
  },
];

// ─── All Sample 3D Printed Products (13 items from public/product-samples/) ─
// Note: Unverified social proof metrics (fabricated ratings and review counts)
// have been omitted per QA audit.

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: "sp-01",
    name: "3D Printed Radha Krishna Figurine (12.5 cm)",
    slug: "3d-printed-radha-krishna-figurine-12-5cm",
    description:
      "Intricately detailed 12.5 cm 3D printed sky-blue figurine of Radha and Krishna, depicting Lord Krishna playing the flute alongside Radha with a sacred lotus.",
    price: 699,
    compareAtPrice: 899,
    image: "/product-samples/1.jpeg",
    category: "Spiritual Idols",
    categorySlug: "spiritual-idols",
    isFeatured: true,
    isPopular: true,
    isActive: true,
    stockQuantity: 15,
    specifications: {
      material: "Eco-Friendly PLA Bioplastic",
      process: "High-Resolution FDM 3D Printing",
      dimensions: "12.5 cm (H) × 7.0 cm (W)",
      finish: "Sky-Blue Layer Finish",
      care: "Wipe with a soft, dry cloth. Keep away from extreme heat (>50°C).",
    },
  },
  {
    id: "sp-02",
    name: "3D Printed Golden Ganesha Idol",
    slug: "3d-printed-golden-ganesha-idol",
    description:
      "Auspicious seated Lord Ganesha idol crafted in rich metallic gold finish with traditional modak and divine blessing mudra.",
    price: 549,
    compareAtPrice: 699,
    image: "/product-samples/2.jpeg",
    category: "Spiritual Idols",
    categorySlug: "spiritual-idols",
    isFeatured: true,
    isPopular: true,
    isActive: true,
    stockQuantity: 20,
    specifications: {
      material: "Silk Metallic PLA Bioplastic",
      process: "High-Detail FDM 3D Printing",
      dimensions: "10.0 cm (H) × 8.0 cm (W)",
      finish: "Rich Metallic Gold Finish",
      care: "Dust gently with a soft brush. Keep away from direct high heat.",
    },
  },
  {
    id: "sp-03",
    name: "Modern Minimalist Ganesha with Veena Sculpture",
    slug: "modern-minimalist-ganesha-veena-sculpture",
    description:
      "Contemporary minimalist sculpture of Lord Ganesha playing a Veena, featuring elegant flowing geometric contours on an integrated circular pedestal.",
    price: 499,
    compareAtPrice: null,
    image: "/product-samples/3.jpeg",
    category: "Spiritual Idols",
    categorySlug: "spiritual-idols",
    isFeatured: false,
    isPopular: true,
    isActive: true,
    stockQuantity: 12,
    specifications: {
      material: "Eco-Friendly PLA Bioplastic",
      process: "Geometric Contour FDM Printing",
      dimensions: "11.0 cm (H) × 7.5 cm (W)",
      finish: "Matte Smooth Finish on Circular Pedestal",
      care: "Clean with a dry microfiber cloth.",
    },
  },
  {
    id: "sp-04",
    name: "3D Printed Balancing Bird Desk Toy",
    slug: "3d-printed-balancing-bird-desk-toy",
    description:
      "Fascinating physics-based center of gravity desk toy. The dual-color 3D printed eagle balances effortlessly by its beak on a matching pedestal stand.",
    price: 349,
    compareAtPrice: 449,
    image: "/product-samples/4.jpeg",
    category: "Articulated & Toys",
    categorySlug: "articulated-toys",
    isFeatured: false,
    isPopular: true,
    isActive: true,
    stockQuantity: 25,
    specifications: {
      material: "Rigid PLA Bioplastic",
      process: "Precision-Balanced Center of Gravity FDM Printing",
      dimensions: "14.0 cm wingspan, 12.0 cm pedestal stand",
      finish: "Dual-Color Layered Finish",
      care: "Handle balancing beak with care. Avoid dropping on hard surfaces.",
    },
  },
  {
    id: "sp-05",
    name: "3D Printed Articulated Heart Character",
    slug: "3d-printed-articulated-heart-character",
    description:
      "Playful vibrant red 3D printed heart character featuring posable mechanical limbs and shoes, crafted to sit happily on shelf edges or desk monitors.",
    price: 399,
    compareAtPrice: 499,
    image: "/product-samples/5.jpeg",
    category: "Articulated & Toys",
    categorySlug: "articulated-toys",
    isFeatured: true,
    isPopular: true,
    isActive: true,
    stockQuantity: 18,
    specifications: {
      material: "High-Impact Tough PLA Bioplastic",
      process: "Multi-Part Articulated FDM Printing",
      dimensions: "9.0 cm (Seated Height) × 8.5 cm (W)",
      finish: "Vibrant Satin Red with Movable Ball Joints",
      care: "Joints articulate smoothly; do not force past natural stop points.",
    },
  },
  {
    id: "sp-06",
    name: "Customized 3D Printed Car Model Keychain",
    slug: "customized-3d-printed-car-model-keychain",
    description:
      "Personalized 3D printed miniature car replica keychain customized to match your vehicle styling with individual license plate lettering.",
    price: 299,
    compareAtPrice: 399,
    image: "/product-samples/6.jpeg",
    category: "Custom Keychains",
    categorySlug: "custom-keychains",
    isFeatured: true,
    isPopular: true,
    isActive: true,
    stockQuantity: 30,
    specifications: {
      material: "Durable Impact PLA + Nickel-Plated Steel Split Ring",
      process: "Precision Embossed FDM Printing",
      dimensions: "6.5 cm (L) × 3.0 cm (W)",
      finish: "Textured Multi-Color Layering",
      customization: "Personalized vehicle styling with custom license plate lettering",
      care: "Durable everyday pocket carry.",
    },
  },
  {
    id: "sp-07",
    name: "3D Printed Lithophane Night Light Lamp",
    slug: "3d-printed-lithophane-night-light-lamp",
    description:
      "Direct plug-in spherical 3D printed lithophane night light. Translucent layers illuminate a divine couple portrait when switched on.",
    price: 799,
    compareAtPrice: 999,
    image: "/product-samples/7.jpeg",
    category: "Lithophane Lamps",
    categorySlug: "lithophane-lamps",
    isFeatured: true,
    isPopular: false,
    isActive: true,
    stockQuantity: 10,
    specifications: {
      material: "Translucent Light-Diffusing Lithophane PLA",
      process: "High-Resolution Micro-Layer Backlit Lithophane Printing",
      dimensions: "10.0 cm Diameter Sphere",
      finish: "Translucent Ivory Relief",
      care: "Use with standard low-heat 2-pin LED plug (included). Indoor use only.",
    },
  },
  {
    id: "sp-08",
    name: "3D Printed Articulated Baby Fox Figurine",
    slug: "3d-printed-articulated-baby-fox-figurine",
    description:
      "Adorable snow-white baby fox figurine featuring an articulated posable tail and textured surface, perfect for nature lovers and fidget collectors.",
    price: 449,
    compareAtPrice: null,
    image: "/product-samples/8.jpeg",
    category: "Articulated & Toys",
    categorySlug: "articulated-toys",
    isFeatured: false,
    isPopular: true,
    isActive: true,
    stockQuantity: 14,
    specifications: {
      material: "Eco-Friendly PLA Bioplastic",
      process: "Print-in-Place Articulated FDM Printing",
      dimensions: "8.0 cm (L) × 4.5 cm (H)",
      finish: "Snow-White Matte Fine Texture",
      care: "Posable segmented tail. Do not force joints beyond normal range.",
    },
  },
  {
    id: "sp-09",
    name: "3D Printed Hoodie Pen Holder & Desk Organizer",
    slug: "3d-printed-hoodie-pen-holder-desk-organizer",
    description:
      "Quirky and functional miniature pastel-pink hoodie sweatshirt pen cup. Holds pens, pencils, stylus, and desk stationery with style.",
    price: 399,
    compareAtPrice: 499,
    image: "/product-samples/9.jpeg",
    category: "Desk Organizers",
    categorySlug: "desk-organizers",
    isFeatured: true,
    isPopular: true,
    isActive: true,
    stockQuantity: 22,
    specifications: {
      material: "Rigid Structural PLA Bioplastic",
      process: "Hollow-Body FDM 3D Printing",
      dimensions: "10.0 cm (H) × 9.0 cm (W) × 8.0 cm (D)",
      finish: "Pastel Pink Matte Layer Texture",
      care: "Wipe with damp cloth. Suitable for pens, pencils, and desk accessories.",
    },
  },
  {
    id: "sp-10",
    name: "3D Printed Radha Krishna Mini Idol (Hand-Painted)",
    slug: "3d-printed-radha-krishna-mini-idol-hand-painted",
    description:
      "Miniature white 3D printed Radha Krishna seated idol enhanced with hand-painted peacock feather, tilak, and golden jewellery accents.",
    price: 599,
    compareAtPrice: 749,
    image: "/product-samples/10.jpeg",
    category: "Spiritual Idols",
    categorySlug: "spiritual-idols",
    isFeatured: false,
    isPopular: true,
    isActive: true,
    stockQuantity: 8,
    specifications: {
      material: "High-Definition PLA + Fine Acrylic Hand Detailing",
      process: "Precision FDM 3D Printing with Artisan Hand Accents",
      dimensions: "9.0 cm (H) × 5.5 cm (W)",
      finish: "Hand-Painted Peacock Feather, Tilak & Golden Highlights",
      care: "Gentle dusting only. Do not wash or expose to chemical solvents.",
    },
  },
  {
    id: "sp-11",
    name: "3D Printed Meditating Lord Shiva (Adiyogi) Idol",
    slug: "3d-printed-meditating-lord-shiva-adiyogi-idol",
    description:
      "Serene Lord Shiva in deep Dhyana meditation with sacred rudraksha garland, serpent adornment, and lustrous metallic finish.",
    price: 649,
    compareAtPrice: 799,
    image: "/product-samples/11.jpeg",
    category: "Spiritual Idols",
    categorySlug: "spiritual-idols",
    isFeatured: true,
    isPopular: false,
    isActive: true,
    stockQuantity: 16,
    specifications: {
      material: "Metallic Silk PLA Bioplastic",
      process: "High-Detail Sculptural FDM Printing",
      dimensions: "12.0 cm (H) × 10.0 cm (W)",
      finish: "Serene Dark Metallic Luster with Crescent Moon Detail",
      care: "Ideal for car dashboards or home altars. Keep away from extreme temperatures.",
    },
  },
  {
    id: "sp-12",
    name: "3D Printed Knitted-Texture Baby Elephant Figurine",
    slug: "3d-printed-knitted-texture-baby-elephant-figurine",
    description:
      "Charming sky-blue baby elephant sculpted with an ultra-realistic faux-knitted yarn texture. Currently out of stock for seasonal restocking.",
    price: 349,
    compareAtPrice: null,
    image: "/product-samples/12.jpeg",
    category: "Miniatures & Decor",
    categorySlug: "miniatures-decor",
    isFeatured: false,
    isPopular: true,
    isActive: true, // Out of stock example (stockQuantity: 0)
    stockQuantity: 0,
    specifications: {
      material: "Eco-Friendly PLA Bioplastic",
      process: "Parametric Faux-Knit Surface FDM Printing",
      dimensions: "8.5 cm (H) × 7.0 cm (W)",
      finish: "Ultra-Realistic Faux-Yarn Knitted Pattern",
      care: "Indoor decorative piece. Dust with soft dry brush.",
    },
  },
  {
    id: "sp-13",
    name: "3D Printed Knitted-Texture Puppy Keychain",
    slug: "3d-printed-knitted-texture-puppy-keychain",
    description:
      "Ultra-cute peach-pink pocket puppy dog keychain crafted with an intricate yarn-knit surface pattern and durable metal split ring.",
    price: 249,
    compareAtPrice: 329,
    image: "/product-samples/13.jpeg",
    category: "Custom Keychains",
    categorySlug: "custom-keychains",
    isFeatured: false,
    isPopular: true,
    isActive: true,
    stockQuantity: 28,
    specifications: {
      material: "Tough PLA Bioplastic + Metal Keyring",
      process: "High-Density Textured FDM Printing",
      dimensions: "5.0 cm × 4.0 cm",
      finish: "Peach-Pink Faux-Crochet Textured Relief",
      care: "Compact everyday pocket carry.",
    },
  },
];

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
    "From personalized car keychains to illuminated lithophane night lights. Precision crafted layer by layer, delivered across India.",
  ctaText: "Explore Creations",
  ctaHref: "/shop?cat=custom-keychains",
};

// ─── Trust / Value Propositions (3D Printing Focus) ─────────────────────────

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
    description: "Personalized number plates, names & custom colorways",
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
