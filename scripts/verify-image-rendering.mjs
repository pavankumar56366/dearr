import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getImgProps } from "next/dist/shared/lib/get-img-props.js";
import loaderPkg from "next/dist/shared/lib/image-loader.js";
import {
  normalizeImageUrl,
  getProductPrimaryImage,
  getProductGalleryImages,
  isUploadPath,
  shouldBypassOptimization,
  DEFAULT_PRODUCT_FALLBACK_IMAGE,
} from "../src/lib/product-image.ts";

const defaultLoader = loaderPkg.default || loaderPkg;

console.log("=== Running Dearr Product Image Rendering Verification Suite ===\n");

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Config Check
test("next.config.mjs preserves default Next.js image optimization for static assets", () => {
  const content = fs.readFileSync(path.resolve("next.config.mjs"), "utf8");
  assert.ok(
    !/unoptimized:\s*true/.test(content),
    "next.config.mjs should not globally disable image optimization"
  );
  assert.match(content, /formats:\s*\["image\/avif",\s*"image\/webp"\]/);
});

// 2. Strict Upload Path Classification Checks
test("/uploads/products/example.png bypasses optimization", () => {
  assert.equal(
    isUploadPath("/uploads/products/example.png"),
    true,
    "/uploads/products/example.png must bypass optimization"
  );
  assert.equal(
    isUploadPath("/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png"),
    true,
    "Production cat upload path must bypass optimization"
  );
});

test("uploads/products/example.png is normalized and bypasses optimization where applicable", () => {
  const raw = "uploads/products/example.png";
  const normalized = normalizeImageUrl(raw);
  assert.equal(normalized, "/uploads/products/example.png", "Must normalize with leading slash");
  assert.equal(isUploadPath(raw), true, "Raw path without leading slash must bypass optimization");
  assert.equal(isUploadPath(normalized), true, "Normalized path must bypass optimization");
});

test("An absolute same-origin upload URL is handled correctly if used by this application", () => {
  assert.equal(
    isUploadPath("https://dearr.in/uploads/products/example.png"),
    true,
    "https://dearr.in/uploads/products/<file> must bypass optimization"
  );
  assert.equal(
    isUploadPath("http://localhost:3000/uploads/products/example.png"),
    true,
    "localhost absolute upload URL must bypass optimization"
  );
  assert.equal(
    isUploadPath("//dearr.in/uploads/products/example.png"),
    true,
    "protocol-relative upload URL must bypass optimization"
  );
});

test("/product-samples/1.jpeg retains normal optimization", () => {
  assert.equal(
    isUploadPath("/product-samples/1.jpeg"),
    false,
    "Static sample image must retain Next.js optimization"
  );
  assert.equal(
    isUploadPath("/brand/dearr-logo.png"),
    false,
    "Static brand logo must retain Next.js optimization"
  );
});

test("Unrelated external image URLs are not classified as Dearr upload paths", () => {
  assert.equal(
    isUploadPath("https://example.com/uploads/products/sample.png"),
    false,
    "Unrelated external domain with upload path must NOT be classified as Dearr upload"
  );
  assert.equal(
    isUploadPath("https://images.unsplash.com/uploads/products/photo.jpg"),
    false,
    "Unrelated external CDN must NOT be classified as Dearr upload"
  );
  assert.equal(
    isUploadPath("https://example.com/other.png"),
    false,
    "Unrelated external image URL must NOT be classified as upload path"
  );
  assert.equal(
    isUploadPath("data:image/png;base64,iVBORw0KGgo="),
    false,
    "Data URI must NOT be classified as upload path"
  );
  assert.equal(isUploadPath(null), false);
  assert.equal(isUploadPath(undefined), false);
  assert.equal(isUploadPath(""), false);
});

