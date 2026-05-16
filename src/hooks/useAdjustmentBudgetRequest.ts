import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RequoteStatus =
  | 'pending'
  | 'sent'
  | 'filling'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface AdjustmentBudgetRequest {
  id: string;
  adjustment_id: string;
  supplier_id: string;
  status: RequoteStatus;
  access_token: string;
  token_expires_at: string | null;
  deadline_days: number | null;
  request_sent_at: string | null;
  submitted_at: string | null;
  response_received_at: string | null;
  adjusted_prices_jsonb: any;
  adjusted_extras_jsonb: any;
  notes: string | null;
  rejection_notes: string | null;
  is_late_submission: boolean | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface RequoteStatusMeta {
  label: string;
  color: string;
  badgeClass: string;
}

export const REQUOTE_STATUS_META: Record<RequoteStatus, RequoteStatusMeta> = {
  pending:   { label: 'Não enviado',             color: 'gray',   badgeClass: 'bg-muted text-muted-foreground' },
  sent:      { label: 'Enviado',                 color: 'amber',  badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  filling:   { label: 'Fornecedor preenchendo',  color: 'blue',   badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  submitted: { label: 'Aguardando revisão',      color: 'purple', badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  approved:  { label: 'Aprovado',                color: 'green',  badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  rejected:  { label: 'Recusado',                color: 'red',    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
};

/** All requote rows for a given campaign (joined through adjustments). */
export function useAdjustmentBudgetRequests(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['adjustment_budget_requests', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data: adjs, error: adjErr } = await supabase
        .from('campaign_adjustments')
        .select('id')
        .eq('campaign_id', campaignId!);
      if (adjErr) throw adjErr;
      const ids = (adjs || []).map((a) => a.id);
      if (ids.length === 0) return [] as AdjustmentBudgetRequest[];

      const { data, error } = await supabase
        .from('campaign_adjustment_budget_request')
        .select('*')
        .in('adjustment_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AdjustmentBudgetRequest[];
    },
  });
}

/** Convenience: the request tied to the currently active adjustment, if any. */
export function useActiveAdjustmentRequest(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['active_adjustment_request', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data: active, error: activeErr } = await supabase
        .from('campaign_adjustments')
        .select('id')
        .eq('campaign_id', campaignId!)
        .eq('status', 'active')
        .maybeSingle();
      if (activeErr) throw activeErr;
      if (!active) return null;
      const { data, error } = await supabase
        .from('campaign_adjustment_budget_request')
        .select('*')
        .eq('adjustment_id', active.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AdjustmentBudgetRequest) || null;
    },
  });
}

/** Admin → mint a fresh public link and set deadline. Returns the new token. */
export function useGeneratePortalLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      deadlineDays,
    }: {
      requestId: string;
      deadlineDays: number;
    }) => {
      const { data, error } = await supabase.rpc('generate_requote_token' as any, {
        p_request_id: requestId,
        p_deadline_days: deadlineDays,
      } as any);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustment_budget_requests'] });
      qc.invalidateQueries({ queryKey: ['active_adjustment_request'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApproveRequote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('campaign_adjustment_budget_request')
        .update({
          status: 'approved',
          response_received_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustment_budget_requests'] });
      qc.invalidateQueries({ queryKey: ['active_adjustment_request'] });
      toast.success('Recotação aprovada.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectRequote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      rejectionNotes,
    }: {
      requestId: string;
      rejectionNotes: string;
    }) => {
      const { error } = await supabase
        .from('campaign_adjustment_budget_request')
        .update({
          status: 'rejected',
          rejection_notes: rejectionNotes,
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adjustment_budget_requests'] });
      qc.invalidateQueries({ queryKey: ['active_adjustment_request'] });
      toast.success('Recotação recusada.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Realtime: when the supplier submits via the public portal, admin sees it instantly. */
export function useRequoteRealtime(campaignId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`requote_${campaignId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'campaign_adjustment_budget_request',
        },
        () => {
          qc.invalidateQueries({ queryKey: ['adjustment_budget_requests', campaignId] });
          qc.invalidateQueries({ queryKey: ['active_adjustment_request', campaignId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, qc]);
}
