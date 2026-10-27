/**
 * Dearr V1 Complete Product Catalog — 3D Printing Catalog Foundation
 *
 * Scraped and synchronized directly from Hostinger production storefront:
 * https://purple-leopard-280444.hostingersite.com/shop
 *
 * Total Products: 86
 * Total Categories: 12
 */

export interface SampleProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
  colorId?: string | null;
  sizeName?: string | null;
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

// ─── 3D Printing Categories (12 Categories from Hostinger Storefront) ─────

export const SAMPLE_CATEGORIES: SampleCategory[] = [
  {
    "id": "cat-teddy-bear",
    "name": "Teddy bears",
    "slug": "teddy-bear",
    "rawSlug": "TEDDY_BEAR",
    "icon": "🧸",
    "description": "Sculpted keepsake teddy bears and custom name-tagged plush companions",
    "productCount": 2,
    "status": "confirmed"
  },
  {
    "id": "cat-night-lamp",
    "name": "Night lamps",
    "slug": "night-lamp",
    "rawSlug": "NIGHT_LAMP",
    "icon": "💡",
    "description": "Softly glowing ambient moon lamps and backlit lithophane bedside lights",
    "productCount": 4,
    "status": "confirmed"
  },
  {
    "id": "cat-wall-art",
    "name": "Wall art",
    "slug": "wall-art",
    "rawSlug": "WALL_ART",
    "icon": "🖼️",
    "description": "Low-poly decorative accent panels and precision geometric vehicle wall art",
    "productCount": 2,
    "status": "confirmed"
  },
  {
    "id": "cat-name-plate",
    "name": "Name plates",
    "slug": "name-plate",
    "rawSlug": "NAME_PLATE",
    "icon": "🏷️",
    "description": "Personalized desk stands, CA professional nameplates, and custom door plates",
    "productCount": 4,
    "status": "confirmed"
  },
  {
    "id": "cat-keychain",
    "name": "Keychains",
    "slug": "keychain",
    "rawSlug": "KEYCHAIN",
    "icon": "🔑",
    "description": "Custom name tags, automotive logos, superhero charms, and textured keychains",
    "productCount": 24,
    "status": "confirmed"
  },
  {
    "id": "cat-lithophane-panel",
    "name": "Lithophanes",
    "slug": "lithophane-panel",
    "rawSlug": "LITHOPHANE_PANEL",
    "icon": "✨",
    "description": "High-resolution standing photo lithophane panels revealing memories when backlit",
    "productCount": 3,
    "status": "confirmed"
  },
  {
    "id": "cat-litho-keychain",
    "name": "Litho keychains",
    "slug": "litho-keychain",
    "rawSlug": "LITHO_KEYCHAIN",
    "icon": "🔦",
    "description": "Pocket-sized backlit photo lithophane keychains crafted to order",
    "productCount": 1,
    "status": "confirmed"
  },
  {
    "id": "cat-photo-figurine",
    "name": "Photo figurines",
    "slug": "photo-figurine",
    "rawSlug": "PHOTO_FIGURINE",
    "icon": "👤",
    "description": "Personalized full-color 3D mini-me keepsake figurines sculpted from your photos",
    "productCount": 1,
    "status": "confirmed"
  },
  {
    "id": "cat-devotional",
    "name": "Devotional",
    "slug": "devotional",
    "rawSlug": "DEVOTIONAL",
    "icon": "🪔",
    "description": "Intricately detailed sacred sculptures, Krishna, Ganesha, Shiva, and divine shrines",
    "productCount": 25,
    "status": "confirmed"
  },
  {
    "id": "cat-curio",
    "name": "Curios",
    "slug": "curio",
    "rawSlug": "CURIO",
    "icon": "🐱",
    "description": "Charming animal figurines, desktop curios, and collectible shelf miniatures",
    "productCount": 13,
    "status": "confirmed"
  },
  {
    "id": "cat-desktop-accessory",
    "name": "Desktop accessories",
    "slug": "desktop-accessory",
    "rawSlug": "DESKTOP_ACCESSORY",
    "icon": "✏️",
    "description": "Miniature hoodie pen cups, photo card stands, and workspace organizers",
    "productCount": 3,
    "status": "confirmed"
  },
  {
    "id": "cat-other",
    "name": "More gifts",
    "slug": "other",
    "rawSlug": "OTHER",
    "icon": "🎁",
    "description": "Geometric planter pots, magnetic fridge decor sets, and custom trophies",
    "productCount": 4,
    "status": "confirmed"
  }
];

