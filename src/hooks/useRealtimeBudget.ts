import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on budget tables (suppliers, prices, extra costs)
 * for a campaign and invalidates related query keys so the comparison view and
 * "best proposal" refresh instantly for every connected user as soon as a
 * supplier submits their quote.
 */
export function useRealtimeBudget(campaignId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!campaignId) return;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["budget_suppliers", campaignId] });
      qc.invalidateQueries({ queryKey: ["budget_prices", campaignId] });
      qc.invalidateQueries({ queryKey: ["budget_extra_costs", campaignId] });
      qc.invalidateQueries({ queryKey: ["budget_settings", campaignId] });
      qc.invalidateQueries({ queryKey: ["budget_timeline", campaignId] });
    };

    const channel = supabase
      .channel(`budget:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_suppliers",
          filter: `campaign_id=eq.${campaignId}`,
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_prices",
          filter: `campaign_id=eq.${campaignId}`,
        },
        invalidate
      )
      // budget_extra_costs has no campaign_id column (joined via supplier),
      // so we listen to all changes and invalidate — RLS still protects data.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_extra_costs",
        },
        invalidate
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supplier_spec_suggestions",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["supplier_spec_suggestions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, qc]);
}
