import { useCallback } from "react";
import { toast } from "sonner";
import { useSetCampaignDeliveryTypes } from "@/hooks/useMultiClientData";
import { changesToUndoWrites, changesToWrites, type DeliveryChangeRow } from "@/lib/deliveryType";

/**
 * Grava ajustes de logística SÓ nesta campanha (campaign_store_status) e
 * oferece "Desfazer", que devolve cada loja ao ajuste anterior ou ao padrão.
 * Nunca grava no cadastro da loja (client_stores).
 */
export function useDeliveryEditing(campaignId: string) {
  const mutation = useSetCampaignDeliveryTypes();

  const apply = useCallback(
    async (rows: DeliveryChangeRow[], successText: string): Promise<boolean> => {
      if (rows.length === 0) return true;
      try {
        await mutation.mutateAsync({ campaignId, changes: changesToWrites(rows) });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Não foi possível salvar a logística nesta campanha: ${msg}`);
        return false;
      }
      const undoWrites = changesToUndoWrites(rows);
      toast.success(successText, {
        duration: 10000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await mutation.mutateAsync({ campaignId, changes: undoWrites });
              toast.success(`Logística desfeita em ${rows.length} ${rows.length === 1 ? "loja" : "lojas"}.`);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              toast.error(`Não foi possível desfazer: ${msg}`);
            }
          },
        },
      });
      return true;
    },
    [campaignId, mutation],
  );

  return { apply, isSaving: mutation.isPending };
}
