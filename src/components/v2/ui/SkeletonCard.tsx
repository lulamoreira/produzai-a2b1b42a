export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 space-y-3 animate-pulse">
      <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-1/3" />
      <div className="h-7 bg-stone-100 dark:bg-stone-800 rounded w-1/2" />
      {Array.from({ length: lines - 2 }).map((_, i) => (
        <div key={i} className="h-2.5 bg-stone-100 dark:bg-stone-800 rounded" style={{ width: `${70 + i * 10}%` }} />
      ))}
    </div>
  );
}