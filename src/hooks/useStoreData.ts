import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Piece = {
  id: number;
  code: number;
  category: string;
  name: string;
  size: string;
  image_url: string | null;
  image_thumb_url?: string | null;
  image_report_url?: string | null;
  image_full_url?: string | null;
  image_hash?: string | null;
  specification: string;
  installation_instructions: string;
};

export type Store = {
  id: number;
  number: number;
  uf: string;
  name: string;
  type: string;
  model: string;
  primary_mod: string;
  secondary_mod: string;
};

export type StorePiece = {
  id: number;
  store_id: number;
  piece_id: number;
  quantity: number;
};

export type ChangeLog = {
  id: number;
  store_id: number;
  piece_id: number | null;
  action: string;
  old_value: number | null;
  new_value: number | null;
  description: string | null;
  created_at: string;
};

export function usePieces() {
  return useQuery({
    queryKey: ["pieces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pieces")
        .select("*")
        .order("code");
      if (error) throw error;
      return data as Piece[];
    },
  });
}

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("number");
      if (error) throw error;
      return data as Store[];
    },
  });
}

export function useStorePieces(storeId: number | null) {
  return useQuery({
    queryKey: ["store_pieces", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_pieces")
        .select("*")
        .eq("store_id", storeId);
      if (error) throw error;
      return data as StorePiece[];
    },
    enabled: !!storeId,
  });
}

export function useAllStorePieces() {
  return useQuery({
    queryKey: ["all_store_pieces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pieces")
        .select("*");
      if (error) throw error;
      return data as StorePiece[];
    },
  });
}

export function useChangeLogs(storeId: number | null) {
  return useQuery({
    queryKey: ["change_logs", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("change_logs")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChangeLog[];
    },
    enabled: !!storeId,
  });
}

export function useUpdateQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      pieceId,
      oldQty,
      newQty,
      description,
    }: {
      storeId: number;
      pieceId: number;
      oldQty: number;
      newQty: number;
      description: string;
    }) => {
      if (newQty === 0) {
        await supabase
          .from("store_pieces")
          .delete()
          .eq("store_id", storeId)
          .eq("piece_id", pieceId);
      } else {
        const { data: existing } = await supabase
          .from("store_pieces")
          .select("id")
          .eq("store_id", storeId)
          .eq("piece_id", pieceId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("store_pieces")
            .update({ quantity: newQty })
            .eq("store_id", storeId)
            .eq("piece_id", pieceId);
        } else {
          await supabase
            .from("store_pieces")
            .insert({ store_id: storeId, piece_id: pieceId, quantity: newQty });
        }
      }

      const action = newQty > oldQty ? "add_quantity" : newQty < oldQty ? "remove_quantity" : "update_quantity";
      await supabase.from("change_logs").insert({
        store_id: storeId,
        piece_id: pieceId,
        action,
        old_value: oldQty,
        new_value: newQty,
        description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["all_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["change_logs"] });
      toast.success("Quantidade atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useAddPieceToStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      pieceId,
      quantity,
    }: {
      storeId: number;
      pieceId: number;
      quantity: number;
    }) => {
      await supabase
        .from("store_pieces")
        .insert({ store_id: storeId, piece_id: pieceId, quantity });

      await supabase.from("change_logs").insert({
        store_id: storeId,
        piece_id: pieceId,
        action: "add_piece",
        old_value: 0,
        new_value: quantity,
        description: `Peça adicionada à loja com quantidade ${quantity}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["all_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["change_logs"] });
      toast.success("Peça adicionada à loja!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useRemovePieceFromStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      pieceId,
      oldQty,
    }: {
      storeId: number;
      pieceId: number;
      oldQty: number;
    }) => {
      await supabase
        .from("store_pieces")
        .delete()
        .eq("store_id", storeId)
        .eq("piece_id", pieceId);

      await supabase.from("change_logs").insert({
        store_id: storeId,
        piece_id: pieceId,
        action: "remove_piece",
        old_value: oldQty,
        new_value: 0,
        description: `Peça removida da loja`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["all_store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["change_logs"] });
      toast.success("Peça removida da loja!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useUpdatePieceImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pieceId,
      imageUrl,
      variants,
    }: {
      pieceId: number;
      imageUrl: string | null;
      variants?: {
        image_thumb_url: string | null;
        image_report_url: string | null;
        image_full_url: string | null;
        image_hash: string | null;
      };
    }) => {
      const payload: Record<string, string | null> = { image_url: imageUrl };
      if (variants) {
        payload.image_thumb_url = variants.image_thumb_url;
        payload.image_report_url = variants.image_report_url;
        payload.image_full_url = variants.image_full_url;
        payload.image_hash = variants.image_hash;
      } else if (imageUrl === null) {
        payload.image_thumb_url = null;
        payload.image_report_url = null;
        payload.image_full_url = null;
        payload.image_hash = null;
      }
      const { error } = await supabase
        .from("pieces")
        .update(payload)
        .eq("id", pieceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pieces"] });
      toast.success("Imagem atualizada!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useAddPiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (piece: { code: number; category: string; name: string; size: string; image_url?: string; specification?: string; installation_instructions?: string }) => {
      const { error } = await supabase.from("pieces").insert(piece);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pieces"] });
      toast.success("Item adicionado à campanha!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useDeletePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pieceId: number) => {
      const { error } = await supabase.from("pieces").delete().eq("id", pieceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pieces"] });
      queryClient.invalidateQueries({ queryKey: ["store_pieces"] });
      queryClient.invalidateQueries({ queryKey: ["all_store_pieces"] });
      toast.success("Item removido da campanha!");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}