// ─── All 3D Printed Products (86 Items Scraped from Hostinger Storefront) ──

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    "id": "sp-01",
    "name": "Classic 3D-Printed Teddy Bear",
    "slug": "classic-teddy-bear",
    "description": "A sculpted keepsake teddy bear, 3D printed in a smooth matte finish. A sweet no-fuss gift for birthdays, baby showers, or just because.",
    "price": 899,
    "compareAtPrice": 1099,
    "image": "/uploads/products/classic-teddy-bear.jpg",
    "images": [
      "/uploads/products/classic-teddy-bear.jpg"
    ],
    "category": "Teddy bears",
    "categorySlug": "teddy-bear",
    "rawCategorySlug": "TEDDY_BEAR",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": true,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-classic-teddy-bear-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-classic-teddy-bear-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-classic-teddy-bear-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-classic-teddy-bear-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [
      {
        "id": "var-classic-teddy-bear-1",
        "name": "Small (10cm)",
        "sku": "SKU-CLASSI-1-S1",
        "price": 899,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-classic-teddy-bear-2",
        "name": "Medium (15cm) (+₹300)",
        "sku": "SKU-CLASSI-1-S2",
        "price": 1199,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-classic-teddy-bear-3",
        "name": "Large (20cm) (+₹700)",
        "sku": "SKU-CLASSI-1-S3",
        "price": 1599,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-02",
    "name": "Name Teddy Bear with Heart Tag",
    "slug": "name-teddy-bear",
    "description": "The same keepsake teddy bear, with a heart-shaped tag engraved with a name or short message — a favourite for newborns and anniversaries.",
    "price": 1099,
    "compareAtPrice": 1349,
    "image": "/uploads/products/name-teddy-bear.png",
    "images": [
      "/uploads/products/name-teddy-bear.png"
    ],
    "category": "Teddy bears",
    "categorySlug": "teddy-bear",
    "rawCategorySlug": "TEDDY_BEAR",
    "badge": "Personalize with text",
    "leadTime": "4-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-name-teddy-bear-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-name-teddy-bear-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-name-teddy-bear-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-name-teddy-bear-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [
      {
        "id": "var-name-teddy-bear-1",
        "name": "Small (10cm)",
        "sku": "SKU-NAMETE-2-S1",
        "price": 1099,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-name-teddy-bear-2",
        "name": "Medium (15cm) (+₹300)",
        "sku": "SKU-NAMETE-2-S2",
        "price": 1399,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-name-teddy-bear-3",
        "name": "Large (20cm) (+₹700)",
        "sku": "SKU-NAMETE-2-S3",
        "price": 1799,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-03",
    "name": "Moon Glow Night Lamp",
    "slug": "moon-glow-night-lamp",
    "description": "A softly glowing sculpted moon lamp for a bedside table or nursery. USB powered, warm/cool light toggle.",
    "price": 699,
    "compareAtPrice": 849,
    "image": "/uploads/products/moon-glow-night-lamp-1.jpeg",
    "images": [
      "/uploads/products/moon-glow-night-lamp-1.jpeg"
    ],
    "category": "Night lamps",
    "categorySlug": "night-lamp",
    "rawCategorySlug": "NIGHT_LAMP",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-moon-glow-night-lamp-1",
        "name": "Warm White Glow",
        "slug": "warm-white-glow",
        "hex": "#FFF3C4",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-moon-glow-night-lamp-2",
        "name": "Cool White Glow",
        "slug": "cool-white-glow",
        "hex": "#EDF2F7",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-moon-glow-night-lamp-3",
        "name": "RGB Colour-Change",
        "slug": "rgb-colour-change",
        "hex": "#E2E8F0",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-04",
    "name": "Photo Moon Lamp (Lithophane)",
    "slug": "photo-moon-lamp",
    "description": "Upload any photo — it's engraved into the lamp as a lithophane, invisible until lit, then glowing to life in soft detail. One of our most-gifted pieces.",
    "price": 1499,
    "compareAtPrice": 1849,
    "image": "/uploads/products/photo-moon-lamp.jpeg",
    "images": [
      "/uploads/products/photo-moon-lamp.jpeg"
    ],
    "category": "Night lamps",
    "categorySlug": "night-lamp",
    "rawCategorySlug": "NIGHT_LAMP",
    "badge": "Personalize with your photo",
    "leadTime": "5-day print",
    "isFeatured": true,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [
      {
        "id": "var-photo-moon-lamp-1",
        "name": "Small (10cm)",
        "sku": "SKU-PHOTOM-4-S1",
        "price": 1499,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-photo-moon-lamp-2",
        "name": "Large (15cm) (+₹600)",
        "sku": "SKU-PHOTOM-4-S2",
        "price": 2099,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-05",
    "name": "Geometric Wall Art Panel",
    "slug": "geometric-wall-art",
    "description": "A modern low-poly wall panel that catches light beautifully. Ready to hang, no frame needed.",
    "price": 1299,
    "compareAtPrice": 1599,
    "image": "/uploads/products/geometric-wall-art.jpg",
    "images": [
      "/uploads/products/geometric-wall-art.jpg"
    ],
    "category": "Wall art",
    "categorySlug": "wall-art",
    "rawCategorySlug": "WALL_ART",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-geometric-wall-art-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-geometric-wall-art-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-geometric-wall-art-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-geometric-wall-art-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [
      {
        "id": "var-geometric-wall-art-1",
        "name": "20cm",
        "sku": "SKU-GEOMET-5-S1",
        "price": 1299,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-geometric-wall-art-2",
        "name": "30cm (+₹500)",
        "sku": "SKU-GEOMET-5-S2",
        "price": 1799,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-06",
    "name": "Low-Poly Car Wall Art",
    "slug": "car-wall-art",
    "description": "A faceted, low-poly car silhouette wall panel — a fun statement piece for a study, garage corner, or kid's room. Generic unbranded design, no make or model.",
    "price": 1399,
    "compareAtPrice": 1749,
    "image": "/uploads/products/car-wall-art.png",
    "images": [
      "/uploads/products/car-wall-art.png"
    ],
    "category": "Wall art",
    "categorySlug": "wall-art",
    "rawCategorySlug": "WALL_ART",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-car-wall-art-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-car-wall-art-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-car-wall-art-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-car-wall-art-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [
      {
        "id": "var-car-wall-art-1",
        "name": "25cm",
        "sku": "SKU-CARWAL-6-S1",
        "price": 1399,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-car-wall-art-2",
        "name": "35cm (+₹600)",
        "sku": "SKU-CARWAL-6-S2",
        "price": 1999,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-07",
    "name": "Personalized Name Plate",
    "slug": "personalized-name-plate",
    "description": "A clean, modern name plate for your front door or desk — pick a size, colour, and the exact text.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/personalized-name-plate.jpeg",
    "images": [
      "/uploads/products/personalized-name-plate.jpeg"
    ],
    "category": "Name plates",
    "categorySlug": "name-plate",
    "rawCategorySlug": "NAME_PLATE",
    "badge": "Personalize with text",
    "leadTime": "3-day print",
    "isFeatured": true,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-personalized-name-plate-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-personalized-name-plate-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-personalized-name-plate-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-personalized-name-plate-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [
      {
        "id": "var-personalized-name-plate-1",
        "name": "Small (12x4cm)",
        "sku": "SKU-PERSON-7-S1",
        "price": 599,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-personalized-name-plate-2",
        "name": "Large (20x6cm) (+₹400)",
        "sku": "SKU-PERSON-7-S2",
        "price": 999,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-08",
    "name": "Desk Nameplate with Stand",
    "slug": "desk-nameplate-stand",
    "description": "A free-standing desk nameplate — great for office desks, wedding tables, or as a corporate gift.",
    "price": 499,
    "compareAtPrice": null,
    "image": "/uploads/products/desk-nameplate-stand.jpeg",
    "images": [
      "/uploads/products/desk-nameplate-stand.jpeg"
    ],
    "category": "Name plates",
    "categorySlug": "name-plate",
    "rawCategorySlug": "NAME_PLATE",
    "badge": "Personalize with text",
    "leadTime": "3-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-desk-nameplate-stand-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-desk-nameplate-stand-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-desk-nameplate-stand-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-desk-nameplate-stand-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-09",
    "name": "Custom Name Keychain",
    "slug": "custom-name-keychain",
    "description": "A sturdy, pocket-sized keychain with any name or short word printed in bold lettering.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/custom-name-keychain.png",
    "images": [
      "/uploads/products/custom-name-keychain.png"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": "Personalize with text",
    "leadTime": "2-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-custom-name-keychain-1",
        "name": "White",
        "slug": "white",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-custom-name-keychain-2",
        "name": "Black",
        "slug": "black",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-custom-name-keychain-3",
        "name": "Red",
        "slug": "red",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-custom-name-keychain-4",
        "name": "Blue",
        "slug": "blue",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-custom-name-keychain-5",
        "name": "Gold",
        "slug": "gold",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-custom-name-keychain-6",
        "name": "Rose Gold",
        "slug": "rose-gold",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-10",
    "name": "Pet ID Tag Keychain",
    "slug": "pet-id-tag-keychain",
    "description": "A durable ID tag for a collar or keyring, engraved with your pet's name and a phone number.",
    "price": 349,
    "compareAtPrice": null,
    "image": "/uploads/products/pet-id-tag-keychain.jpeg",
    "images": [
      "/uploads/products/pet-id-tag-keychain.jpeg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": "Personalize with text",
    "leadTime": "2-day print",
    "isFeatured": true,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-pet-id-tag-keychain-1",
        "name": "White",
        "slug": "white",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-pet-id-tag-keychain-2",
        "name": "Black",
        "slug": "black",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-pet-id-tag-keychain-3",
        "name": "Red",
        "slug": "red",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-pet-id-tag-keychain-4",
        "name": "Blue",
        "slug": "blue",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-pet-id-tag-keychain-5",
        "name": "Gold",
        "slug": "gold",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-pet-id-tag-keychain-6",
        "name": "Rose Gold",
        "slug": "rose-gold",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-11",
    "name": "Photo Lithophane Panel (Standing)",
    "slug": "photo-lithophane-panel",
    "description": "Your favourite photo, printed as a lithophane panel on a display stand — invisible until backlit, then glowing with full detail.",
    "price": 799,
    "compareAtPrice": 999,
    "image": "/uploads/products/photo-lithophane-panel-1.jpeg",
    "images": [
      "/uploads/products/photo-lithophane-panel-1.jpeg"
    ],
    "category": "Lithophanes",
    "categorySlug": "lithophane-panel",
    "rawCategorySlug": "LITHOPHANE_PANEL",
    "badge": "Personalize with your photo",
    "leadTime": "4-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [
      {
        "id": "var-photo-lithophane-panel-1",
        "name": "Small (8cm)",
        "sku": "SKU-PHOTOL-11-S1",
        "price": 799,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-photo-lithophane-panel-2",
        "name": "Medium (10cm) (+₹200)",
        "sku": "SKU-PHOTOL-11-S2",
        "price": 999,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-photo-lithophane-panel-3",
        "name": "Large (15cm) (+₹500)",
        "sku": "SKU-PHOTOL-11-S3",
        "price": 1299,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-12",
    "name": "Lithophane Photo Keychain",
    "slug": "lithophane-photo-keychain",
    "description": "A tiny glowing photo you can carry with you — hold it up to a light or your phone flashlight to see it shine through.",
    "price": 549,
    "compareAtPrice": 699,
    "image": "/uploads/products/lithophane-photo-keychain-1.jpeg",
    "images": [
      "/uploads/products/lithophane-photo-keychain-1.jpeg"
    ],
    "category": "Litho keychains",
    "categorySlug": "litho-keychain",
    "rawCategorySlug": "LITHO_KEYCHAIN",
    "badge": "Personalize with your photo",
    "leadTime": "3-day print",
    "isFeatured": true,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-13",
    "name": "Mini-Me 3D Figurine",
    "slug": "mini-me-3d-figurine",
    "description": "A hand-finished miniature figurine modeled from your photo by our design team, then 3D printed and painted. Our most detailed keepsake — please share clear front/side reference photos at checkout.",
    "price": 2999,
    "compareAtPrice": 3749,
    "image": "/uploads/products/mini-me-3d-figurine.jpeg",
    "images": [
      "/uploads/products/mini-me-3d-figurine.jpeg"
    ],
    "category": "Photo figurines",
    "categorySlug": "photo-figurine",
    "rawCategorySlug": "PHOTO_FIGURINE",
    "badge": "Personalize with your photo",
    "leadTime": "10-day print",
    "isFeatured": true,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [
      {
        "id": "var-mini-me-3d-figurine-1",
        "name": "10cm",
        "sku": "SKU-MINIME-13-S1",
        "price": 2999,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-mini-me-3d-figurine-2",
        "name": "15cm (+₹1,200)",
        "sku": "SKU-MINIME-13-S2",
        "price": 2999,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-14",
    "name": "Fridge Magnet Set (Set of 4)",
    "slug": "fridge-magnet-set",
    "description": "A cheerful set of four sculpted animal-face magnets — bear, bunny, cat, and dog. A fun little add-on gift.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/fridge-magnet-set.jpeg",
    "images": [
      "/uploads/products/fridge-magnet-set.jpeg"
    ],
    "category": "More gifts",
    "categorySlug": "other",
    "rawCategorySlug": "OTHER",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-fridge-magnet-set-1",
        "name": "White",
        "slug": "white",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-fridge-magnet-set-2",
        "name": "Black",
        "slug": "black",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-fridge-magnet-set-3",
        "name": "Red",
        "slug": "red",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-fridge-magnet-set-4",
        "name": "Blue",
        "slug": "blue",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-fridge-magnet-set-5",
        "name": "Gold",
        "slug": "gold",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-fridge-magnet-set-6",
        "name": "Rose Gold",
        "slug": "rose-gold",
        "hex": "#4A90E2",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-15",
    "name": "Geometric Planter Pot",
    "slug": "geometric-planter-pot",
    "description": "A faceted planter pot for a succulent or small houseplant — a low-maintenance gift that lasts.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/geometric-planter-pot.jpeg",
    "images": [
      "/uploads/products/geometric-planter-pot.jpeg"
    ],
    "category": "More gifts",
    "categorySlug": "other",
    "rawCategorySlug": "OTHER",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": true,
    "colors": [
      {
        "id": "col-geometric-planter-pot-1",
        "name": "Natural White",
        "slug": "natural-white",
        "hex": "#F8F9FA",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-geometric-planter-pot-2",
        "name": "Charcoal Black",
        "slug": "charcoal-black",
        "hex": "#212529",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-geometric-planter-pot-3",
        "name": "Blush Pink",
        "slug": "blush-pink",
        "hex": "#F8B4D9",
        "stock": 20,
        "isActive": true
      },
      {
        "id": "col-geometric-planter-pot-4",
        "name": "Sage Green",
        "slug": "sage-green",
        "hex": "#829E85",
        "stock": 20,
        "isActive": true
      }
    ],
    "variants": [
      {
        "id": "var-geometric-planter-pot-1",
        "name": "Small",
        "sku": "SKU-GEOMET-15-S1",
        "price": 449,
        "stockQuantity": 20,
        "isActive": true
      },
      {
        "id": "var-geometric-planter-pot-2",
        "name": "Medium (+₹250)",
        "sku": "SKU-GEOMET-15-S2",
        "price": 699,
        "stockQuantity": 20,
        "isActive": true
      }
    ],
    "codEnabled": true
  },
  {
    "id": "sp-16",
    "name": "Captain America Shield Keychain",
    "slug": "captain-america-shield-keychain",
    "description": "A round Captain America shield keychain in classic red, white, and blue.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/captain-america-shield-keychain.jpg",
    "images": [
      "/uploads/products/captain-america-shield-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-17",
    "name": "Car Brand Logo Keychain",
    "slug": "car-brand-logo-keychain-set",
    "description": "Your car's badge, printed as a keychain — pick your brand from the dropdown.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/car-brand-logo-keychain-set.jpg",
    "images": [
      "/uploads/products/car-brand-logo-keychain-set.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-18",
    "name": "Car Silhouette Keychain",
    "slug": "car-silhouette-keychain",
    "description": "A 3D-printed silhouette of a car, finished to hang off any keyring.",
    "price": 349,
    "compareAtPrice": null,
    "image": "/uploads/products/car-silhouette-keychain.jpg",
    "images": [
      "/uploads/products/car-silhouette-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-19",
    "name": "\"DAD\" Text Keychain",
    "slug": "dad-text-keychain",
    "description": "A bold \"DAD\" keychain — a small, straightforward gift.",
    "price": 249,
    "compareAtPrice": null,
    "image": "/uploads/products/dad-text-keychain.jpg",
    "images": [
      "/uploads/products/dad-text-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-20",
    "name": "Crochet-Look Elephant Keychain",
    "slug": "elephant-keychain-blue",
    "description": "A soft-look baby elephant keychain in dusty blue, knitted-texture finish.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/elephant-keychain-blue-1.jpg",
    "images": [
      "/uploads/products/elephant-keychain-blue-1.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-21",
    "name": "Fighter Plane Keychain",
    "slug": "fighter-plane-keychain",
    "description": "A sleek fighter-jet silhouette keychain in warm copper.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/fighter-plane-keychain.jpg",
    "images": [
      "/uploads/products/fighter-plane-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-22",
    "name": "Flower Charm Keychain",
    "slug": "flower-charm-keychain-set",
    "description": "A small blossom-shaped charm keychain in soft pink.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/flower-charm-keychain-set.jpg",
    "images": [
      "/uploads/products/flower-charm-keychain-set.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-23",
    "name": "Iron Man Mask Keychain",
    "slug": "iron-man-keychain",
    "description": "Iron Man's mask in red and gold, sized for a keyring or bag charm.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/iron-man-keychain.jpg",
    "images": [
      "/uploads/products/iron-man-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-24",
    "name": "Assorted Character Keychain",
    "slug": "keychain-display-assorted",
    "description": "A mixed pack of popular character keychains — we'll pick a fun assortment for you.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/keychain-display-assorted.jpg",
    "images": [
      "/uploads/products/keychain-display-assorted.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-25",
    "name": "Marvel Hero Keychain",
    "slug": "marvel-superhero-keychain-set",
    "description": "Pick your favorite Avenger, each as its own round keychain.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/marvel-superhero-keychain-set.jpg",
    "images": [
      "/uploads/products/marvel-superhero-keychain-set.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-26",
    "name": "\"MOM\" Text Keychain",
    "slug": "mom-text-keychain",
    "description": "A bold \"MOM\" keychain — simple, sturdy, straight to the point.",
    "price": 249,
    "compareAtPrice": null,
    "image": "/uploads/products/mom-text-keychain.jpg",
    "images": [
      "/uploads/products/mom-text-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-27",
    "name": "Cursive \"Mother\" Script Keychain",
    "slug": "mother-script-text-keychain",
    "description": "A flowing script keychain reading \"Mother.\"",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/mother-script-text-keychain.jpg",
    "images": [
      "/uploads/products/mother-script-text-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-28",
    "name": "Nested Heart Keychain",
    "slug": "nested-heart-keychain-green",
    "description": "Three hearts nested inside each other, ombré from deep to pale green.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/nested-heart-keychain-green-1.jpg",
    "images": [
      "/uploads/products/nested-heart-keychain-green-1.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-29",
    "name": "Panda Keychain",
    "slug": "panda-keychain",
    "description": "A round-faced panda keychain in classic black and white.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/panda-keychain.jpg",
    "images": [
      "/uploads/products/panda-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-30",
    "name": "Crochet-Look Piglet Keychain",
    "slug": "pig-keychain-pink",
    "description": "A soft-look piglet keychain in blush pink, knitted-texture finish.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/pig-keychain-pink-1.jpg",
    "images": [
      "/uploads/products/pig-keychain-pink-1.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-31",
    "name": "Pikachu Keychain",
    "slug": "pikachu-keychain",
    "description": "Pikachu, ears up and ready — a cheerful keyring companion.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/pikachu-keychain.jpg",
    "images": [
      "/uploads/products/pikachu-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-32",
    "name": "Custom Round Badge Keychain",
    "slug": "round-text-badge-keychain",
    "description": "A round badge keychain with a name or initials at the centre.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/round-text-badge-keychain.jpg",
    "images": [
      "/uploads/products/round-text-badge-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-33",
    "name": "Royal Enfield Text Keychain",
    "slug": "royal-enfield-text-keychain",
    "description": "The Royal Enfield wordmark in gunmetal grey.",
    "price": 349,
    "compareAtPrice": null,
    "image": "/uploads/products/royal-enfield-text-keychain.jpg",
    "images": [
      "/uploads/products/royal-enfield-text-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-34",
    "name": "Spiderman Keychain",
    "slug": "spiderman-keychain",
    "description": "Spiderman's mask, mid-swing pose, in classic red and blue.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/spiderman-keychain.jpg",
    "images": [
      "/uploads/products/spiderman-keychain.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-35",
    "name": "Teddy Bear & Heart Keychain — Cream",
    "slug": "teddy-bear-heart-keychain-cream",
    "description": "A knitted-look teddy bear holding a little red heart, in warm cream.",
    "price": 329,
    "compareAtPrice": null,
    "image": "/uploads/products/teddy-bear-heart-keychain-cream-1.jpg",
    "images": [
      "/uploads/products/teddy-bear-heart-keychain-cream-1.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-36",
    "name": "Crochet-Look Teddy Bear Keychain — Blue",
    "slug": "teddy-bear-keychain-blue",
    "description": "A soft-look teddy bear keychain in sky blue, knitted-texture finish.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/teddy-bear-keychain-blue-1.jpg",
    "images": [
      "/uploads/products/teddy-bear-keychain-blue-1.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-37",
    "name": "Crochet-Look Teddy Bear Keychain — Cream",
    "slug": "teddy-bear-keychain-cream",
    "description": "A soft-look teddy bear keychain in warm cream, knitted-texture finish.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/teddy-bear-keychain-cream-1.jpg",
    "images": [
      "/uploads/products/teddy-bear-keychain-cream-1.jpg"
    ],
    "category": "Keychains",
    "categorySlug": "keychain",
    "rawCategorySlug": "KEYCHAIN",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-38",
    "name": "Crawling Baby Krishna (Laddu Gopal)",
    "slug": "baby-krishna-crawling",
    "description": "Baby Krishna in his classic crawling pose — a gentle everyday altar piece.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/baby-krishna-crawling.jpg",
    "images": [
      "/uploads/products/baby-krishna-crawling.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-39",
    "name": "Baby Krishna with Flute — Gold Accent",
    "slug": "baby-krishna-flute-gold-accent",
    "description": "Baby Krishna standing with his flute, soft gold detailing.",
    "price": 649,
    "compareAtPrice": 799,
    "image": "/uploads/products/baby-krishna-flute-gold-accent-1.jpg",
    "images": [
      "/uploads/products/baby-krishna-flute-gold-accent-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-40",
    "name": "Standing Baby Krishna with Flute",
    "slug": "baby-krishna-flute-standing",
    "description": "Baby Krishna in his classic flute-playing pose, simple white finish.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/baby-krishna-flute-standing.jpg",
    "images": [
      "/uploads/products/baby-krishna-flute-standing.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-41",
    "name": "Mini Laddu Gopal",
    "slug": "baby-krishna-laddu-gopal-mini",
    "description": "A compact Laddu Gopal idol, sized for a dashboard or small shelf.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/baby-krishna-laddu-gopal-mini.jpg",
    "images": [
      "/uploads/products/baby-krishna-laddu-gopal-mini.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-42",
    "name": "Baby Krishna with Peacock Feather",
    "slug": "baby-krishna-peacock-white-standing",
    "description": "Baby Krishna standing with his signature peacock-feather crown.",
    "price": 649,
    "compareAtPrice": 799,
    "image": "/uploads/products/baby-krishna-peacock-white-standing-1.jpg",
    "images": [
      "/uploads/products/baby-krishna-peacock-white-standing-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-43",
    "name": "Seated Baby Krishna",
    "slug": "baby-krishna-sitting-white",
    "description": "A seated Laddu Gopal, hands folded — a classic daily-prayer pose.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/baby-krishna-sitting-white-1.jpg",
    "images": [
      "/uploads/products/baby-krishna-sitting-white-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-44",
    "name": "Small Black Krishna Idol",
    "slug": "black-krishna-idol-small",
    "description": "A compact Krishna idol finished in deep black.",
    "price": 499,
    "compareAtPrice": null,
    "image": "/uploads/products/black-krishna-idol-small.jpg",
    "images": [
      "/uploads/products/black-krishna-idol-small.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-45",
    "name": "Divine Desk Temple — Gold",
    "slug": "divine-desk-temple-gold",
    "description": "A miniature temple archway in warm gold, houses any small idol.",
    "price": 1299,
    "compareAtPrice": 1599,
    "image": "/uploads/products/divine-desk-temple-gold-1.jpg",
    "images": [
      "/uploads/products/divine-desk-temple-gold-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "5-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-46",
    "name": "Divine Desk Temple — Terracotta",
    "slug": "divine-desk-temple-orange",
    "description": "A miniature temple archway in warm terracotta orange.",
    "price": 1199,
    "compareAtPrice": 1499,
    "image": "/uploads/products/divine-desk-temple-orange.jpg",
    "images": [
      "/uploads/products/divine-desk-temple-orange.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "5-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-47",
    "name": "Mini Ganesh Idol — Orange",
    "slug": "ganesh-idol-orange-mini",
    "description": "A simple, compact seated Ganesh idol in vibrant orange.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/ganesh-idol-orange-mini-1.jpg",
    "images": [
      "/uploads/products/ganesh-idol-orange-mini-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-48",
    "name": "Classic Ganesh Idol — White",
    "slug": "ganesh-idol-white-classic",
    "description": "A traditional seated Ganesh idol in clean white.",
    "price": 499,
    "compareAtPrice": null,
    "image": "/uploads/products/ganesh-idol-white-classic.jpg",
    "images": [
      "/uploads/products/ganesh-idol-white-classic.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-49",
    "name": "Ornate Seated Ganesh — White",
    "slug": "ganesh-seated-ornate-white",
    "description": "A detailed, ornately-decorated seated Ganesh idol.",
    "price": 899,
    "compareAtPrice": 1099,
    "image": "/uploads/products/ganesh-seated-ornate-white.jpg",
    "images": [
      "/uploads/products/ganesh-seated-ornate-white.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-50",
    "name": "Grand Palace Temple Model",
    "slug": "grand-palace-temple-model",
    "description": "An elaborate multi-tiered temple/palace model — a statement centrepiece.",
    "price": 1999,
    "compareAtPrice": 2499,
    "image": "/uploads/products/grand-palace-temple-model.jpg",
    "images": [
      "/uploads/products/grand-palace-temple-model.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "6-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-51",
    "name": "Hanuman Idol — Black",
    "slug": "hanuman-idol-black",
    "description": "A seated Hanuman idol in deep black, hands folded in devotion.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/hanuman-idol-black.jpg",
    "images": [
      "/uploads/products/hanuman-idol-black.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-52",
    "name": "Hanuman Idol — Orange",
    "slug": "hanuman-idol-orange",
    "description": "A seated Hanuman idol in classic saffron-orange.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/hanuman-idol-orange-1.jpg",
    "images": [
      "/uploads/products/hanuman-idol-orange-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-53",
    "name": "Meditating Shiva — Teal",
    "slug": "meditating-shiva-teal",
    "description": "Shiva seated in meditation, finished in a calm teal tone.",
    "price": 699,
    "compareAtPrice": 849,
    "image": "/uploads/products/meditating-shiva-teal-1.jpg",
    "images": [
      "/uploads/products/meditating-shiva-teal-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-54",
    "name": "Om Flag Decor Piece",
    "slug": "om-flag-decor",
    "description": "A small standing Om-symbol flag piece for an altar shelf.",
    "price": 349,
    "compareAtPrice": null,
    "image": "/uploads/products/om-flag-decor.jpg",
    "images": [
      "/uploads/products/om-flag-decor.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-55",
    "name": "Panchmukhi Ganesh — Ornate",
    "slug": "panchmukhi-ganesh-ornate",
    "description": "An elaborate five-headed Ganesh statue with fine detailing.",
    "price": 1499,
    "compareAtPrice": 1849,
    "image": "/uploads/products/panchmukhi-ganesh-ornate.jpg",
    "images": [
      "/uploads/products/panchmukhi-ganesh-ornate.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "6-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-56",
    "name": "Radha Krishna Flute Couple — Cyan",
    "slug": "radha-krishna-flute-couple-cyan",
    "description": "Radha and Krishna together, Krishna on his flute, soft cyan tone.",
    "price": 799,
    "compareAtPrice": 999,
    "image": "/uploads/products/radha-krishna-flute-couple-cyan.jpg",
    "images": [
      "/uploads/products/radha-krishna-flute-couple-cyan.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-57",
    "name": "Radha Krishna Flute Couple — White",
    "slug": "radha-krishna-flute-couple-white",
    "description": "Radha and Krishna together in white — a graceful pair, good wedding gift.",
    "price": 799,
    "compareAtPrice": 999,
    "image": "/uploads/products/radha-krishna-flute-couple-white-1.jpg",
    "images": [
      "/uploads/products/radha-krishna-flute-couple-white-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-58",
    "name": "Shivling in Temple Arch — White",
    "slug": "shivling-temple-white",
    "description": "A Shivling housed in a detailed white temple archway.",
    "price": 999,
    "compareAtPrice": 1249,
    "image": "/uploads/products/shivling-temple-white-1.jpg",
    "images": [
      "/uploads/products/shivling-temple-white-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "5-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-59",
    "name": "Veena Ganesh — Bronze",
    "slug": "veena-ganesh-bronze",
    "description": "Ganesh seated and playing the veena, warm bronze finish.",
    "price": 899,
    "compareAtPrice": 1099,
    "image": "/uploads/products/veena-ganesh-bronze-1.jpg",
    "images": [
      "/uploads/products/veena-ganesh-bronze-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-60",
    "name": "Veena Ganesh — Wood Brown",
    "slug": "veena-ganesh-brown",
    "description": "Ganesh seated and playing the veena, warm wood-brown finish.",
    "price": 899,
    "compareAtPrice": 1099,
    "image": "/uploads/products/veena-ganesh-brown-1.jpg",
    "images": [
      "/uploads/products/veena-ganesh-brown-1.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-61",
    "name": "Veena Ganesh — White",
    "slug": "veena-ganesh-white",
    "description": "Ganesh seated and playing the veena, clean white finish.",
    "price": 899,
    "compareAtPrice": 1099,
    "image": "/uploads/products/veena-ganesh-white.jpg",
    "images": [
      "/uploads/products/veena-ganesh-white.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-62",
    "name": "Ornate White Temple Model",
    "slug": "white-ornate-temple-model",
    "description": "A detailed white temple model with fine architectural carving.",
    "price": 1499,
    "compareAtPrice": 1849,
    "image": "/uploads/products/white-ornate-temple-model.jpg",
    "images": [
      "/uploads/products/white-ornate-temple-model.jpg"
    ],
    "category": "Devotional",
    "categorySlug": "devotional",
    "rawCategorySlug": "DEVOTIONAL",
    "badge": null,
    "leadTime": "5-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-63",
    "name": "Beige Cat Curio",
    "slug": "cat-figurine-beige-deskside",
    "description": "A soft, rounded cat curio in warm beige.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/cat-figurine-beige-deskside.jpg",
    "images": [
      "/uploads/products/cat-figurine-beige-deskside.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-64",
    "name": "Cartoon Cat Curio — Cream",
    "slug": "cat-figurine-cream-cartoon",
    "description": "A cheerful cartoon-style cat curio in cream.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/cat-figurine-cream-cartoon.jpg",
    "images": [
      "/uploads/products/cat-figurine-cream-cartoon.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-65",
    "name": "Smiling Sitting Cat Curio",
    "slug": "cat-figurine-smiling-sitting",
    "description": "A sitting cat curio with a soft smile.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/cat-figurine-smiling-sitting.jpg",
    "images": [
      "/uploads/products/cat-figurine-smiling-sitting.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-66",
    "name": "Palm-Sized White Cat Curio",
    "slug": "cat-figurine-white-handheld",
    "description": "A small white cat curio, sized to sit in your palm.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/cat-figurine-white-handheld.jpg",
    "images": [
      "/uploads/products/cat-figurine-white-handheld.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-67",
    "name": "Eiffel Tower Miniature",
    "slug": "eiffel-tower-miniature",
    "description": "A classic Eiffel Tower miniature in matte black.",
    "price": 349,
    "compareAtPrice": null,
    "image": "/uploads/products/eiffel-tower-miniature.jpg",
    "images": [
      "/uploads/products/eiffel-tower-miniature.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-68",
    "name": "Big-Eyed Kitten Curio",
    "slug": "kitten-figurine-big-eyes",
    "description": "A round-eyed kitten curio with an oversized, endearing gaze.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/kitten-figurine-big-eyes.jpg",
    "images": [
      "/uploads/products/kitten-figurine-big-eyes.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-69",
    "name": "Kitten on a Branch Curio",
    "slug": "kitten-figurine-branch",
    "description": "A small white kitten perched on a branch.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/kitten-figurine-branch.jpg",
    "images": [
      "/uploads/products/kitten-figurine-branch.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-70",
    "name": "Lounging Kitten Curio",
    "slug": "kitten-figurine-lying",
    "description": "A kitten curio mid-stretch, lying down and relaxed.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/kitten-figurine-lying.jpg",
    "images": [
      "/uploads/products/kitten-figurine-lying.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-71",
    "name": "Playful Monkey Curio — Orange",
    "slug": "monkey-figurine-orange",
    "description": "A playful monkey curio in bright orange.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/monkey-figurine-orange-1.jpg",
    "images": [
      "/uploads/products/monkey-figurine-orange-1.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-72",
    "name": "Bookish Owl Curio with Glasses",
    "slug": "owl-figurine-glasses",
    "description": "A little owl curio wearing round glasses — a study-desk piece.",
    "price": 449,
    "compareAtPrice": null,
    "image": "/uploads/products/owl-figurine-glasses-1.jpg",
    "images": [
      "/uploads/products/owl-figurine-glasses-1.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-73",
    "name": "Peacock Couple Curio — White",
    "slug": "peacock-couple-figurine-white",
    "description": "A pair of stylised birds with a peacock-feather accent — a couple's gift.",
    "price": 799,
    "compareAtPrice": 999,
    "image": "/uploads/products/peacock-couple-figurine-white-1.jpg",
    "images": [
      "/uploads/products/peacock-couple-figurine-white-1.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-74",
    "name": "Penguin Curio — Purple",
    "slug": "penguin-figurine-purple",
    "description": "A round, huggable penguin curio in soft purple.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/penguin-figurine-purple-1.jpg",
    "images": [
      "/uploads/products/penguin-figurine-purple-1.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-75",
    "name": "Pikachu Curio",
    "slug": "pikachu-figurine-standing",
    "description": "A standing Pikachu curio, arms raised.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/pikachu-figurine-standing-1.jpg",
    "images": [
      "/uploads/products/pikachu-figurine-standing-1.jpg"
    ],
    "category": "Curios",
    "categorySlug": "curio",
    "rawCategorySlug": "CURIO",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-76",
    "name": "Hoodie Pen Holder — Pink",
    "slug": "hoodie-pen-holder-pink",
    "description": "A tiny pink hoodie that holds pens and pencils upright.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/hoodie-pen-holder-pink-1.jpg",
    "images": [
      "/uploads/products/hoodie-pen-holder-pink-1.jpg"
    ],
    "category": "Desktop accessories",
    "categorySlug": "desktop-accessory",
    "rawCategorySlug": "DESKTOP_ACCESSORY",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-77",
    "name": "Hoodie Pen Holder — White",
    "slug": "hoodie-pen-holder-white",
    "description": "A tiny white hoodie that holds pens and pencils upright.",
    "price": 399,
    "compareAtPrice": null,
    "image": "/uploads/products/hoodie-pen-holder-white-1.jpg",
    "images": [
      "/uploads/products/hoodie-pen-holder-white-1.jpg"
    ],
    "category": "Desktop accessories",
    "categorySlug": "desktop-accessory",
    "rawCategorySlug": "DESKTOP_ACCESSORY",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-78",
    "name": "Instant-Photo Card Stand",
    "slug": "instax-photo-card-stand",
    "description": "A small stand that holds instant-style photo prints upright.",
    "price": 299,
    "compareAtPrice": null,
    "image": "/uploads/products/instax-photo-card-stand.jpg",
    "images": [
      "/uploads/products/instax-photo-card-stand.jpg"
    ],
    "category": "Desktop accessories",
    "categorySlug": "desktop-accessory",
    "rawCategorySlug": "DESKTOP_ACCESSORY",
    "badge": null,
    "leadTime": "2-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-79",
    "name": "Professional Desk Nameplate",
    "slug": "ca-professional-nameplate",
    "description": "A clean desk nameplate with name, title, and qualification.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/ca-professional-nameplate.jpg",
    "images": [
      "/uploads/products/ca-professional-nameplate.jpg"
    ],
    "category": "Name plates",
    "categorySlug": "name-plate",
    "rawCategorySlug": "NAME_PLATE",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-80",
    "name": "Faculty/Office Desk Nameplate",
    "slug": "professor-desk-nameplate",
    "description": "A desk nameplate for an office or faculty room.",
    "price": 599,
    "compareAtPrice": 749,
    "image": "/uploads/products/professor-desk-nameplate.jpg",
    "images": [
      "/uploads/products/professor-desk-nameplate.jpg"
    ],
    "category": "Name plates",
    "categorySlug": "name-plate",
    "rawCategorySlug": "NAME_PLATE",
    "badge": null,
    "leadTime": "3-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-81",
    "name": "Couple Photo Lithophane Lamp",
    "slug": "couple-photo-lithophane-lamp",
    "description": "A round lithophane lamp revealing a couple's photo when lit.",
    "price": 1499,
    "compareAtPrice": 1849,
    "image": "/uploads/products/couple-photo-lithophane-lamp.jpg",
    "images": [
      "/uploads/products/couple-photo-lithophane-lamp.jpg"
    ],
    "category": "Night lamps",
    "categorySlug": "night-lamp",
    "rawCategorySlug": "NIGHT_LAMP",
    "badge": null,
    "leadTime": "5-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-82",
    "name": "Personalized LED Teddy Lamp",
    "slug": "personalized-led-teddy-lamp",
    "description": "A glowing teddy-bear night lamp with a name on its base.",
    "price": 1099,
    "compareAtPrice": 1349,
    "image": "/uploads/products/personalized-led-teddy-lamp.jpg",
    "images": [
      "/uploads/products/personalized-led-teddy-lamp.jpg"
    ],
    "category": "Night lamps",
    "categorySlug": "night-lamp",
    "rawCategorySlug": "NIGHT_LAMP",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-83",
    "name": "Family Photo Lithophane Panel",
    "slug": "family-photo-lithophane-panel",
    "description": "A flat lithophane panel revealing a family photo when backlit.",
    "price": 799,
    "compareAtPrice": 999,
    "image": "/uploads/products/family-photo-lithophane-panel.jpg",
    "images": [
      "/uploads/products/family-photo-lithophane-panel.jpg"
    ],
    "category": "Lithophanes",
    "categorySlug": "lithophane-panel",
    "rawCategorySlug": "LITHOPHANE_PANEL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-84",
    "name": "Standing Photo Lithophane with Heart",
    "slug": "standing-photo-lithophane-heart",
    "description": "A standing lithophane photo panel with a small heart accent.",
    "price": 799,
    "compareAtPrice": 999,
    "image": "/uploads/products/standing-photo-lithophane-heart.jpg",
    "images": [
      "/uploads/products/standing-photo-lithophane-heart.jpg"
    ],
    "category": "Lithophanes",
    "categorySlug": "lithophane-panel",
    "rawCategorySlug": "LITHOPHANE_PANEL",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-85",
    "name": "Decorative Hand Sculpture",
    "slug": "decorative-hand-sculpture",
    "description": "An artistic sculptural hand piece — a conversation-starting decor object.",
    "price": 899,
    "compareAtPrice": 1099,
    "image": "/uploads/products/decorative-hand-sculpture.jpg",
    "images": [
      "/uploads/products/decorative-hand-sculpture.jpg"
    ],
    "category": "More gifts",
    "categorySlug": "other",
    "rawCategorySlug": "OTHER",
    "badge": null,
    "leadTime": "4-day print",
    "isFeatured": false,
    "isPopular": true,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  },
  {
    "id": "sp-86",
    "name": "Custom Achievement Trophy",
    "slug": "workshop-trophy-award-plaque",
    "description": "A custom trophy/award plaque for events — price varies, quote on request.",
    "price": 1299,
    "compareAtPrice": 1599,
    "image": "/uploads/products/workshop-trophy-award-plaque.jpg",
    "images": [
      "/uploads/products/workshop-trophy-award-plaque.jpg"
    ],
    "category": "More gifts",
    "categorySlug": "other",
    "rawCategorySlug": "OTHER",
    "badge": null,
    "leadTime": "5-day print",
    "isFeatured": false,
    "isPopular": false,
    "isActive": true,
    "stockQuantity": 25,
    "specifications": {
      "material": "Eco-Friendly PLA Bioplastic",
      "process": "High-Resolution FDM 3D Printing",
      "finish": "Smooth Layered Finish",
      "care": "Wipe with a soft dry cloth. Keep away from extreme direct heat (>50°C)."
    },
    "hasColors": false,
    "colors": [],
    "variants": [],
    "codEnabled": true
  }
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
