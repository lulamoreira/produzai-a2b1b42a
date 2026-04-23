import { useState, useEffect, useCallback } from "react";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { supabase } from "@/integrations/supabase/client";
import { criarNotificacao } from "@/lib/criarNotificacao";
import { toast } from "sonner";
import type { PortalData } from "@/pages/StorePortal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, Minus, Image as ImageIcon, ClipboardCheck } from "lucide-react";

type ItemStatus = "ok" | "nao_ok" | "na";

interface Props {
  data: PortalData;
  agencyId: string;
}

export default function ConformidadeTab({ data, agencyId }: Props) {
  const [statusMap, setStatusMap] = useState<Record<string, ItemStatus>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const { tipos, subdivisoes, pecas, lojas } = data;

  // Build two assignment sets: tipo-level and subdivisao-level
  const assignedTipoIds = new Set(lojas.filter(l => l.tipo_id && !l.subdivisao_id).map(l => l.tipo_id!));
  const assignedSubIds = new Set(lojas.filter(l => l.subdivisao_id).map(l => l.subdivisao_id!));
  const hasAssignments = assignedTipoIds.size > 0 || assignedSubIds.size > 0;

  const filteredPecas = hasAssignments
    ? pecas.filter(p =>
        (p.tipo_id && assignedTipoIds.has(p.tipo_id) && !p.subdivisao_id) ||
        (p.subdivisao_id && assignedSubIds.has(p.subdivisao_id))
      )
    : pecas;

  const loadHistory = useCallback(async () => {
    const { data: rows } = await supabase
      .from("store_compliance_checks")
      .select("*")
      .eq("campaign_id", data.campaign.id)
      .eq("store_id", data.store.id)
      .order("checked_at", { ascending: false })
      .limit(10);
    setHistory(rows || []);
  }, [data.campaign.id, data.store.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const setStatus = (pecaId: string, status: ItemStatus) => {
    setStatusMap(prev => ({ ...prev, [pecaId]: status }));
  };

  const allMarked = filteredPecas.every(p => statusMap[p.id]);
  const naoOkCount = filteredPecas.filter(p => statusMap[p.id] === "nao_ok").length;

  const handleSubmit = async () => {
    if (!allMarked) { toast.error("Marque todas as peças antes de finalizar."); return; }
    setSubmitting(true);

    const overallStatus = naoOkCount > 0 ? "nao_conforme" : "conforme";

    // 1. Create compliance check
    const { data: checkRow, error: checkErr } = await supabase
      .from("store_compliance_checks")
      .insert({
        campaign_id: data.campaign.id,
        store_id: data.store.id,
        checked_by_token: data.token_id,
        notes: notes.trim() || null,
        overall_status: overallStatus,
        checked_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (checkErr || !checkRow) {
      toast.error("Erro ao salvar checklist.");
      console.error(checkErr);
      setSubmitting(false);
      return;
    }

    // 2. Create compliance items
    const items = filteredPecas.map(p => ({
      check_id: checkRow.id,
      loja_a_loja_peca_id: p.id,
      tipo_id: p.tipo_id,
      subdivisao_id: p.subdivisao_id,
      status: statusMap[p.id],
      creates_occurrence: statusMap[p.id] === "nao_ok",
      creates_replacement: statusMap[p.id] === "nao_ok",
    }));

    const { error: itemsErr } = await supabase
      .from("store_compliance_items")
      .insert(items);

    if (itemsErr) {
      console.error("Items error:", itemsErr);
    }

    // 3. Auto-create occurrence + replacement for nao_ok pieces
    const naoOkPecas = filteredPecas.filter(p => statusMap[p.id] === "nao_ok");
    for (const peca of naoOkPecas) {
      try {
        await supabase.from("store_occurrence_reports").insert({
          token_id: data.token_id,
          campaign_id: data.campaign.id,
          store_id: data.store.id,
          loja_a_loja_peca_id: peca.id,
          tipo_id: peca.tipo_id,
          subdivisao_id: peca.subdivisao_id,
          description: `Não conforme - identificado na verificação de conformidade.`,
          priority: "alta",
        });

        await supabase.from("store_replacement_requests").insert({
          token_id: data.token_id,
          campaign_id: data.campaign.id,
          store_id: data.store.id,
          loja_a_loja_peca_id: peca.id,
          tipo_id: peca.tipo_id,
          subdivisao_id: peca.subdivisao_id,
          reason: "Não conforme - identificado na verificação de conformidade.",
          quantity_requested: 1,
          status: "pendente",
        });
      } catch {}
    }

    // 4. Notify
    try {
      await criarNotificacao({
        agency_id: agencyId,
        campaign_id: data.campaign.id,
        store_id: data.store.id,
        type: "store_compliance_check",
        title: "Checklist de conformidade finalizado",
        body: `${data.store.name}: ${overallStatus === "conforme" ? "Tudo conforme ✓" : `${naoOkCount} peça(s) não conforme(s)`}.`,
      });
    } catch {}

    toast.success("Checklist finalizado com sucesso!");
    setStatusMap({});
    setNotes("");
    loadHistory();
    setSubmitting(false);
  };

  // Group pieces for display
  const relevantTipoIds = new Set([
    ...assignedTipoIds,
    ...subdivisoes.filter(s => assignedSubIds.has(s.id)).map(s => s.tipo_id),
  ]);

  const grouped = tipos
    .filter(t => !hasAssignments || relevantTipoIds.has(t.id))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(tipo => {
      const tipoSubs = subdivisoes.filter(s => s.tipo_id === tipo.id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const tipoPecas = filteredPecas.filter(p => p.tipo_id === tipo.id && !p.subdivisao_id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const subGroups = tipoSubs.map(sub => ({
        sub,
        pecas: filteredPecas.filter(p => p.subdivisao_id === sub.id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      }));
      return { tipo, pecasNoSub: tipoPecas, subGroups };
    });

  const renderPecaRow = (peca: PortalData["pecas"][number]) => {
    const current = statusMap[peca.id];
    return (
      <div key={peca.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
        <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
          {peca.image_url ? (
            <img src={getThumbnailUrl(peca.image_url, 100)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-4 h-4 text-muted-foreground/30" />
          )}
        </div>
        <p className="text-xs font-medium flex-1 min-w-0 truncate">{peca.nome}</p>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setStatus(peca.id, "ok")}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
              current === "ok" ? "bg-green-500 text-white ring-2 ring-green-300" : "bg-muted text-muted-foreground hover:bg-green-100"
            }`}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setStatus(peca.id, "nao_ok")}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
              current === "nao_ok" ? "bg-red-500 text-white ring-2 ring-red-300" : "bg-muted text-muted-foreground hover:bg-red-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setStatus(peca.id, "na")}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
              current === "na" ? "bg-gray-500 text-white ring-2 ring-gray-300" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">Marque cada peça como OK, Não OK ou N/A. Peças marcadas como "Não OK" geram ocorrência e reposição automaticamente.</p>

      <div className="space-y-6">
        {grouped.map(({ tipo, pecasNoSub, subGroups }) => (
          <div key={tipo.id} className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-[#8C6F4E] text-white flex items-center justify-center text-xs font-bold">{tipo.letra}</span>
              {tipo.nome}
            </h3>

            {pecasNoSub.map(renderPecaRow)}

            {subGroups.map(({ sub, pecas: subPecas }) =>
              subPecas.length > 0 ? (
                <div key={sub.id} className="mt-2">
                  <p className="text-xs text-muted-foreground font-medium mb-1 ml-1">{sub.nome}</p>
                  {subPecas.map(renderPecaRow)}
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>

      {filteredPecas.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{Object.keys(statusMap).length}/{filteredPecas.length} marcadas</span>
            {naoOkCount > 0 && <span className="text-destructive font-medium">{naoOkCount} não conforme(s)</span>}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Observações (opcional)</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações gerais sobre a verificação..." className="min-h-[60px]" />
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !allMarked} className="w-full bg-[#8C6F4E] hover:bg-[#7a6043]">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Finalizando...</> : <><ClipboardCheck className="w-4 h-4 mr-2" /> Finalizar Checklist</>}
          </Button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Verificações anteriores</h3>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="rounded-lg border border-border p-3 bg-card text-sm flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">{new Date(h.checked_at).toLocaleDateString("pt-BR")} {new Date(h.checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {h.notes && <p className="text-xs mt-0.5 line-clamp-1">{h.notes}</p>}
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  h.overall_status === "conforme" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                }`}>
                  {h.overall_status === "conforme" ? "Conforme" : "Não conforme"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
