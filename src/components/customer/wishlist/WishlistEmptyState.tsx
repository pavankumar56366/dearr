import Link from "next/link";
import { HeartIcon } from "@/components/customer/Icons";

/**
 * WishlistEmptyState — Rendered when no items are saved in the wishlist.
 * Brand-aligned with Dearr 3D printing focus and quick recovery navigation.
 */
export default function WishlistEmptyState() {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center px-4 py-12"
      style={{ background: "var(--color-canvas)" }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center gap-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Heart Visual */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center select-none"
          style={{
            background: "rgba(162, 203, 139, 0.2)",
            color: "var(--color-primary)",
          }}
        >
          <HeartIcon size={32} stroke="currentColor" fill="none" />
        </div>

        <div className="flex flex-col gap-2">
          <h2
            className="text-xl sm:text-2xl font-black tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            Your wishlist is empty
          </h2>
          <p
            className="text-xs sm:text-sm leading-relaxed"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Explore our precision 3D printed spiritual idols, articulated toys,
            custom keychains, and home decor. Tap the heart on any product to save
            it here.
          </p>
        </div>

        {/* Primary CTA */}
        <Link
          href="/shop"
          className="w-full flex items-center justify-center h-12 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 hover:shadow-md active:scale-98"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-neutral-900)",
          }}
        >
          Explore 3D Prints
        </Link>

        {/* Quick Category Suggestions */}
        <div className="pt-2 w-full border-t border-neutral-100 flex flex-col gap-2.5">
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--color-neutral-400)" }}
          >
            Popular Categories
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/shop?cat=spiritual-idols"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-neutral-100 transition-colors"
              style={{
                background: "var(--color-neutral-100)",
                color: "var(--color-neutral-700)",
              }}
            >
              🪔 Spiritual Idols
            </Link>
            <Link
              href="/shop?cat=articulated-toys"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-neutral-100 transition-colors"
              style={{
                background: "var(--color-neutral-100)",
                color: "var(--color-neutral-700)",
              }}
            >
              🧩 Articulated & Toys
            </Link>
            <Link
              href="/shop?cat=custom-keychains"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-neutral-100 transition-colors"
              style={{
                background: "var(--color-neutral-100)",
                color: "var(--color-neutral-700)",
              }}
            >
              🔑 Custom Keychains
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
