import { chromium } from "playwright-core";
import path from "path";
import fs from "fs";
import assert from "assert";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "test-results", "browser-screenshots-logo");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function ensureImageLoaded(locator) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.evaluate(async (img) => {
    if (!img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 5000);
      });
    }
    if (typeof img.decode === "function") {
      await img.decode().catch(() => {});
    }
  });
}

async function runBrowserLogoTests() {
  console.log("================================================================================");
  console.log("DEARR AUTOMATED PLAYWRIGHT LOGO BROWSER VERIFICATION");
  console.log("================================================================================\n");

  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  }

  console.log("  [INFO] Headless browser launched successfully.\n");

  // TEST 1: Desktop Storefront Header & Footer
  {
    console.log("--- 1. Testing Desktop Storefront (Header & Footer) ---");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Header Logo
    const headerLogo = page.locator('header.md\\:block a[aria-label="Dearr Home"] img[src*="dearr-logo"]');
    await ensureImageLoaded(headerLogo);

    const headerLogoData = await headerLogo.evaluate((img) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      currentSrc: img.currentSrc,
      offsetWidth: img.offsetWidth,
      offsetHeight: img.offsetHeight,
    }));

    console.log("  Header Logo Data:", headerLogoData);
    assert(headerLogoData.complete, "Header logo must load completely");
    assert(headerLogoData.naturalWidth > 0, "Header logo must have non-zero natural width");
    assert(headerLogoData.naturalHeight > 0, "Header logo must have non-zero natural height");
    assert(headerLogoData.offsetWidth > 0, "Header logo must be visually rendered with non-zero width");

    // Screenshot Desktop Header
    await page.locator("header.md\\:block").screenshot({
      path: path.join(SCREENSHOT_DIR, "desktop_header_logo.png"),
    });
    console.log("  [PASS] Desktop header logo verified and captured.");

    // Footer Logo
    const footerLogo = page.locator('footer a[aria-label="Dearr Home"] img[src*="dearr-logo"]');
    await footerLogo.scrollIntoViewIfNeeded();
    await ensureImageLoaded(footerLogo);

    const footerLogoData = await footerLogo.evaluate((img) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      offsetWidth: img.offsetWidth,
      offsetHeight: img.offsetHeight,
    }));

    console.log("  Footer Logo Data:", footerLogoData);
    assert(footerLogoData.complete, "Footer logo must load completely");
    assert(footerLogoData.offsetWidth > 0, "Footer logo must be visually rendered");

    await page.locator('footer a[aria-label="Dearr Home"]').screenshot({
      path: path.join(SCREENSHOT_DIR, "desktop_footer_logo.png"),
    });
    console.log("  [PASS] Desktop footer logo verified and captured.");

    await page.close();
  }

  // TEST 2: Mobile Storefront Header
  {
    console.log("\n--- 2. Testing Mobile Storefront (Mobile Header) ---");
    const page = await browser.newPage({
      viewport: { width: 375, height: 667 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const mobileHeaderLogo = page.locator('header.md\\:hidden a[aria-label="Dearr Home"] img[src*="dearr-logo"]');
    await ensureImageLoaded(mobileHeaderLogo);

    const mobileLogoData = await mobileHeaderLogo.evaluate((img) => ({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      offsetWidth: img.offsetWidth,
      offsetHeight: img.offsetHeight,
    }));

    console.log("  Mobile Header Logo Data:", mobileLogoData);
    assert(mobileLogoData.complete, "Mobile header logo must load completely");
    assert(mobileLogoData.offsetWidth > 0, "Mobile logo must be visually rendered");

    await page.locator("header.md\\:hidden").screenshot({
      path: path.join(SCREENSHOT_DIR, "mobile_header_logo.png"),
    });
    console.log("  [PASS] Mobile header logo verified and captured.");

    await page.close();
  }

  // TEST 3: Login View (Desktop & Mobile)
  {
    console.log("\n--- 3. Testing Customer Login View ---");
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const loginLogo = page.locator('a[aria-label="Dearr Home"] img[src*="dearr-logo"]').first();
    await loginLogo.waitFor({ state: "visible", timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "login_page_desktop.png"),
      fullPage: false,
    });
    console.log("  [PASS] Customer login page verified and captured.");
    await page.close();
  }

  // TEST 4: Admin Login View
  {
    console.log("\n--- 4. Testing Admin Login View ---");
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

    const adminLogo = page.locator('img[src*="dearr-logo"]').first();
    await adminLogo.waitFor({ state: "visible", timeout: 5000 });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "admin_login_page.png"),
      fullPage: false,
    });
    console.log("  [PASS] Admin login page verified and captured.");
    await page.close();
  }

  await browser.close();

  console.log("\n================================================================================");
  console.log("ALL BROWSER LOGO VERIFICATIONS PASSED (100%)");
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log("================================================================================\n");
}

runBrowserLogoTests().catch((err) => {
  console.error("[BROWSER TEST FAILED]:", err);
  process.exit(1);
});
