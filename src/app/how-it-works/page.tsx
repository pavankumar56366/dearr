import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — Precision 3D Printing | Dearr",
  description:
    "Discover how Dearr crafts premium 3D-printed spiritual idols, articulated toys, and custom gifts using sustainable PLA+ and precision engineering in India.",
};

export default function HowItWorksPage() {
  const steps = [
    {
      step: "01",
      title: "Design & Digital Modeling",
      description:
        "Every Dearr product begins as a custom 3D digital model engineered for mechanical balance, intricate facial proportions (for spiritual idols), or interlocking joints (for articulated dragons and fidgets).",
      icon: "📐",
    },
    {
      step: "02",
      title: "Precision 3D Printing",
      description:
        "We print each item layer-by-layer at ultra-fine 0.12mm–0.20mm resolutions on calibrated print farms using premium non-toxic PLA+ filament, ensuring high durability, vibrant coloration, and smooth surface texture.",
      icon: "🖨️",
    },
    {
      step: "03",
      title: "Manual Quality Inspection",
      description:
        "Every single print undergoes thorough inspection: testing mechanical articulation joints for fluid motion, verifying dimensional accuracy, and hand-finishing details before packaging approval.",
      icon: "🔍",
    },
    {
      step: "04",
      title: "Careful Packaging & Fast Shipping",
      description:
        "Items are secured in cushioned protective packaging to prevent transit damage and dispatched with trusted courier partners across India with end-to-end tracking updates.",
      icon: "📦",
    },
  ];

  const materials = [
    {
      title: "Eco-Friendly PLA+",
      desc: "Derived from renewable corn starch and plant sugars. Non-toxic, odorless, biodegradable, and safer for households with kids and pets.",
      badge: "Sustainable",
    },
    {
      title: "Ultra-Fine Layer Height",
      desc: "Printed at 0.12mm–0.20mm precision, creating crisp details on spiritual idols and seamless interlocking hinges on articulated dragons.",
      badge: "High Resolution",
    },
    {
      title: "Made in India",
      desc: "Designed, printed, hand-inspected, and packaged locally, ensuring rapid production turnaround and direct manufacturer quality control.",
      badge: "Local Craftsmanship",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-neutral-900">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 border-b border-neutral-200/80 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/20 text-neutral-900 text-xs font-bold uppercase tracking-wider mb-4">
            Our Craft & Engineering
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight">
            How Dearr Crafts Precision 3D Printed Products
          </h1>
          <p className="mt-5 text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            From digital sculpting to sustainable PLA+ printing and hand inspection. Here is how we bring spiritual idols, articulated toys, and custom creations to life.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/shop"
              className="px-6 py-3 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-semibold text-sm transition-all shadow-xs active:scale-95"
            >
              Explore Products
            </Link>
            <Link
              href="/shop?cat=spiritual-idols"
              className="px-6 py-3 rounded-xl bg-surface border border-neutral-300 hover:bg-neutral-100 text-neutral-900 font-semibold text-sm transition-all active:scale-95"
            >
              Spiritual Idols
            </Link>
          </div>
        </div>
      </section>

      {/* 4-Step Process Section */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
            Our 4-Stage Creation Process
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 mt-2">
            Every piece is made on demand with meticulous attention to detail
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div
              key={s.step}
              className="bg-surface rounded-2xl p-6 border border-neutral-200/80 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-xs font-mono font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                    {s.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  {s.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Materials & Quality Section */}
      <section className="py-16 bg-neutral-100/60 border-y border-neutral-200/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
              Materials & Print Standards
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mt-2">
              Built for beauty, durability, and safety
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {materials.map((m) => (
              <div
                key={m.title}
                className="bg-surface rounded-2xl p-6 border border-neutral-200 shadow-xs"
              >
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700 mb-3">
                  {m.badge}
                </span>
                <h3 className="text-base font-bold text-neutral-900 mb-2">
                  {m.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ / Shipping summary */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <div className="bg-surface rounded-xl p-5 border border-neutral-200">
            <h3 className="font-semibold text-sm sm:text-base text-neutral-900 mb-1">
              How long does production and delivery take?
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Because each product is custom printed and hand-checked, manufacturing takes 24–48 hours. Shipping across India typically requires 3–5 business days depending on your delivery postal code.
            </p>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-neutral-200">
            <h3 className="font-semibold text-sm sm:text-base text-neutral-900 mb-1">
              Are 3D printed articulated toys safe for children?
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Yes, we print using food-grade, non-toxic PLA+ polymer without toxic fumes or lead. However, due to small interlocking parts on flexible articulated models, they are recommended for ages 4+ or adult collectors.
            </p>
          </div>
          <div className="bg-surface rounded-xl p-5 border border-neutral-200">
            <h3 className="font-semibold text-sm sm:text-base text-neutral-900 mb-1">
              What payment methods do you accept?
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              We accept online payments via Razorpay (UPI, Google Pay, PhonePe, Paytm, Debit/Credit Cards, and Netbanking). Cash on Delivery (COD) is also available on eligible products and pincodes.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/shop"
            className="inline-block px-8 py-3.5 rounded-xl bg-primary hover:bg-[#91BC7A] text-neutral-900 font-bold text-sm transition-all shadow-xs active:scale-95"
          >
            Start Shopping Now
          </Link>
        </div>
      </section>
    </div>
  );
}
