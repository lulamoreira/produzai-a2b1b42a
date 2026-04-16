import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc" | null;

/**
 * Generic 3-state click-to-sort hook for tables.
 * Cycle: asc → desc → null (original order).
 *
 * Optionally accepts a `getValue` map for fields whose value should
 * be derived (e.g. nested props, enums mapped to numeric weight, dates).
 */
export function useTableSort<T>(
  items: T[],
  options?: {
    initialField?: keyof T | string;
    getValue?: Record<string, (item: T) => string | number | null | undefined>;
  }
) {
  const [sortField, setSortField] = useState<string | null>(
    (options?.initialField as string) ?? null
  );
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortField(null);
      setSortDir(null);
      return;
    }
    setSortDir("asc");
  };

  const sortedItems = useMemo(() => {
    if (!sortField || !sortDir) return items;
    const getter = options?.getValue?.[sortField];
    return [...items].sort((a, b) => {
      const av = getter ? getter(a) : (a as any)?.[sortField];
      const bv = getter ? getter(b) : (b as any)?.[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const result =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR");
      return sortDir === "asc" ? result : -result;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortField, sortDir]);

  return { sortedItems, sortField, sortDir, handleSort };
}
