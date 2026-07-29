export const VendorSkeletonList = () => (
  <div className="space-y-2 p-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="rounded-lg p-3 animate-pulse flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-base-200" />
        <div className="flex-1">
          <div className="h-3 bg-base-200 rounded w-24 mb-1.5" />
          <div className="h-2 bg-base-200 rounded w-16" />
        </div>
      </div>
    ))}
  </div>
);
