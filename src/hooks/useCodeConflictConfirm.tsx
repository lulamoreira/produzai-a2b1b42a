import { useCallback, useRef, useState, type ReactElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { findCodeConflicts, describeCodeConflict, type CodeConflict } from "@/lib/itemCodeConflicts";

/**
 * Lê do banco (dados atuais, não o cache da tela) as peças e kits ativos da
 * campanha que usam o código informado.
 */
export async function fetchCodeConflicts(
  campaignId: string,
  code: number,
  ignore?: { pieceId?: string; kitId?: string },
): Promise<CodeConflict[]> {
  const [piecesRes, kitsRes] = await Promise.all([
    supabase.from("campaign_pieces").select("id, code, name, kit_only, is_deleted")
      .eq("campaign_id", campaignId).eq("code", code).eq("is_deleted", false),
    supabase.from("campaign_kits").select("id, code, name, is_deleted")
      .eq("campaign_id", campaignId).eq("code", code).eq("is_deleted", false),
  ]);
  if (piecesRes.error) throw piecesRes.error;
  if (kitsRes.error) throw kitsRes.error;
  return findCodeConflicts(code, { pieces: piecesRes.data ?? [], kits: kitsRes.data ?? [] }, ignore);
}

interface PendingPrompt {
  code: number;
  conflicts: CodeConflict[];
  resolve: (ok: boolean) => void;
}

/**
 * Antes de salvar um código novo: confere no banco e, se o número já existir,
 * pergunta ao usuário se quer manter mesmo assim.
 * Resolve true para seguir com o salvamento, false para cancelar.
 */
export function useCodeConflictConfirm(): {
  confirmCode: (campaignId: string | undefined, code: number, ignore?: { pieceId?: string; kitId?: string }, fallback?: CodeConflict[]) => Promise<boolean>;
  dialog: ReactElement;
} {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const pendingRef = useRef<PendingPrompt | null>(null);

  const finish = useCallback((ok: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(ok);
  }, []);

  const confirmCode = useCallback(async (
    campaignId: string | undefined,
    code: number,
    ignore?: { pieceId?: string; kitId?: string },
    fallback: CodeConflict[] = [],
  ): Promise<boolean> => {
    let conflicts = fallback;
    if (campaignId) {
      try {
        conflicts = await fetchCodeConflicts(campaignId, code, ignore);
      } catch (err) {
        console.error("Falha ao conferir código repetido:", err);
        toast.error("Não foi possível conferir se o código já existe. Tente de novo.");
        return false;
      }
    }
    if (conflicts.length === 0) return true;
    return new Promise<boolean>((resolve) => {
      const prompt = { code, conflicts, resolve };
      pendingRef.current = prompt;
      setPending(prompt);
    });
  }, []);

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) finish(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>O código {pending?.code} já existe nesta campanha</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Este número já está sendo usado por:</p>
              <ul className="list-disc pl-5 space-y-1 text-foreground">
                {pending?.conflicts.map((c) => <li key={`${c.kind}-${c.id}`}>{describeCodeConflict(c)}</li>)}
              </ul>
              <p>Códigos repetidos podem confundir o rateio, as planilhas e o fornecedor. Quer usar este código mesmo assim?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Voltar e trocar</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}>Usar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmCode, dialog };
}
