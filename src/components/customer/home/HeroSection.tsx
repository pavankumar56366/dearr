import Link from "next/link";
import Image from "next/image";

/**
 * HeroSection — Full-width hero with Telma headline, tagline, and CTA.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1 (Hero)
 *
 * Positioned for 3D Printing e-commerce with Dearr's brand personality:
 * "Love Collects. We Deliver."
 */
export default function HeroSection() {
  return (
    <section
      id="hero-section"
      className="relative w-full overflow-hidden"
      style={{
        background: `linear-gradient(135deg, #FFFDF8 0%, #f0f7ec 40%, #fef9e7 100%)`,
      }}
    >
      {/* Decorative background accents */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-15 pointer-events-none"
        style={{ background: "var(--color-primary)" }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-10 pointer-events-none"
        style={{ background: "var(--color-secondary)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-8 py-12 md:py-18 lg:py-22">
          {/* Text Content */}
          <div className="flex-1 text-center md:text-left space-y-5 md:space-y-6 max-w-xl">
            <span
              className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase shadow-sm"
              style={{
                background: "rgba(255, 203, 86, 0.3)",
                color: "var(--color-neutral-900)",
              }}
            >
              ✨ Precision 3D Printed Creations
            </span>

            <h1
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
              style={{ color: "var(--color-neutral-900)" }}
            >
              Love Collects.
              <br />
              <span style={{ color: "#3E6F27" }}>We Deliver.</span>
            </h1>

            <p
              className="text-base sm:text-lg max-w-md mx-auto md:mx-0"
              style={{ color: "var(--color-neutral-700)", lineHeight: "1.7" }}
            >
              Custom 3D printed sacred idols, playful articulated collectibles,
              and personalized designs crafted layer by layer with love.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                href="/shop"
                className="btn-base btn-primary text-base px-8 shadow-sm hover:opacity-95"
                style={{ height: "52px", fontSize: "16px" }}
              >
                Shop 3D Prints
              </Link>
              <Link
                href="/shop?cat=custom-keychains"
                className="btn-base btn-secondary text-base px-8 shadow-sm hover:opacity-95"
                style={{ height: "52px", fontSize: "16px" }}
              >
                Custom Keychains
              </Link>
            </div>
          </div>

          {/* Hero Visual — Real 3D Printed Product Feature Showcase */}
          <div className="flex-1 flex items-center justify-center w-full max-w-md">
            <div className="relative w-full aspect-square max-w-[340px] sm:max-w-[380px] lg:max-w-[420px]">
              {/* Main Feature Card */}
              <div
                className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
                style={{
                  border: "4px solid #FFFFFF",
                  boxShadow: "0 20px 50px rgba(162, 203, 139, 0.25)",
                }}
              >
                <Image
                  src="/product-samples/5.jpeg"
                  alt="3D Printed Articulated Heart Character by Dearr"
                  fill
                  sizes="(max-width: 768px) 90vw, 420px"
                  className="object-cover"
                  priority
                  loading="eager"
                />
                {/* Subtle gradient overlay at bottom for tag */}
                <div
                  className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end justify-between"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#FFCB56]">
                      Featured Creation
                    </span>
                    <p className="text-white text-sm font-bold">
                      Articulated Heart Figurine
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold text-neutral-900"
                    style={{ background: "var(--color-primary)" }}
                  >
                    ₹399
                  </span>
                </div>
              </div>

              {/* Floating Badge 1: 3D Printed Quality */}
              <div
                className="absolute -top-3 -left-3 bg-white rounded-2xl p-2.5 px-3.5 shadow-lg flex items-center gap-2 border border-neutral-100 animate-bounce"
                style={{ animationDuration: "4s" }}
              >
                <span className="text-xl">🖨️</span>
                <div className="text-left leading-tight">
                  <p className="text-[11px] font-bold text-neutral-900">Custom Printed</p>
                  <p className="text-[9px] text-neutral-500">Premium PLA Material</p>
                </div>
              </div>

              {/* Floating Badge 2: All India Shipping */}
              <div
                className="absolute -bottom-3 -right-3 bg-white rounded-2xl p-2.5 px-3.5 shadow-lg flex items-center gap-2 border border-neutral-100 animate-bounce"
                style={{ animationDuration: "5s", animationDelay: "1s" }}
              >
                <span className="text-xl">🚚</span>
                <div className="text-left leading-tight">
                  <p className="text-[11px] font-bold text-neutral-900">All India Delivery</p>
                  <p className="text-[9px] text-neutral-500">Cushioned & Safe</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
