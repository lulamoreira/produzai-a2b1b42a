import { describe, expect, it } from "vitest";
import { PAGE_SIZE, supabasePaginate } from "./supabasePaginate";

describe("complete campaign pagination during performance optimization", () => {
  it("preserves every quantity across ten pages in stable order", async () => {
    const rows = Array.from({ length: 9278 }, (_, id) => ({ id, quantity: id + 1 }));
    const ranges: number[] = [];
    const result = await supabasePaginate(async (from, to) => {
      ranges.push(from);
      return { data: rows.slice(from, to + 1), error: null, count: rows.length };
    });
    expect(result).toEqual(rows);
    expect(ranges).toEqual(Array.from({ length: 10 }, (_, page) => page * PAGE_SIZE));
    expect(result.reduce((sum, row) => sum + row.quantity, 0)).toBe(43045281);
  });

  it("rejects a failed later page instead of returning incomplete quantities", async () => {
    const failure = new Error("page unavailable");
    await expect(supabasePaginate(async (from) => ({
      data: from === 0 ? Array.from({ length: PAGE_SIZE }, (_, id) => ({ id })) : null,
      error: from === 0 ? null : failure,
      count: 2000,
    }))).rejects.toBe(failure);
  });
});