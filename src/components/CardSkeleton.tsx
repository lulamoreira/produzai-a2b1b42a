interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 6 }: CardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-base animate-pulse" style={{ minHeight: 110 }}>
          <div className="h-4 bg-muted rounded w-3/4 mb-3" />
          <div className="h-3 bg-muted rounded w-1/2 mb-2" />
          <div className="h-3 bg-muted rounded w-2/3 mb-2" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex gap-2 px-4 py-3 border-b border-border bg-muted/30">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 bg-muted rounded" style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2 px-4 py-3 border-b border-border last:border-b-0">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-3 bg-muted rounded" style={{ width: `${Math.random() * 40 + 30}%`, maxWidth: `${100 / cols}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 6 }: CardSkeletonProps) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-base animate-pulse" style={{ borderLeft: "4px solid var(--border-default)", minHeight: 80 }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-16 bg-muted rounded-full" />
            <div className="h-4 w-20 bg-muted rounded-full" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
          <div className="h-3 bg-muted rounded w-2/3 mb-1" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
