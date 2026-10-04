const TRUST_BENEFITS = [
  {
    id: "tb-1",
    icon: "🖨️",
    title: "Precision 3D Printed",
    description: "High-resolution prints with smooth layer lines & rich detailing",
  },
  {
    id: "tb-2",
    icon: "✨",
    title: "Custom Personalization",
    description: "Personalized number plates, names & custom colorways",
  },
  {
    id: "tb-3",
    icon: "🌱",
    title: "Eco-Friendly PLA",
    description: "Crafted from durable, non-toxic, plant-based bioplastics",
  },
  {
    id: "tb-4",
    icon: "🚚",
    title: "Carefully Packaged",
    description: "Cushioned shockproof packaging delivered across India",
  },
];

/**
 * TrustSection — 3D printing brand values / trust signals strip.
 * Design Ref: docs/4.DESIGN(1) (1).md §6.1 (Brand/Trust Section)
 *
 * Highlights 3D print precision, customization, eco-friendly materials, and safe delivery.
 * Displayed as a soft row of 4 items.
 */
export default function TrustSection() {
  return (
    <section
      id="trust-section"
      className="w-full py-8 md:py-12"
      style={{ background: "var(--color-neutral-100)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {TRUST_BENEFITS.map((benefit) => (
            <div
              key={benefit.id}
              className="flex flex-col items-center text-center gap-2.5"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(162, 203, 139, 0.15)",
                }}
              >
                <span className="text-2xl select-none">{benefit.icon}</span>
              </div>
              <h3
                className="text-sm sm:text-[15px] font-bold"
                style={{ color: "var(--color-neutral-900)" }}
              >
                {benefit.title}
              </h3>
              <p
                className="text-xs sm:text-sm"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
