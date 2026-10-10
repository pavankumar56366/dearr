"use client";

import Link from "next/link";
import Image from "next/image";

/**
 * Footer — Site-wide customer footer.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1 (Footer)
 *
 * Shows brand identity, navigation links, and legal info.
 * Mobile-friendly vertical stack, desktop horizontal grid.
 */
export default function Footer() {
  return (
    <footer
      id="site-footer"
      className="w-full"
      style={{
        background: "var(--color-neutral-900)",
        color: "rgba(255, 255, 255, 0.7)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl transition-transform hover:scale-105"
              style={{
                background: "var(--color-canvas)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
              }}
              aria-label="Dearr Home"
            >
              <Image
                src="/brand/dearr-logo.png"
                alt="Dearr - Love Collects. We Deliver."
                width={120}
                height={34}
                className="h-7 w-auto object-contain"
                style={{ width: "auto" }}
                priority={false}
              />
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              Precision 3D printed creations, sacred idols, and personalized collectibles crafted layer by layer. Love Collects. We Deliver.
            </p>
          </div>

          {/* Shop Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#FFFFFF" }}>
              Shop 3D Prints
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "All Creations", href: "/shop" },
                { label: "Spiritual Idols", href: "/shop?cat=spiritual-idols" },
                { label: "Articulated & Toys", href: "/shop?cat=articulated-toys" },
                { label: "Custom Keychains", href: "/shop?cat=custom-keychains" },
                { label: "Lithophane Lamps", href: "/shop?cat=lithophane-lamps" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#FFFFFF" }}>
              Help
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "My Account", href: "/account" },
                { label: "My Orders", href: "/account/orders" },
                { label: "Wishlist", href: "/wishlist" },
                { label: "Contact Us", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-300 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter CTA */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#FFFFFF" }}>
              Stay in Touch
            </h3>
            <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
              Get notified about new arrivals and exclusive offers.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 h-10 rounded-lg px-3 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#FFFFFF",
                }}
                aria-label="Email for newsletter"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-lg text-sm font-semibold shrink-0 transition-colors"
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-neutral-900)",
                }}
              >
                Join
              </button>
            </form>

            {/* Social Follow */}
            <div className="pt-4">
              <a
                href="https://www.instagram.com/dearr.in_?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white transition-colors group"
                aria-label="Follow Dearr on Instagram (opens in new tab)"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400 group-hover:text-pink-400 transition-colors shrink-0"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                <span>Follow @dearr.in_</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p style={{ color: "rgba(255,255,255,0.4)" }}>
            © {new Date().getFullYear()} Dearr. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}>
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
