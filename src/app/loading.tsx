/**
 * Home Page Loading State
 * Design Ref: docs/4.DESIGN(1) (1).md §5.5 & §6.1
 * Soft skeleton placeholders while server-rendered catalog is loading.
 */
export default function HomeLoading() {
  return (
    <div className="w-full animate-pulse" aria-busy="true" aria-label="Loading catalog">
      {/* Hero Skeleton */}
      <div
        className="w-full py-16 md:py-24"
        style={{ background: "linear-gradient(135deg, #FFFDF8 0%, #f0f7ec 40%, #fef9e7 100%)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-4 w-full">
              <div className="h-6 w-48 bg-neutral-200 rounded-full" />
              <div className="h-12 w-3/4 bg-neutral-200 rounded-2xl" />
              <div className="h-6 w-2/3 bg-neutral-200 rounded-lg" />
              <div className="h-12 w-40 bg-neutral-200 rounded-xl pt-2" />
            </div>
            <div className="w-full max-w-md aspect-square bg-neutral-200 rounded-3xl" />
          </div>
        </div>
      </div>

      {/* Category Chips Skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-6 w-60 bg-neutral-200 rounded-lg mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-neutral-200" />
              <div className="h-3 w-14 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Product Grid Skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-7 w-48 bg-neutral-200 rounded-lg mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-neutral-100 p-4 space-y-3"
              style={{ background: "var(--color-surface, #FFFFFF)" }}
            >
              <div className="aspect-square w-full rounded-xl bg-neutral-200" />
              <div className="h-4 w-20 bg-neutral-200 rounded" />
              <div className="h-5 w-3/4 bg-neutral-200 rounded" />
              <div className="h-5 w-16 bg-neutral-200 rounded" />
              <div className="h-10 w-full bg-neutral-200 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
