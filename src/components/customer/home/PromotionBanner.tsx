import Link from "next/link";

const PROMOTION_INFO = {
  id: "promo-3d-custom",
  title: "Bespoke 3D Printed Creations",
  subtitle:
    "From personalized car keychains to illuminated lithophane night lights. Precision crafted layer by layer, delivered across India.",
  ctaText: "Explore Creations",
  ctaHref: "/shop?cat=custom-keychains",
};

/**
 * PromotionBanner — Secondary yellow highlight promotional section.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1 (Promotion Banner)
 *
 * Uses secondary color (FFCB56) accent with a warm background.
 * Highlights custom 3D printing options and bespoke orders.
 */
export default function PromotionBanner() {
  const promo = PROMOTION_INFO;

  return (
    <section id="promotion-banner" className="w-full py-6 md:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8 md:p-12"
          style={{
            background: "linear-gradient(135deg, #fef9e7 0%, #fff5cc 50%, #fef0d0 100%)",
            border: "1px solid rgba(255, 203, 86, 0.3)",
          }}
        >
          {/* Decorative elements */}
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20 pointer-events-none"
            style={{ background: "var(--color-secondary)" }}
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-15 pointer-events-none"
            style={{ background: "var(--color-primary)" }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10">
            {/* Promo Visual */}
            <div
              className="flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl shrink-0 shadow-sm"
              style={{
                background: "rgba(255, 203, 86, 0.35)",
              }}
              aria-hidden="true"
            >
              <span className="text-4xl sm:text-5xl select-none">✨</span>
            </div>

            {/* Text */}
            <div className="flex-1 text-center md:text-left space-y-2">
              <h2
                className="font-display text-2xl sm:text-3xl font-bold"
                style={{ color: "var(--color-neutral-900)" }}
              >
                {promo.title}
              </h2>
              <p
                className="text-sm sm:text-base max-w-lg"
                style={{ color: "var(--color-neutral-700)", lineHeight: "1.6" }}
              >
                {promo.subtitle}
              </p>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              <Link
                href={promo.ctaHref}
                className="btn-base btn-primary px-8"
                style={{
                  height: "48px",
                  background: "var(--color-secondary)",
                  color: "var(--color-neutral-900)",
                  fontWeight: "700",
                }}
              >
                {promo.ctaText}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
