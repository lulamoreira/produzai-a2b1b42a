// Supabase/PostgREST returns at most 1000 rows per response by default.
// Use this helper for any query that may exceed that limit so we never
// silently truncate results.
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

  return rows;
}
