import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MAX_CUSTOM_FIELDS } from "@/lib/customFields";

export type FieldType = "text" | "number" | "boolean" | "select" | "date";

export interface ClientFieldConfig {
  id: string;
  client_id: string;
  field_index: number;
  fillable_by_store: boolean;
  field_type: FieldType;
  options: string[];
  help_text: string | null;
  required: boolean;
}

export interface UpsertFieldConfigInput {
  client_id: string;
  field_index: number;
  fillable_by_store: boolean;
  field_type: FieldType;
  options: string[];
  help_text: string | null;
  required: boolean;
}

export function useClientFieldConfig(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-field-config", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("client_custom_field_config" as any) as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("field_index", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        options: Array.isArray(r.options) ? r.options : [],
      })) as ClientFieldConfig[];
    },
  });
}

export function useUpsertClientFieldConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertFieldConfigInput) => {
      const { error } = await (supabase
        .from("client_custom_field_config" as any) as any)
        .upsert(
          {
            client_id: input.client_id,
            field_index: input.field_index,
            fillable_by_store: input.fillable_by_store,
            field_type: input.field_type,
            options: input.options,
            help_text: input.help_text,
            required: input.required,
          },
          { onConflict: "client_id,field_index" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["client-field-config", vars.client_id] });
    },
  });
}

/**
 * For each of the 15 custom fields, count how many stores of the client
 * already have a non-empty value. Runs 15 head+count queries in parallel.
 */
export function useCustomFieldFilledCounts(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-field-filled-counts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const indices = Array.from({ length: MAX_CUSTOM_FIELDS }, (_, i) => i + 1);
      const results = await Promise.all(
        indices.map(async (i) => {
          const col = `custom_field_${i}`;
          const { count, error } = await (supabase
            .from("client_stores") as any)
            .select("id", { count: "exact", head: true })
            .eq("client_id", clientId!)
            .not(col, "is", null)
            .neq(col, "");
          if (error) throw error;
          return [i, count ?? 0] as const;
        }),
      );
      const map: Record<number, number> = {};
      for (const [i, c] of results) map[i] = c;
      return map;
    },
  });
}
