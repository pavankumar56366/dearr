import Link from "next/link";

interface ProductNotFoundProps {
  slug?: string;
}

/**
 * ProductNotFound — Rendered when a requested product slug does not exist
 * or is inactive in the Dearr catalog.
 */
export default function ProductNotFound({ slug }: ProductNotFoundProps) {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center px-4 py-16"
      style={{ background: "var(--color-canvas)" }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-8 text-center flex flex-col items-center gap-4"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-neutral-100)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl select-none"
          style={{ background: "rgba(162, 203, 139, 0.2)" }}
        >
          🔍
        </div>

        <div className="flex flex-col gap-1.5">
          <h1
            className="text-xl sm:text-2xl font-black tracking-tight"
            style={{ color: "var(--color-neutral-900)" }}
          >
            Product Not Found
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: "var(--color-neutral-500)" }}>
            {slug ? (
              <>
                The 3D printed product matching <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-800 font-mono text-xs">{slug}</code> could not be found or is no longer available.
              </>
            ) : (
              "The requested 3D printed product could not be found or is no longer available in our catalog."
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
          <Link
            href="/shop"
            className="w-full flex items-center justify-center h-11 px-5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all hover:shadow-md"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-neutral-900)",
            }}
          >
            Browse All 3D Prints
          </Link>
          <Link
            href="/"
            className="w-full flex items-center justify-center h-11 px-5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-neutral-300 hover:bg-neutral-50"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-neutral-700)",
            }}
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
