import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";
import { SAMPLE_CATEGORIES, SAMPLE_PRODUCTS } from "../../src/data/sample-products";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function seed() {
  console.log("Seeding Dearr 3D printing catalog into Hostinger MySQL...");
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    // 1. Seed Categories
    const categoryIdMap = new Map<string, string>(); // slug -> id
    for (const cat of SAMPLE_CATEGORIES) {
      const [existing]: any = await pool.execute(
        "SELECT id FROM categories WHERE slug = ? LIMIT 1",
        [cat.slug]
      );
      let catId: string;
      if (existing && existing.length > 0) {
        catId = existing[0].id;
      } else {
        catId = crypto.randomUUID();
        await pool.execute(
          "INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)",
          [catId, cat.name, cat.slug, cat.description]
        );
        console.log(`✓ Inserted category: ${cat.name} (${cat.slug}) -> ${catId}`);
      }
      categoryIdMap.set(cat.slug, catId);
    }

    // 2. Seed Products
    for (const prod of SAMPLE_PRODUCTS) {
      const [existing]: any = await pool.execute(
        "SELECT id FROM products WHERE slug = ? LIMIT 1",
        [prod.slug]
      );
      let prodId: string;
      const catId = categoryIdMap.get(prod.categorySlug) || null;

      if (existing && existing.length > 0) {
        prodId = existing[0].id;
        console.log(`- Product already exists: ${prod.name} (${prod.slug})`);
      } else {
        prodId = crypto.randomUUID();
        await pool.execute(
          `INSERT INTO products (
            id, category_id, name, slug, description, price, compare_at_price,
            stock_quantity, is_featured, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prodId,
            catId,
            prod.name,
            prod.slug,
            prod.description,
            prod.price,
            prod.compareAtPrice,
            prod.stockQuantity,
            prod.isFeatured ? 1 : 0,
            prod.isActive ? 1 : 0,
          ]
        );
        console.log(`✓ Inserted product: ${prod.name} (${prod.slug}) -> ${prodId}`);

        // Insert primary product image
        if (prod.image) {
          const imgId = crypto.randomUUID();
          await pool.execute(
            "INSERT INTO product_images (id, product_id, storage_path, alt_text, sort_order) VALUES (?, ?, ?, ?, 0)",
            [imgId, prodId, prod.image, prod.name]
          );
        }

        // Insert sample variants if defined
        if (prod.variants && prod.variants.length > 0) {
          for (const variant of prod.variants) {
            const varId = crypto.randomUUID();
            await pool.execute(
              "INSERT INTO product_variants (id, product_id, name, sku, price, stock_quantity, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [
                varId,
                prodId,
                variant.name,
                variant.sku || `SKU-${prod.slug.slice(0, 10).toUpperCase()}-${varId.slice(0, 4)}`,
                variant.price ?? prod.price,
                variant.stockQuantity,
                variant.isActive ? 1 : 0,
              ]
            );
          }
        }
      }
    }

    const [finalCats]: any = await pool.execute("SELECT COUNT(*) as count FROM categories WHERE is_active = 1");
    const [finalProds]: any = await pool.execute("SELECT COUNT(*) as count FROM products WHERE is_active = 1");
    console.log(`\nCatalog seeding complete! Active categories: ${finalCats[0].count}, Active products: ${finalProds[0].count}`);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
