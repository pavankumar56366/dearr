import {
  HeroSection,
  CategoryChips,
  ProductGrid,
  PromotionBanner,
  TrustSection,
  Footer,
} from "@/components/customer/home";
import { listCategories, listProducts, type Category, type Product } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Dearr V1 Customer Home Page
 * 3D Printing E-Commerce Storefront
 * Connected directly to Hostinger MySQL Catalog APIs.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1
 * Flow Ref: docs/3.APPFLOW(1).md §3.1
 *
 * Layout (top to bottom):
 * 1. Header (in layout.tsx)
 * 2. Hero (3D Printing brand showcase)
 * 3. Category Row (Real 3D printing active categories from MySQL)
 * 4. Featured 3D Prints (Real active featured products from MySQL)
 * 5. Promotion Banner (Custom 3D prints)
 * 6. Popular Creations (Real active newest products from MySQL)
 * 7. Trust Section (3D precision & quality signals)
 * 8. Footer
 * 9. Bottom Navigation (in layout.tsx, mobile only)
 */
export default async function HomePage() {
  let categories: Category[] = [];
  let featuredProducts: Product[] = [];
  let popularProducts: Product[] = [];
  let fetchError: string | null = null;

  try {
    const [cats, featRes, popRes] = await Promise.all([
      listCategories({ isActive: true }),
      listProducts({ isActive: true, isFeatured: true, pageSize: 8 }),
      listProducts({ isActive: true, sort: "newest", pageSize: 8 }),
    ]);
    categories = cats;
    featuredProducts = featRes.products;
    popularProducts = popRes.products;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Database fetch failed";
    console.error("[Home Page Data Fetch Error]", errorMsg);
    fetchError = "Unable to load latest collections right now. Please try refreshing.";
  }

  return (
    <main id="home-page">
      <HeroSection />

      {fetchError && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          <div
            className="rounded-2xl p-4 text-center text-sm font-medium"
            style={{
              background: "#FFF5F5",
              color: "#C53030",
              border: "1px solid #FEB2B2",
            }}
          >
            {fetchError}
          </div>
        </div>
      )}

      {categories.length > 0 && <CategoryChips initialCategories={categories} />}

      {featuredProducts.length > 0 && (
        <ProductGrid
          title="Featured 3D Prints"
          viewAllHref="/shop?featured=true"
          products={featuredProducts}
        />
      )}

      <PromotionBanner />

      {popularProducts.length > 0 && (
        <ProductGrid
          title="Popular Creations"
          viewAllHref="/shop?sort=popular"
          products={popularProducts}
        />
      )}

      <TrustSection />
      <Footer />
    </main>
  );
}