test("Missing images and fallback behavior remain correct", () => {
  assert.equal(normalizeImageUrl(null), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(normalizeImageUrl(undefined), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(normalizeImageUrl(""), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(normalizeImageUrl({}), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(isUploadPath(DEFAULT_PRODUCT_FALLBACK_IMAGE), false, "Default fallback must retain optimization");
});

test("shouldBypassOptimization preserves preview URLs and upload paths", () => {
  assert.equal(shouldBypassOptimization("blob:http://localhost:3000/1234"), true, "Blob preview URLs bypass optimization");
  assert.equal(shouldBypassOptimization("data:image/png;base64,1234"), true, "Data preview URLs bypass optimization");
  assert.equal(shouldBypassOptimization("/uploads/products/example.png"), true, "Upload paths bypass optimization");
  assert.equal(shouldBypassOptimization("/product-samples/1.jpeg"), false, "Static sample retains optimization");
  assert.equal(shouldBypassOptimization("https://example.com/photo.jpg"), false, "External remote image retains optimization");
});

// 3. Next.js Targeted getImgProps Behavior Check
test("Targeted optimization: Upload PNG renders direct URL without /_next/image proxy", () => {
  const defaultConfig = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    path: "/_next/image",
    loader: "default",
    formats: ["image/avif", "image/webp"],
  };

  const uploadSrc = "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png";
  const { props } = getImgProps(
    {
      src: uploadSrc,
      alt: "Cat",
      fill: true,
      unoptimized: isUploadPath(uploadSrc),
      sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
    },
    {
      imgConf: defaultConfig,
      defaultLoader,
    }
  );

  assert.equal(props.src, uploadSrc, "Rendered img src must be the direct root-relative upload URL");
  assert.equal(props.srcSet, undefined, "Direct upload image must not have /_next/image proxy srcSet");
});

test("Targeted optimization: Static asset preserves Next.js image optimization and AVIF/WebP srcSet", () => {
  const defaultConfig = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    path: "/_next/image",
    loader: "default",
    formats: ["image/avif", "image/webp"],
  };

  const staticSrc = "/product-samples/1.jpeg";
  const { props } = getImgProps(
    {
      src: staticSrc,
      alt: "Sample 1",
      fill: true,
      unoptimized: isUploadPath(staticSrc),
      sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
    },
    {
      imgConf: defaultConfig,
      defaultLoader,
    }
  );

  assert.match(
    props.src,
    /^\/_next\/image\?url=%2Fproduct-samples%2F1\.jpeg/,
    "Static asset must route through Next.js image optimizer"
  );
  assert.ok(props.srcSet && props.srcSet.includes("/_next/image"), "Static asset must have responsive srcSet");
});

// 4. Image URL Normalization Checks
test("normalizeImageUrl handles valid root-relative PNG URL", () => {
  const input = "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png";
  assert.equal(normalizeImageUrl(input), input);
});

test("normalizeImageUrl ensures leading slash when missing", () => {
  const input = "uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png";
  assert.equal(normalizeImageUrl(input), `/${input}`);
});

test("normalizeImageUrl extracts url from verified production API image record", () => {
  const productionImageRecord = {
    storagePath: "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png",
    url: "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png",
    altText: "WhatsApp Image 2026-10-10 at 11.24.13 PM.png",
    sortOrder: 0,
  };
  assert.equal(
    normalizeImageUrl(productionImageRecord),
    "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png"
  );
});

test("normalizeImageUrl handles database-style storage_path record", () => {
  const dbRecord = {
    storage_path: "/uploads/products/sample-idol.png",
    alt_text: "Idol",
    sort_order: 1,
  };
  assert.equal(normalizeImageUrl(dbRecord), "/uploads/products/sample-idol.png");
});

test("normalizeImageUrl falls back to storagePath when url is empty string", () => {
  const edgeCaseRecord = {
    url: "",
    storagePath: "/uploads/products/edge-case.png",
  };
  assert.equal(normalizeImageUrl(edgeCaseRecord), "/uploads/products/edge-case.png");
});

test("normalizeImageUrl preserves external HTTP/HTTPS URLs", () => {
  const httpsUrl = "https://images.example.com/products/3d-cat.png";
  assert.equal(normalizeImageUrl(httpsUrl), httpsUrl);
});

test("normalizeImageUrl falls back appropriately when image input is missing or empty", () => {
  assert.equal(normalizeImageUrl(null), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(normalizeImageUrl(undefined), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(normalizeImageUrl(""), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.equal(normalizeImageUrl({}), DEFAULT_PRODUCT_FALLBACK_IMAGE);
});

// 5. Product Primary & Gallery Image Extraction Checks
test("getProductPrimaryImage extracts first image from product with multiple images (Cat scenario)", () => {
  const catProduct = {
    id: "prod-cat-01",
    name: "Cat",
    slug: "cat",
    price: 349,
    images: [
      {
        storagePath: "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png",
        url: "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png",
        altText: "WhatsApp Image 2026-10-10 at 11.24.13 PM.png",
        sortOrder: 0,
      },
      {
        storagePath: "/uploads/products/cat-side.png",
        url: "/uploads/products/cat-side.png",
        altText: "Cat Side View",
        sortOrder: 1,
      },
      {
        storagePath: "/uploads/products/cat-top.png",
        url: "/uploads/products/cat-top.png",
        altText: "Cat Top View",
        sortOrder: 2,
      },
    ],
  };

  const primary = getProductPrimaryImage(catProduct);
  assert.equal(primary, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");

  const gallery = getProductGalleryImages(catProduct);
  assert.equal(gallery.length, 3);
  assert.equal(gallery[0], "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(gallery[1], "/uploads/products/cat-side.png");
  assert.equal(gallery[2], "/uploads/products/cat-top.png");
});

test("getProductPrimaryImage extracts single image from product with one image", () => {
  const singleImageProduct = {
    id: "prod-single-01",
    name: "Desk Organizer",
    slug: "desk-organizer",
    price: 499,
    images: [
      {
        storagePath: "/uploads/products/desk-org.png",
        url: "/uploads/products/desk-org.png",
      },
    ],
  };

  assert.equal(getProductPrimaryImage(singleImageProduct), "/uploads/products/desk-org.png");
  assert.deepEqual(getProductGalleryImages(singleImageProduct), ["/uploads/products/desk-org.png"]);
});

test("getProductPrimaryImage supports product.image convenience property", () => {
  const productWithImageProp = {
    id: "prod-prop-01",
    name: "Keychain",
    slug: "keychain",
    price: 149,
    image: "/uploads/products/keychain.png",
  };

  assert.equal(getProductPrimaryImage(productWithImageProp), "/uploads/products/keychain.png");
  assert.deepEqual(getProductGalleryImages(productWithImageProp), ["/uploads/products/keychain.png"]);
});

test("getProductPrimaryImage returns fallback when product has no images", () => {
  const emptyProduct = {
    id: "prod-empty-01",
    name: "Custom Prototype",
    slug: "custom-prototype",
    price: 999,
    images: [],
  };

  assert.equal(getProductPrimaryImage(emptyProduct), DEFAULT_PRODUCT_FALLBACK_IMAGE);
  assert.deepEqual(getProductGalleryImages(emptyProduct), [DEFAULT_PRODUCT_FALLBACK_IMAGE]);
});

// 6. Storefront Flow Simulation Check across all customer and admin views
test("Simulated storefront and admin components render direct root-relative source for Cat product", () => {
  const catProduct = {
    id: "prod-cat-01",
    name: "Cat",
    slug: "cat",
    price: 349,
    images: [
      {
        storagePath: "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png",
        url: "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png",
        altText: "WhatsApp Image 2026-10-10 at 11.24.13 PM.png",
        sortOrder: 0,
      },
    ],
  };

  // Home page ProductCard simulation
  const homeCardSrc = getProductPrimaryImage(catProduct);
  assert.equal(homeCardSrc, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(isUploadPath(homeCardSrc), true);

  // Shop page ListProductCard simulation
  const shopListCardSrc = getProductPrimaryImage(catProduct);
  assert.equal(shopListCardSrc, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(isUploadPath(shopListCardSrc), true);

  // SearchOverlay trending simulation
  const trendingItem = {
    id: catProduct.id,
    title: catProduct.name,
    href: `/product/${catProduct.slug}`,
    image: getProductPrimaryImage(catProduct),
    price: Number(catProduct.price),
  };
  assert.equal(trendingItem.image, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(isUploadPath(trendingItem.image), true);

  // ProductDetail gallery simulation
  const galleryImages = getProductGalleryImages(catProduct);
  const mainImage = galleryImages[0] || getProductPrimaryImage(catProduct);
  assert.equal(mainImage, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(isUploadPath(mainImage), true);

  // Cart item thumbnail simulation
  const cartItem = {
    product: catProduct,
    image: getProductPrimaryImage(catProduct),
  };
  assert.equal(cartItem.image, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(isUploadPath(cartItem.image), true);

  // Admin Product Summary simulation
  const adminSummarySrc = getProductPrimaryImage(catProduct);
  assert.equal(adminSummarySrc, "/uploads/products/3b33cc38-d2b8-4f5c-ba28-9be9ded49a53.png");
  assert.equal(isUploadPath(adminSummarySrc), true);
});

console.log(`\nAll ${passedTests} regression checks PASSED successfully!`);
