import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { disambiguateKitPieceNames } from "@/lib/disambiguateKitPieces";
import type { OneNoteParsedPiece } from "@/lib/parseOneNoteSheet";

interface OneNoteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  parsed: OneNoteParsedPiece[];
}

/**
 * Confirmação + aplicação da importação nativa da planilha do OneNote.
 * Toda a escrita é sequencial (await) para manter os códigos consistentes.
 */
export function OneNoteImportDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  parsed,
}: OneNoteImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const kitNames = Array.from(
    new Set(parsed.map((p) => p.kitName).filter((n) => n && n.trim() !== "")),
  );

  const handleConfirm = async () => {
    if (importing) return;
    setImporting(true);
    const toastId = "onenote-import";
    toast.loading("Importando planilha do OneNote...", { id: toastId });

    try {
      // 1) próximo code de peça
      const { data: lastPiece, error: lastPieceError } = await supabase
        .from("campaign_pieces")
        .select("code")
        .eq("campaign_id", campaignId)
        .eq("is_deleted", false)
        .order("code", { ascending: false })
        .limit(1);
      if (lastPieceError) throw lastPieceError;
      let nextPieceCode = (lastPiece?.[0]?.code ?? 0) + 1;

      // 2) inserir peças sequencialmente, guardando code -> id
      const codeToId = new Map<number, string>();
      const rowCodes: number[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i];
        const code = nextPieceCode++;
        const { data: inserted, error: insertError } = await supabase
          .from("campaign_pieces")
          .insert({
            campaign_id: campaignId,
            code,
            name: (p.name ?? "").toString(),
            category: ((p.category ?? "").toString()).toUpperCase(),
            size: (p.size ?? "").toString(),
            kit_only: p.kit_only,
            is_mockup: p.is_mockup,
            sub_location: null,
            specification: "Vide Book/Manual",
            installation_instructions: "Sem informações específicas",
            is_deleted: false,
            is_new: false,
            display_order: i,
          })
          .select("id, code")
          .single();
        if (insertError) throw insertError;
        codeToId.set(code, inserted.id);
        rowCodes.push(code);
      }

      // 3) criar kits e vínculos
      const { data: lastKit, error: lastKitError } = await supabase
        .from("campaign_kits")
        .select("code")
        .eq("campaign_id", campaignId)
        .eq("is_deleted", false)
        .order("code", { ascending: false })
        .limit(1);
      if (lastKitError) throw lastKitError;
      let nextKitCode = (lastKit?.[0]?.code ?? 0) + 1;

      for (const kitName of kitNames) {
        const memberIdx = parsed
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => p.kitName === kitName);
        const kitIsMockup = memberIdx.some(({ p }) => p.is_mockup);

        const { data: kit, error: kitError } = await supabase
          .from("campaign_kits")
          .insert({
            campaign_id: campaignId,
            name: kitName,
            code: nextKitCode++,
            is_deleted: false,
            is_mockup: kitIsMockup,
          })
          .select("id")
          .single();
        if (kitError) throw kitError;

        for (let order = 0; order < memberIdx.length; order++) {
          const pieceId = codeToId.get(rowCodes[memberIdx[order].idx]);
          if (!pieceId) continue;
          const { error: linkError } = await supabase.from("campaign_kit_pieces").insert({
            kit_id: kit.id,
            piece_id: pieceId,
            quantity: 1,
            display_order: order,
          });
          if (linkError) throw linkError;
        }
      }

      // 4) desambiguação de nomes de peças de kit
      await disambiguateKitPieceNames(campaignId);

      // 5) refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kits"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kit_pieces"] }),
      ]);

      toast.success(`Importadas ${parsed.length} peças e ${kitNames.length} kits do OneNote`, {
        id: toastId,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro ao importar: ${e?.message || e}`, { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !importing && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Importar do OneNote</AlertDialogTitle>
          <AlertDialogDescription>
            {parsed.length} peças e {kitNames.length} kits serão importados para a campanha{" "}
            {campaignName}. Continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={importing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={importing || parsed.length === 0}
          >
            {importing ? "Importando..." : "Importar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
