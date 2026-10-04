import Link from "next/link";
import ProductCard from "./ProductCard";

/**
 * ProductGrid — A section with heading, "View All" link, and a responsive product grid.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1 (Featured Products, Best Sellers)
 */
interface ProductGridProps {
  title: string;
  viewAllHref: string;
  products: any[];
}

export default function ProductGrid({ title, viewAllHref, products }: ProductGridProps) {
  if (!products || products.length === 0) {
    return null;
  }

  // Filter out any inactive products safely
  const activeProducts = products.filter((p) => p.isActive !== false);
  if (activeProducts.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-6 md:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="flex items-center justify-between mb-5">
          <h2
            className="font-display text-xl sm:text-2xl font-bold"
            style={{ color: "var(--color-neutral-900)" }}
          >
            {title}
          </h2>
          <Link
            href={viewAllHref}
            className="text-sm font-semibold hover:underline transition-colors"
            style={{ color: "var(--color-primary)" }}
          >
            View All →
          </Link>
        </div>

        {/* 2-Column Grid (Mobile) / 3-4 Column (Desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {activeProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
