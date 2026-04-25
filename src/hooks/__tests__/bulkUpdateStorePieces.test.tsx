/**
 * Regression test for the kit-cell "value disappears" bug.
 *
 * Background: when a kit cell is saved, N component-piece writes happen.
 * The previous implementation fired N independent useUpdateCampaignStorePiece
 * mutations in parallel; each one had its own onSettled → invalidateQueries,
 * so a partial refetch could land between writes and render Math.min(...) of
 * stale + fresh quantities — making the visible kit qty briefly drop to 0.
 *
 * useBulkUpdateCampaignStorePieces fixes this by:
 *   - applying ONE optimistic setQueryData covering all N writes,
 *   - running all DB calls in parallel WITHOUT per-mutation invalidations,
 *   - issuing ONE final invalidateQueries when the whole batch settles.
 *
 * This test validates the cache contract directly — it's the surface that
 * the matrix render reads from.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";

// Mock supabase BEFORE importing the hook
vi.mock("@/integrations/supabase/client", () => {
  const calls: any[] = [];
  const builder = (table: string) => ({
    delete: () => ({
      eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }),
    }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    insert: (payload: any) => {
      calls.push({ table, payload });
      return Promise.resolve({ error: null });
    },
  });
  return {
    supabase: {
      from: (table: string) => builder(table),
      __calls: calls,
    },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useBulkUpdateCampaignStorePieces } from "@/hooks/useMultiClientData";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useBulkUpdateCampaignStorePieces", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("applies a single optimistic update covering all N component pieces", async () => {
    const queryKey = ["campaign_store_pieces", "campaign-1"];
    qc.setQueryData(queryKey, []);

    const { result } = renderHook(() => useBulkUpdateCampaignStorePieces(), {
      wrapper: wrapper(qc),
    });

    await act(async () => {
      result.current.mutate({
        campaignId: "campaign-1",
        storeId: "jardim-sul",
        updates: [
          { pieceId: "piece-a", quantity: 5 },
          { pieceId: "piece-b", quantity: 10 },
          { pieceId: "piece-c", quantity: 15 },
        ],
      });
    });

    // Optimistic cache should immediately reflect ALL three writes,
    // not be a half-applied snapshot.
    const cached = qc.getQueryData<any[]>(queryKey) ?? [];
    expect(cached).toHaveLength(3);
    expect(cached.map((r) => r.quantity).sort((a, b) => a - b)).toEqual([5, 10, 15]);
  });

  it("invalidates queries exactly once after the whole batch settles", async () => {
    const queryKey = ["campaign_store_pieces", "campaign-2"];
    qc.setQueryData(queryKey, []);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useBulkUpdateCampaignStorePieces(), {
      wrapper: wrapper(qc),
    });

    await act(async () => {
      result.current.mutate({
        campaignId: "campaign-2",
        storeId: "leblon",
        updates: [
          { pieceId: "piece-a", quantity: 7 },
          { pieceId: "piece-b", quantity: 7 },
          { pieceId: "piece-c", quantity: 7 },
        ],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Critical: exactly ONE invalidation for the whole batch — never per row.
    // The hook intentionally delays invalidation by 500ms to avoid refetching
    // before the database has committed every component-piece write.
    await waitFor(() => {
      const matchingCalls = invalidateSpy.mock.calls.filter((c) => {
        const k = (c[0] as any)?.queryKey;
        return Array.isArray(k) && k[0] === "campaign_store_pieces" && k[1] === "campaign-2";
      });
      expect(matchingCalls).toHaveLength(1);
    });
  });

  it("rolls back to the previous snapshot if the batch errors", async () => {
    const queryKey = ["campaign_store_pieces", "campaign-3"];
    const seed = [
      {
        id: "row-1",
        campaign_id: "campaign-3",
        store_id: "itupeva",
        piece_id: "piece-x",
        quantity: 99,
      },
    ];
    qc.setQueryData(queryKey, seed);

    // Force the insert to throw on this run by overriding the mock
    const supa = await import("@/integrations/supabase/client");
    const originalFrom = (supa.supabase as any).from;
    (supa.supabase as any).from = () => ({
      delete: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: { message: "boom" } }),
    });

    const { result } = renderHook(() => useBulkUpdateCampaignStorePieces(), {
      wrapper: wrapper(qc),
    });

    await act(async () => {
      result.current.mutate({
        campaignId: "campaign-3",
        storeId: "itupeva",
        updates: [{ pieceId: "piece-y", quantity: 5 }],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(qc.getQueryData(queryKey)).toEqual(seed);

    // Restore for other tests
    (supa.supabase as any).from = originalFrom;
  });
});
