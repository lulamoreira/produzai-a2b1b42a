// Supabase/PostgREST returns at most 1000 rows per response by default.
// Use this helper for any query that may exceed that limit so we never
// silently truncate results.
//
// IMPORTANT: pages are fetched in parallel with OFFSET/LIMIT. If the
// caller's `.order(...)` is not unique (e.g. ordering by `store_id`
// where many rows share the same value), Postgres is free to return
// those rows in different orders across the parallel requests — which
// produces both duplicates AND missing rows between pages.
//
// Two layers of defense:
//  1. Callers SHOULD include a stable tiebreaker (typically `.order("id")`).
//  2. This helper dedups by `id` when present, as a safety net so legacy
//     callsites don't silently inflate totals.
export const PAGE_SIZE = 1000;

export async function supabasePaginate<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any; count?: number | null }>,
): Promise<T[]> {
  // First, fetch just the count and the first page to see if we need more
  const { data, error, count } = await buildQuery(0, PAGE_SIZE - 1);
  if (error) throw error;

  const firstPage = (data ?? []) as T[];

  // If we have less than a page or no count (and didn't hit a full page), we're done
  if (firstPage.length < PAGE_SIZE || count === null || count === undefined) {
    return firstPage;
  }

  // If we have more, fetch all remaining pages in parallel
  const rows: T[] = [...firstPage];
  const totalCount = count;
  const remainingPages = Math.ceil((totalCount - PAGE_SIZE) / PAGE_SIZE);

  if (remainingPages > 0) {
    const promises = Array.from({ length: remainingPages }, (_, i) => {
      const from = (i + 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      return buildQuery(from, to);
    });

    const results = await Promise.all(promises);
    for (const { data: pageData, error: pageError } of results) {
      if (pageError) throw pageError;
      rows.push(...((pageData ?? []) as T[]));
    }
  }

  // Safety net: dedup by `id` if rows expose it. Protects callers whose
  // ORDER BY isn't unique from inflating totals due to PostgREST returning
  // the same row across multiple parallel pages.
  if (rows.length > 0 && typeof (rows[0] as any)?.id !== "undefined") {
    const seen = new Set<unknown>();
    const out: T[] = [];
    for (const r of rows) {
      const id = (r as any).id;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
    return out;
  }

  return rows;
}

