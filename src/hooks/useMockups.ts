import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabasePaginate } from '@/lib/supabasePaginate';
import { toast } from 'sonner';

export type MockupStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface CampaignMockup {
  id: string;
  campaign_id: string;
  piece_id: string | null;
  kit_id: string | null;
  parent_mockup_id: string | null;
  status: MockupStatus;
  alt_name: string | null;
  alt_size: string | null;
  alt_specification: string | null;
  alt_installation: string | null;
  alt_name_active: boolean;
  alt_size_active: boolean;
  alt_specification_active: boolean;
  alt_installation_active: boolean;
  observations: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all mockups for a campaign — paginated
export function useCampaignMockups(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign_mockups', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      return supabasePaginate<CampaignMockup>((from, to) =>
        supabase
          .from('campaign_mockups')
          .select('*')
          .eq('campaign_id', campaignId!)
          .order('created_at', { ascending: true })
          .range(from, to) as any
      );
    },
  });
}

// Initialize mockups for all pieces/kits with is_mockup=true in the campaign
export function useInitializeMockups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaignId: string;
      pieces: { id: string; is_mockup?: boolean; kit_only?: boolean }[];
      kits: { id: string }[];
      kitPieces: { kit_id: string; piece_id: string }[];
    }) => {
      const existing = await supabasePaginate<{ piece_id: string | null; kit_id: string | null; parent_mockup_id: string | null }>(
        (from, to) =>
          supabase
            .from('campaign_mockups')
            .select('piece_id, kit_id, parent_mockup_id')
            .eq('campaign_id', params.campaignId)
            .range(from, to) as any
      );
      const existingPieceIds = new Set(existing.filter(e => !e.parent_mockup_id && e.piece_id).map(e => e.piece_id));
      const existingKitIds = new Set(existing.filter(e => e.kit_id).map(e => e.kit_id));

      const toInsert: any[] = [];

      for (const p of params.pieces) {
        if (!p.is_mockup || p.kit_only) continue;
        if (existingPieceIds.has(p.id)) continue;
        toInsert.push({
          campaign_id: params.campaignId,
          piece_id: p.id,
          kit_id: null,
          parent_mockup_id: null,
          status: 'pending',
        });
      }

      const mockupPieceIds = new Set(params.pieces.filter(p => p.is_mockup).map(p => p.id));
      const kitsWithMockup = new Set<string>();
      for (const kp of params.kitPieces) {
        if (mockupPieceIds.has(kp.piece_id)) kitsWithMockup.add(kp.kit_id);
      }
      for (const kit of params.kits) {
        if (!kitsWithMockup.has(kit.id)) continue;
        if (existingKitIds.has(kit.id)) continue;
        toInsert.push({
          campaign_id: params.campaignId,
          piece_id: null,
          kit_id: kit.id,
          parent_mockup_id: null,
          status: 'pending',
        });
      }

      if (toInsert.length === 0) return { inserted: 0, kitComponents: 0 };

      const { data: insertedParents, error } = await supabase
        .from('campaign_mockups')
        .insert(toInsert)
        .select('id, kit_id');
      if (error) throw error;

      const kitComponentsToInsert: any[] = [];
      for (const parent of (insertedParents || [])) {
        if (!parent.kit_id) continue;
        const components = params.kitPieces.filter(kp => kp.kit_id === parent.kit_id);
        for (const comp of components) {
          kitComponentsToInsert.push({
            campaign_id: params.campaignId,
            piece_id: comp.piece_id,
            kit_id: null,
            parent_mockup_id: parent.id,
            status: 'pending',
          });
        }
      }

      if (kitComponentsToInsert.length > 0) {
        for (let i = 0; i < kitComponentsToInsert.length; i += 500) {
          const { error: compErr } = await supabase
            .from('campaign_mockups')
            .insert(kitComponentsToInsert.slice(i, i + 500));
          if (compErr) throw compErr;
        }
      }

      return { inserted: toInsert.length, kitComponents: kitComponentsToInsert.length };
    },
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['campaign_mockups', vars.campaignId] });
      if (result.inserted > 0) {
        toast.success(`${result.inserted} peças/kits adicionadas ao mockup${result.kitComponents > 0 ? ` (+${result.kitComponents} componentes)` : ''}`);
      }
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao inicializar mockups'),
  });
}

// Update a single mockup row — with optimistic update
export function useUpdateMockup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      mockupId: string;
      campaignId: string;
      changes: Partial<{
        status: MockupStatus;
        alt_name: string | null;
        alt_size: string | null;
        alt_specification: string | null;
        alt_installation: string | null;
        alt_name_active: boolean;
        alt_size_active: boolean;
        alt_specification_active: boolean;
        alt_installation_active: boolean;
        observations: string | null;
      }>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const updates: any = { ...params.changes };

      if (params.changes.status) {
        updates.reviewed_by = userData?.user?.id;
        updates.reviewed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('campaign_mockups')
        .update(updates)
        .eq('id', params.mockupId);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const key = ['campaign_mockups', vars.campaignId];
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (old: CampaignMockup[] | undefined) => {
        if (!old) return old;
        return old.map(m => m.id === vars.mockupId ? { ...m, ...vars.changes } as CampaignMockup : m);
      });
      return { previous };
    },
    onError: (e: any, vars, context: any) => {
      if (context?.previous) {
        qc.setQueryData(['campaign_mockups', vars.campaignId], context.previous);
      }
      toast.error('Erro ao salvar: ' + (e?.message || 'Tente novamente'));
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['campaign_mockups', vars.campaignId] });
    },
  });
}

// Add a piece manually to the mockup
export function useAddPieceToMockup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { campaignId: string; pieceId: string }) => {
      const { error } = await supabase
        .from('campaign_mockups')
        .insert({
          campaign_id: params.campaignId,
          piece_id: params.pieceId,
          kit_id: null,
          parent_mockup_id: null,
          status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['campaign_mockups', vars.campaignId] });
      toast.success('Peça adicionada ao mockup');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao adicionar peça'),
  });
}

// Remove a piece/kit from mockup
export function useRemoveFromMockup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { mockupId: string; campaignId: string }) => {
      const { error } = await supabase
        .from('campaign_mockups')
        .delete()
        .eq('id', params.mockupId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['campaign_mockups', vars.campaignId] });
      toast.success('Removido do mockup');
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao remover'),
  });
}
