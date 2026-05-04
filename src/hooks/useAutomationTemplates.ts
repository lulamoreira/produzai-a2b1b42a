import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ─── Types ─────────────────────────────── */

export type AutomationTemplateItem = {
  id: string;
  type: "piece" | "kit";
  code: number;
  name: string;
  quantity: number;
};

export type AutomationKind = "fixed" | "by_field" | "replacement";

export type AutomationTemplate = {
  id: string;
  campaign_id: string;
  name: string;
  filter_field: string;
  filter_value: string;
  items: AutomationTemplateItem[];
  outside_action: string;
  kind: AutomationKind;
  base_field: string | null;
  created_at: string;
};

export type AutomationGroup = {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
};

export type AutomationGroupItem = {
  id: string;
  group_id: string;
  template_id: string;
  enabled: boolean;
  display_order: number;
  created_at: string;
};

/* ─── Hook ──────────────────────────────── */

export function useAutomationTemplates(campaignId: string) {
  const qc = useQueryClient();
  const key = ["automation_templates", campaignId];
  const groupKey = ["automation_groups", campaignId];
  const groupItemsKey = ["automation_group_items", campaignId];

  // ── Templates ──
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_templates")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        kind: (t.kind as AutomationKind) ?? "fixed",
        base_field: t.base_field ?? null,
        items: (typeof t.items === "string" ? JSON.parse(t.items) : t.items) as AutomationTemplateItem[],
      })) as AutomationTemplate[];
    },
    enabled: !!campaignId,
  });

  const saveTemplate = useMutation({
    mutationFn: async (t: { name: string; filter_field: string; filter_value: string; items: AutomationTemplateItem[]; outside_action: string; kind?: AutomationKind; base_field?: string | null }) => {
      const { error } = await supabase
        .from("automation_templates")
        .insert({
          campaign_id: campaignId,
          name: t.name,
          filter_field: t.filter_field,
          filter_value: t.filter_value,
          items: t.items as any,
          outside_action: t.outside_action,
          kind: t.kind ?? "fixed",
          base_field: t.base_field ?? null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateTemplate = useMutation({
    mutationFn: async (t: { id: string; name: string; filter_field: string; filter_value: string; items: AutomationTemplateItem[]; outside_action: string; kind?: AutomationKind; base_field?: string | null }) => {
      const { error } = await supabase
        .from("automation_templates")
        .update({
          name: t.name,
          filter_field: t.filter_field,
          filter_value: t.filter_value,
          items: t.items as any,
          outside_action: t.outside_action,
          kind: t.kind ?? "fixed",
          base_field: t.base_field ?? null,
        } as any)
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: groupItemsKey });
    },
  });

  // ── Groups ──
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: groupKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_groups")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AutomationGroup[];
    },
    enabled: !!campaignId,
  });

  const saveGroup = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("automation_groups")
        .insert({ campaign_id: campaignId, name })
        .select()
        .single();
      if (error) throw error;
      return data as AutomationGroup;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupKey }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupKey });
      qc.invalidateQueries({ queryKey: groupItemsKey });
    },
  });

  // ── Group Items ──
  const { data: groupItems = [], isLoading: loadingGroupItems } = useQuery({
    queryKey: groupItemsKey,
    queryFn: async () => {
      // Get all group ids for this campaign
      const gIds = groups.map(g => g.id);
      if (gIds.length === 0) return [];
      const { data, error } = await supabase
        .from("automation_group_items")
        .select("*")
        .in("group_id", gIds)
        .order("display_order");
      if (error) throw error;
      return (data || []) as AutomationGroupItem[];
    },
    enabled: !!campaignId && groups.length > 0,
  });

  const addToGroup = useMutation({
    mutationFn: async ({ groupId, templateId }: { groupId: string; templateId: string }) => {
      const maxOrder = groupItems.filter(i => i.group_id === groupId).length;
      const { error } = await supabase
        .from("automation_group_items")
        .insert({ group_id: groupId, template_id: templateId, display_order: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupItemsKey }),
  });

  const removeFromGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_group_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupItemsKey }),
  });

  const toggleGroupItem = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("automation_group_items").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groupItemsKey }),
  });

  return {
    templates, loadingTemplates, saveTemplate, updateTemplate, deleteTemplate,
    groups, loadingGroups, saveGroup, deleteGroup,
    groupItems, loadingGroupItems, addToGroup, removeFromGroup, toggleGroupItem,
  };
}
