import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Agency = {
  id: string;
  name: string;
  color: string | null;
  logo_url: string | null;
  created_at: string;
  deleted_at: string | null;
};

export function useAgencies(includeDeleted = false) {
  return useQuery({
    queryKey: ["agencies", includeDeleted],
    queryFn: async () => {
      let query = supabase.from("agencies").select("*").order("name");
      if (!includeDeleted) {
        query = query.is("deleted_at", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Agency[];
    },
  });
}

export function useAddAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agency: { name: string; color?: string }) => {
      const { data, error } = await supabase.from("agencies").insert(agency).select().single();
      if (error) throw error;
      return data as Agency;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agência criada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useUpdateAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Agency> & { id: string }) => {
      const { error } = await supabase.from("agencies").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agência atualizada!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

export function useDeleteAgency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agência removida!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
}

// Logo upload helpers
const MAX_LOGO_SIZE_KB = 500;
const MAX_LOGO_DIMENSION = 512;
const MIN_LOGO_DIMENSION = 64;

export async function validateAndUploadLogo(file: File, agencyId: string): Promise<string> {
  // Validate file size
  const sizeKB = Math.round(file.size / 1024);
  if (sizeKB > MAX_LOGO_SIZE_KB) {
    throw new Error(`Arquivo muito grande: ${sizeKB}KB. Máximo permitido: ${MAX_LOGO_SIZE_KB}KB.`);
  }

  // Validate image dimensions
  const dimensions = await getImageDimensions(file);
  if (dimensions.width !== dimensions.height) {
    throw new Error(`A logo deve ser quadrada. Dimensões recebidas: ${dimensions.width}x${dimensions.height}px.`);
  }
  if (dimensions.width < MIN_LOGO_DIMENSION) {
    throw new Error(`Dimensão mínima: ${MIN_LOGO_DIMENSION}x${MIN_LOGO_DIMENSION}px. Recebido: ${dimensions.width}x${dimensions.height}px.`);
  }
  if (dimensions.width > MAX_LOGO_DIMENSION) {
    throw new Error(`Dimensão máxima: ${MAX_LOGO_DIMENSION}x${MAX_LOGO_DIMENSION}px. Recebido: ${dimensions.width}x${dimensions.height}px.`);
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${agencyId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from("agency-logos")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("agency-logos")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    img.src = URL.createObjectURL(file);
  });
}

export { MAX_LOGO_SIZE_KB, MAX_LOGO_DIMENSION, MIN_LOGO_DIMENSION };
