// Mock 'server-only' for Node standalone scripts
try {
  const p = require.resolve("server-only");
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch (_) {}

import { query } from "../src/lib/server/db";
import { hashPassword } from "../src/lib/server/auth";
import { createProduct } from "../src/lib/server/product";
import { loadTestEnvironment, assertTestDatabaseSafety } from "./test-db-safety";

// 1. Strict Fail-Closed Loopback Safeguard
loadTestEnvironment();
assertTestDatabaseSafety();

export async function seedBrowserFixtures() {
  console.log("Seeding test fixtures into dearr_test...");

  // Category
  await query(`
    INSERT INTO categories (id, name, slug, description, is_active)
    VALUES ('cat-001', 'Gifts', 'gifts', '3D Printed Gifts and Keepsakes', 1)
    ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1
  `);

  // Ensure test customer & session
  const passwordHash = await hashPassword("Password123!");
  const customerId = "c0000000-0000-0000-0000-000000000001";
  await query(`
    INSERT INTO profiles (id, email, password_hash, full_name, role, status)
    VALUES (?, 'ui_cust@dearr.test', ?, 'Test Customer UI', 'customer', 'active')
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'customer', status = 'active'
  `, [customerId, passwordHash]);

  // Clean previous test fixture products
  const fixtureSlugs = [
    "articulated-crystal-dragon",
    "restricted-display-model",
    "geometric-moon-lamp",
    "hexagonal-geometric-desk-planter",
  ];
  const placeholders = fixtureSlugs.map(() => "?").join(",");
  const existingProds = await query<any[]>(`SELECT id FROM products WHERE slug IN (${placeholders})`, fixtureSlugs);
  if (existingProds && existingProds.length > 0) {
    const pIds = existingProds.map((p) => p.id);
    const pPlaceholders = pIds.map(() => "?").join(",");
    await query(`DELETE FROM stock_reservations WHERE product_id IN (${pPlaceholders})`, pIds);
    await query(`DELETE FROM cart_items WHERE product_id IN (${pPlaceholders})`, pIds);
    await query(`DELETE FROM product_variants WHERE product_id IN (${pPlaceholders})`, pIds);
    await query(`DELETE FROM product_images WHERE product_id IN (${pPlaceholders})`, pIds);
    await query(`DELETE FROM product_colors WHERE product_id IN (${pPlaceholders})`, pIds);
    await query(`DELETE FROM products WHERE id IN (${pPlaceholders})`, pIds);
  }

  // PRODUCT 1: Color-Size Combinations
  const colRedId = "col-drg-red";
  const colBlueId = "col-drg-blue";
  await createProduct({
    id: "prod-test-dragon-001",
    categoryId: "cat-001",
    name: "Articulated Crystal Dragon",
    slug: "articulated-crystal-dragon",
    description: "Handcrafted 3D printed articulated dragon with customizable colors and sizes.",
    price: 299.00,
    compareAtPrice: 399.00,
    stockQuantity: 50,
    isActive: true,
    isFeatured: true,
    hasColors: true,
    images: [
      {
        id: "img-drg-main",
        storagePath: "/product-samples/1.jpeg",
        altText: "Articulated Crystal Dragon",
        sortOrder: 0,
      },
    ],
    colors: [
      {
        id: colRedId,
        name: "Crimson Red",
        slug: "crimson-red",
        hex: "#DC2626",
        sku: "DRG-RED",
        priceOverride: 349.00,
        stock: 30,
        isActive: true,
        sortOrder: 0,
      },
      {
        id: colBlueId,
        name: "Sapphire Blue",
        slug: "sapphire-blue",
        hex: "#2563EB",
        sku: "DRG-BLU",
        priceOverride: null,
        stock: 25,
        isActive: true,
        sortOrder: 1,
      },
    ],
    variants: [
      {
        id: "var-drg-red-s",
        colorId: colRedId,
        sizeName: "Small",
        name: "Crimson Red / Small (15cm)",
        sku: "DRG-RED-S",
        price: 499.00,
        stockQuantity: 10,
        isActive: true,
      },
      {
        id: "var-drg-red-m",
        colorId: colRedId,
        sizeName: "Medium",
        name: "Crimson Red / Medium (25cm)",
        sku: "DRG-RED-M",
        price: null,
        stockQuantity: 15,
        isActive: true,
      },
      {
        id: "var-drg-red-free",
        colorId: colRedId,
        sizeName: "Sample",
        name: "Crimson Red / Sample Keychain",
        sku: "DRG-RED-FREE",
        price: 0.00,
        stockQuantity: 5,
        isActive: true,
      },
      {
        id: "var-drg-red-oos",
        colorId: colRedId,
        sizeName: "Giant",
        name: "Crimson Red / Giant (50cm)",
        sku: "DRG-RED-GIANT",
        price: 999.00,
        stockQuantity: 0,
        isActive: true,
      },
      {
        id: "var-drg-red-inact",
        colorId: colRedId,
        sizeName: "Collector",
        name: "Crimson Red / Collector Edition",
        sku: "DRG-RED-COLLECTOR",
        price: 1299.00,
        stockQuantity: 20,
        isActive: false,
      },
      {
        id: "var-drg-blu-s",
        colorId: colBlueId,
        sizeName: "Small",
        name: "Sapphire Blue / Small (15cm)",
        sku: "DRG-BLU-S",
        price: 449.00,
        stockQuantity: 8,
        isActive: true,
      },
      {
        id: "var-drg-blu-xl",
        colorId: colBlueId,
        sizeName: "Extra-Large",
        name: "Sapphire Blue / Extra-Large (35cm)",
        sku: "DRG-BLU-XL",
        price: null,
        stockQuantity: 12,
        isActive: true,
      },
    ],
  });

  // PRODUCT 2: All variants unavailable
  const colObsidianId = "col-obsidian-002";
  await createProduct({
    id: "prod-test-restricted-002",
    categoryId: "cat-001",
    name: "Restricted Display Model",
    slug: "restricted-display-model",
    description: "Display model with restricted variant availability.",
    price: 500.00,
    stockQuantity: 20,
    isActive: true,
    isFeatured: false,
    hasColors: true,
    images: [
      {
        id: "img-rest-main",
        storagePath: "/product-samples/2.jpeg",
        altText: "Restricted Model",
        sortOrder: 0,
      },
    ],
    colors: [
      {
        id: colObsidianId,
        name: "Obsidian Black",
        slug: "obsidian-black",
        hex: "#18181B",
        sku: "REST-OBS",
        priceOverride: null,
        stock: 20,
        isActive: true,
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: "var-rest-inact",
        colorId: colObsidianId,
        sizeName: "Standard",
        name: "Obsidian / Standard",
        sku: "REST-OBS-STD",
        price: 500.00,
        stockQuantity: 10,
        isActive: false,
      },
      {
        id: "var-rest-oos",
        colorId: colObsidianId,
        sizeName: "Deluxe",
        name: "Obsidian / Deluxe",
        sku: "REST-OBS-DLX",
        price: 650.00,
        stockQuantity: 0,
        isActive: true,
      },
    ],
  });

  // PRODUCT 3: Pure color-only product (no variants)
  await createProduct({
    id: "prod-test-lamp-003",
    categoryId: "cat-001",
    name: "Geometric Moon Lamp",
    slug: "geometric-moon-lamp",
    description: "Ambient 3D printed sphere lamp with warm or cool lighting.",
    price: 399.00,
    compareAtPrice: 499.00,
    stockQuantity: 35,
    isActive: true,
    isFeatured: false,
    hasColors: true,
    images: [
      {
        id: "img-lamp-main",
        storagePath: "/product-samples/3.jpeg",
        altText: "Moon Lamp",
        sortOrder: 0,
      },
    ],
    colors: [
      {
        id: "col-lamp-warm",
        name: "Warm White Glow",
        slug: "warm-white-glow",
        hex: "#FEF3C7",
        sku: "LAMP-WRM",
        priceOverride: 399.00,
        stock: 20,
        isActive: true,
        sortOrder: 0,
      },
      {
        id: "col-lamp-cool",
        name: "Cool Daylight Glow",
        slug: "cool-daylight-glow",
        hex: "#E0F2FE",
        sku: "LAMP-COL",
        priceOverride: 449.00,
        stock: 15,
        isActive: true,
        sortOrder: 1,
      },
      {
        id: "col-lamp-aura",
        name: "Midnight Aura Glow",
        slug: "midnight-aura-glow",
        hex: "#818CF8",
        sku: "LAMP-AUR",
        priceOverride: 499.00,
        stock: 0,
        isActive: true,
        sortOrder: 2,
      },
    ],
  });

  // PRODUCT 4: Simple product without colors or variants
  await createProduct({
    id: "prod-test-planter-004",
    categoryId: "cat-001",
    name: "Hexagonal Geometric Desk Planter",
    slug: "hexagonal-geometric-desk-planter",
    description: "Modern geometric succulent planter 3D printed with drainage holes.",
    price: 199.00,
    compareAtPrice: 249.00,
    stockQuantity: 25,
    isActive: true,
    isFeatured: false,
    hasColors: false,
    images: [
      {
        id: "img-plnt-main",
        storagePath: "/product-samples/4.jpeg",
        altText: "Desk Planter",
        sortOrder: 0,
      },
    ],
  });

  console.log("Seeding complete! 4 test products created in dearr_test.");
}

seedBrowserFixtures()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed browser fixtures:", err);
    process.exit(1);
  });
