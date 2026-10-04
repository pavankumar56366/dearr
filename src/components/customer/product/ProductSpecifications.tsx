import { PrinterIcon } from "@/components/customer/Icons";

export interface ProductSpecificationData {
  material?: string;
  process?: string;
  dimensions?: string;
  finish?: string;
  customization?: string;
  care?: string;
}

interface ProductSpecificationsProps {
  specifications?: ProductSpecificationData;
}

/**
 * ProductSpecifications — 3D printing technical details & materials breakdown.
 * Displays only confirmed specifications from the sample product data.
 */
export default function ProductSpecifications({
  specifications,
}: ProductSpecificationsProps) {
  if (!specifications) {
    return null;
  }

  // Define the ordered display list of known 3D printing specs
  const specItems: { label: string; value: string | undefined; icon: string }[] = [
    { label: "Material", value: specifications.material, icon: "🌱" },
    { label: "Printing Process", value: specifications.process, icon: "🖨️" },
    { label: "Dimensions", value: specifications.dimensions, icon: "📐" },
    { label: "Surface Finish", value: specifications.finish, icon: "✨" },
    { label: "Personalization", value: specifications.customization, icon: "✏️" },
    { label: "Care & Handling", value: specifications.care, icon: "🛡️" },
  ].filter((item) => Boolean(item.value));

  if (specItems.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 w-full"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-neutral-100)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-neutral-100">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "rgba(162, 203, 139, 0.2)",
            color: "var(--color-neutral-900)",
          }}
        >
          <PrinterIcon size={18} />
        </div>
        <div>
          <h2
            className="text-sm font-bold tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            3D Printing Specifications
          </h2>
          <p className="text-xs" style={{ color: "var(--color-neutral-500)" }}>
            Precision crafted layer-by-layer using premium filaments
          </p>
        </div>
      </div>

      {/* Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {specItems.map((spec) => (
          <div
            key={spec.label}
            className="flex items-start gap-2.5 p-3 rounded-xl"
            style={{ background: "var(--color-neutral-100)" }}
          >
            <span className="text-base shrink-0 select-none" aria-hidden="true">
              {spec.icon}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--color-neutral-500)" }}
              >
                {spec.label}
              </span>
              <span
                className="text-xs font-semibold leading-relaxed"
                style={{ color: "var(--color-neutral-800)" }}
              >
                {spec.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
