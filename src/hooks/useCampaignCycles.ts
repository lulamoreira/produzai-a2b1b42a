import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabasePaginate } from '@/lib/supabasePaginate';
import type { CycleAssignment } from '@/lib/campaignCycles';

export function useCampaignCycles(clientId?: string) {
  const qc = useQueryClient();
  const queryKey = ['campaign-cycles', clientId];
  const query = useQuery({
    queryKey, enabled: !!clientId,
    queryFn: () => supabasePaginate<CycleAssignment>((from, to) => supabase
      .from('campaign_cycle_assignments')
      .select('campaign_id, cycle_year, campaigns!inner(client_id)', { count: 'exact' })
      .eq('campaigns.client_id', clientId ?? '')
      .order('campaign_id').range(from, to)),
  });
  const save = useMutation({
    mutationFn: async (assignments: CycleAssignment[]) => {
      if (!clientId) throw new Error('Cliente não encontrado.');
      if (!assignments.length) return;
      const { error } = await supabase.from('campaign_cycle_assignments')
        .upsert(assignments.map(a => ({ ...a, updated_at: new Date().toISOString() })), { onConflict: 'campaign_id' });
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey }); },
  });
  return { ...query, save };
}