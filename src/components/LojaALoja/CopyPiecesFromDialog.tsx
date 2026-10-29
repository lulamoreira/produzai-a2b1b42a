import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { buildCopiedPieceRows, copyPieceSources, type CopyPieceItem } from "@/lib/copyLojaALojaPieces";
import type { LojaALojaTipo, LojaALojaPeca } from "@/hooks/useLojaALoja";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CopyPiecesFromDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  selectedTipoId: string | null;
  selectedSubId: string | null;
  tipos: LojaALojaTipo[];
}

export function CopyPiecesFromDialog({ open, onOpenChange, campaignId, selectedTipoId, selectedSubId, tipos }: CopyPiecesFromDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [items, setItems] = useState<CopyPieceItem[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const allPieces = useQuery({
    queryKey: ["loja-a-loja-copy-sources", campaignId], enabled: open,
    queryFn: () => supabasePaginate<LojaALojaPeca>((from, to) => supabase.from("loja_a_loja_pecas")
      .select("*", { count: "exact" }).eq("campaign_id", campaignId)
      .order("display_order").order("id").range(from, to)),
  });
  const sources = copyPieceSources(tipos, allPieces.data ?? [], selectedTipoId, selectedSubId);
  const marked = items.filter(item => item.checked).length;
  const copy = useMutation({
    mutationFn: async () => {
      // Fresh destination order also protects repeated copies before the panel refreshes.
      const existing = await supabasePaginate<{ id: string; display_order: number }>((from, to) => {
        let query = supabase.from("loja_a_loja_pecas").select("id, display_order", { count: "exact" }).eq("campaign_id", campaignId);
        if (selectedSubId) query = query.eq("subdivisao_id", selectedSubId);
        else if (selectedTipoId) query = query.eq("tipo_id", selectedTipoId).is("subdivisao_id", null);
        return query.order("id").range(from, to);
      });
      const rows = buildCopiedPieceRows(items, campaignId, selectedTipoId, selectedSubId, existing);
      if (!rows.length) return 0;
      const { error } = await supabase.from("loja_a_loja_pecas").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: count => {
      setSessionTotal(total => total + count);
      setSourceId(null); setItems([]);
      void qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas"] });
      void qc.invalidateQueries({ queryKey: ["loja-a-loja-pecas-all", campaignId] });
      void qc.invalidateQueries({ queryKey: ["loja-a-loja-copy-sources", campaignId] });
      toast.success(t("Peças copiadas", { defaultValue: `${count} peça(s) copiada(s).` }));
    },
    onError: (error: Error) => toast.error(`${t("Erro ao copiar")}: ${error.message}`),
  });
  const close = (nextOpen: boolean) => {
    if (copy.isPending) return;
    if (!nextOpen) { setSourceId(null); setItems([]); setSessionTotal(0); }
    onOpenChange(nextOpen);
  };
  const update = (id: string, change: Partial<CopyPieceItem>) => setItems(current => current.map(item => item.id === id ? { ...item, ...change } : item));

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{t("Copiar peças de outra letra")}</DialogTitle>
        <DialogDescription>{t("Escolha uma letra, marque as peças e copie. Pode repetir com outras letras.")}</DialogDescription>
      </DialogHeader>
      {allPieces.isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label={t("Carregando")} /> : allPieces.isError
        ? <p className="text-sm text-destructive">{t("Não foi possível carregar as peças.")}</p>
        : <Select value={sourceId ?? ""} disabled={copy.isPending} onValueChange={id => {
          setSourceId(id);
          setItems((allPieces.data ?? []).filter(p => selectedSubId ? p.subdivisao_id === id : p.tipo_id === id && !p.subdivisao_id)
            .map(p => ({ id: p.id, nome: p.nome, image_url: p.image_url, checked: false })));
        }}>
          <SelectTrigger aria-label={t("Letra de origem")}><SelectValue placeholder={t("Letra de origem")} /></SelectTrigger>
          <SelectContent>{sources.map(source => <SelectItem key={source.id} value={source.id}>{source.label}</SelectItem>)}</SelectContent>
        </Select>}
      {!allPieces.isLoading && !allPieces.isError && !sources.length && <p className="text-sm text-muted-foreground">{t("Nenhuma outra letra com peças disponível.")}</p>}
      {items.length > 0 && <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={marked === items.length} disabled={copy.isPending} onCheckedChange={checked => setItems(current => current.map(item => ({ ...item, checked: checked === true })))} />
          {t("Marcar todas")}
        </label>
        <div className="max-h-[40vh] overflow-y-auto space-y-2">
          {items.map(item => <div key={item.id} className="flex items-center gap-2">
            <Checkbox aria-label={`${t("Selecionar")}: ${item.nome}`} checked={item.checked} disabled={copy.isPending} onCheckedChange={checked => update(item.id, { checked: checked === true })} />
            <Input className="min-w-0 flex-1" aria-label={`${t("Nome da peça")}: ${item.nome}`} value={item.nome} disabled={copy.isPending} onChange={e => update(item.id, { nome: e.target.value })} />
            {item.image_url && <img src={getThumbnailUrl(item.image_url, 100)} alt={item.nome} className="h-10 w-10 shrink-0 rounded object-contain" loading="lazy" />}
          </div>)}
        </div>
      </div>}
      {sessionTotal > 0 && <p className="text-xs text-muted-foreground">{t("Copiadas até agora")}: {sessionTotal}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={copy.isPending} onClick={() => close(false)}>{t("Concluir")}</Button>
        <Button disabled={!marked || copy.isPending} onClick={() => copy.mutate()}>
          {copy.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("Copiar marcadas")} ({marked})
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}