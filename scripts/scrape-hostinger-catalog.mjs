import fs from "fs";
import path from "path";

const BASE_URL = "https://purple-leopard-280444.hostingersite.com";
const TARGET_DIR = path.resolve(process.cwd(), "public/uploads/products");

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Helper to delay between requests to be polite
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));
    }
  }
}

async function scrapeShop() {
  console.log("=== STEP 1: Scraping /shop page ===");
  const shopRes = await fetchWithRetry(`${BASE_URL}/shop`);
  const shopHtml = await shopRes.text();

  // 1. Extract categories
  const catRegex = /href="\/shop\?category=([^"]+)">([^<]+)<span[^>]*>(\d+)<\/span>/g;
  let catMatch;
  const categories = [];
  while ((catMatch = catRegex.exec(shopHtml)) !== null) {
    categories.push({
      slug: catMatch[1].trim(),
      name: catMatch[2].trim(),
      productCount: parseInt(catMatch[3], 10),
    });
  }
  console.log(`Found ${categories.length} categories on /shop:`);
  categories.forEach((c) => console.log(`  - ${c.name} (${c.slug}): ${c.productCount} products`));

  // 2. Map category -> product slugs by fetching each category page
  console.log("\n=== STEP 2: Mapping categories to products ===");
  const categoryProductsMap = new Map(); // prodSlug -> categorySlug
  for (const cat of categories) {
    console.log(`Fetching category page: ${cat.name} (${cat.slug})...`);
    try {
      const catRes = await fetchWithRetry(`${BASE_URL}/shop?category=${encodeURIComponent(cat.slug)}`);
      const catHtml = await catRes.text();
      const prodInCatRegex = /<a class="group block" href="\/shop\/([^"]+)">/g;
      let pm;
      let count = 0;
      while ((pm = prodInCatRegex.exec(catHtml)) !== null) {
        const pSlug = pm[1].trim();
        categoryProductsMap.set(pSlug, cat.slug);
        count++;
      }
      console.log(`  -> Matched ${count} products for category ${cat.slug}`);
      await sleep(300);
    } catch (e) {
      console.error(`  Error fetching category ${cat.slug}:`, e.message);
    }
  }

  // 3. Extract all product cards from the main /shop page
  console.log("\n=== STEP 3: Parsing all product cards ===");
  const prodCardRegex = /<a class="group block" href="(\/shop\/[^"]+)">([\s\S]*?)<\/a>/g;
  let cardMatch;
  const rawProducts = [];
  while ((cardMatch = prodCardRegex.exec(shopHtml)) !== null) {
    const url = cardMatch[1];
    const inner = cardMatch[2];

    const slug = url.replace("/shop/", "").trim();
    const imgSrcMatch = /<img [^>]*src="([^"]+)"/i.exec(inner);
    const imgAltMatch = /<img [^>]*alt="([^"]+)"/i.exec(inner);
    const titleMatch = /<p class="text-sm font-medium text-foreground">([^<]+)<\/p>/i.exec(inner);
    const tagMatch = /<p class="text-xs text-brand-primary">([^<]+)<\/p>/i.exec(inner);
    const priceMatch = /<span class="text-sm font-semibold">₹([^<]+)<\/span>/i.exec(inner);
    const printTimeMatch = /<span class="inline-flex items-center rounded-full[^>]*>([^<]+(?:<!-- -->)?[^<]*)<\/span>/i.exec(inner);

    const priceNum = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : 0;
    const leadTimeStr = printTimeMatch ? printTimeMatch[1].replace(/<!-- -->/g, "").trim() : null;

    rawProducts.push({
      slug,
      name: titleMatch ? titleMatch[1].trim() : (imgAltMatch ? imgAltMatch[1].trim() : slug),
      thumbnail: imgSrcMatch ? imgSrcMatch[1].trim() : null,
      price: priceNum,
      badge: tagMatch ? tagMatch[1].trim() : null,
      leadTime: leadTimeStr,
      categorySlug: categoryProductsMap.get(slug) || "OTHER",
    });
  }

  console.log(`Extracted ${rawProducts.length} product cards.`);

  // 4. Fetch details for each product
  console.log("\n=== STEP 4: Fetching individual product detail pages ===");
  const fullProducts = [];
  const allImagesToDownload = new Set();

  for (let i = 0; i < rawProducts.length; i++) {
    const p = rawProducts[i];
    console.log(`[${i + 1}/${rawProducts.length}] Fetching ${p.slug}...`);
    try {
      const detailRes = await fetchWithRetry(`${BASE_URL}/shop/${p.slug}`);
      const detailHtml = await detailRes.text();

      // Extract Description
      const descMatch = detailHtml.match(/<p class="mt-3 text-foreground-muted">([^<]+)<\/p>/);
      const description = descMatch ? descMatch[1].trim() : `${p.name} - high-quality 3D printed creation.`;

      // Extract Category badge from page if categoryProductsMap missed it
      const catBadgeMatch = detailHtml.match(/<span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-brand-primary-light text-brand-primary-dark">([^<]+)<\/span>/);
      let catNameFromPage = catBadgeMatch ? catBadgeMatch[1].trim() : null;

      // Extract all images from page
      const imgRegex = /src="(\/uploads\/products\/[^"]+)"/g;
      let im;
      const images = [];
      while ((im = imgRegex.exec(detailHtml)) !== null) {
        images.push(im[1]);
        allImagesToDownload.add(im[1]);
      }
      if (p.thumbnail) {
        images.unshift(p.thumbnail);
        allImagesToDownload.add(p.thumbnail);
      }
      const uniqueImages = Array.from(new Set(images));

      // Extract Color options if any
      const colorSectionMatch = detailHtml.match(/<div><p class="mb-2 text-sm font-medium">Colou?r<\/p><div class="flex flex-wrap gap-2">([\s\S]*?)<\/div><\/div>/i);
      const colors = [];
      if (colorSectionMatch) {
        const btnRegex = /<button[^>]*>([^<]+)<\/button>/g;
        let bm;
        while ((bm = btnRegex.exec(colorSectionMatch[1])) !== null) {
          colors.push(bm[1].trim());
        }
      }

      // Extract Size options if any
      const sizeSectionMatch = detailHtml.match(/<div><p class="mb-2 text-sm font-medium">Size<\/p><div class="flex flex-wrap gap-2">([\s\S]*?)<\/div><\/div>/i);
      const sizes = [];
      if (sizeSectionMatch) {
        const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
        let bm;
        while ((bm = btnRegex.exec(sizeSectionMatch[1])) !== null) {
          const rawBtn = bm[1].replace(/<!-- -->/g, "").trim();
          sizes.push(rawBtn);
        }
      }

      // Extract Personalization fields if any
      const hasCustomText = /placeholder="Enter custom text/i.test(detailHtml) || /Personalize with text/i.test(detailHtml);
      const hasPhotoUpload = /Upload photo/i.test(detailHtml) || /Personalize with your photo/i.test(detailHtml);

      // Match category name to category object
      const matchedCat = categories.find((c) => c.slug === p.categorySlug);
      const categoryName = matchedCat ? matchedCat.name : (catNameFromPage || "More gifts");

      fullProducts.push({
        id: `sp-${String(i + 1).padStart(2, "0")}`,
        name: p.name,
        slug: p.slug,
        description,
        price: p.price,
        compareAtPrice: p.price > 500 ? Math.round(p.price * 1.25 / 50) * 50 - 1 : null,
        image: uniqueImages[0] || p.thumbnail,
        images: uniqueImages,
        category: categoryName,
        categorySlug: p.categorySlug.toLowerCase().replace(/_/g, "-"),
        rawCategorySlug: p.categorySlug,
        badge: p.badge,
        leadTime: p.leadTime,
        colors,
        sizes,
        isCustomizable: hasCustomText || hasPhotoUpload,
        customizationType: hasPhotoUpload ? "photo" : (hasCustomText ? "text" : null),
        isFeatured: i < 12 || p.badge !== null,
        isPopular: i % 3 === 0,
        isActive: true,
        stockQuantity: 25,
      });

      await sleep(150);
    } catch (e) {
      console.error(`  Error fetching product ${p.slug}:`, e.message);
      // Fallback with what we have
      fullProducts.push({
        id: `sp-${String(i + 1).padStart(2, "0")}`,
        name: p.name,
        slug: p.slug,
        description: `${p.name} - high-quality 3D printed creation.`,
        price: p.price,
        compareAtPrice: null,
        image: p.thumbnail,
        images: p.thumbnail ? [p.thumbnail] : [],
        category: p.categorySlug,
        categorySlug: p.categorySlug.toLowerCase().replace(/_/g, "-"),
        rawCategorySlug: p.categorySlug,
        badge: p.badge,
        leadTime: p.leadTime,
        colors: [],
        sizes: [],
        isCustomizable: false,
        isFeatured: i < 12,
        isPopular: true,
        isActive: true,
        stockQuantity: 20,
      });
    }
  }

  // 5. Download all images
  console.log(`\n=== STEP 5: Downloading ${allImagesToDownload.size} unique product images ===`);
  const imageList = Array.from(allImagesToDownload);
  let downloadedCount = 0;
  let skippedCount = 0;

  for (let idx = 0; idx < imageList.length; idx++) {
    const imgPath = imageList[idx];
    const filename = path.basename(imgPath);
    const localDest = path.join(TARGET_DIR, filename);

    if (fs.existsSync(localDest) && fs.statSync(localDest).size > 1000) {
      skippedCount++;
      continue;
    }

    const fullImgUrl = `${BASE_URL}${imgPath}`;
    try {
      const imgRes = await fetchWithRetry(fullImgUrl);
      const buffer = await imgRes.arrayBuffer();
      fs.writeFileSync(localDest, Buffer.from(buffer));
      downloadedCount++;
      if (downloadedCount % 10 === 0 || idx === imageList.length - 1) {
        console.log(`  Downloaded ${downloadedCount}/${imageList.length} images...`);
      }
    } catch (err) {
      console.error(`  Failed to download ${fullImgUrl}:`, err.message);
    }
  }
  console.log(`Image download finished: ${downloadedCount} downloaded, ${skippedCount} existing.`);

  // Also sync images to dearr-original if it exists
  const dearrOrigDir = path.resolve("d:/Desktop/dearr-original/public/uploads/products");
  if (fs.existsSync(path.dirname(dearrOrigDir))) {
    try {
      if (!fs.existsSync(dearrOrigDir)) {
        fs.mkdirSync(dearrOrigDir, { recursive: true });
      }
      for (const imgPath of imageList) {
        const filename = path.basename(imgPath);
        const srcFile = path.join(TARGET_DIR, filename);
        const destFile = path.join(dearrOrigDir, filename);
        if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
          fs.copyFileSync(srcFile, destFile);
        }
      }
      console.log(`Synced images to dearr-original/public/uploads/products!`);
    } catch (e) {
      console.warn("Could not copy to dearr-original:", e.message);
    }
  }

  // 6. Save JSON snapshots
  fs.writeFileSync("scratch/hostinger_categories.json", JSON.stringify(categories, null, 2));
  fs.writeFileSync("scratch/hostinger_products.json", JSON.stringify(fullProducts, null, 2));
  console.log("\nSaved data to scratch/hostinger_categories.json and scratch/hostinger_products.json");

  return { categories, fullProducts };
}

scrapeShop().then(() => {
  console.log("=== SCRAPING COMPLETED SUCCESSFULLY ===");
}).catch((err) => {
  console.error("Scraping failed:", err);
  process.exit(1);
});
