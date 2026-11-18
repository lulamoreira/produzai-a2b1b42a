import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  activeCampaignStores, assignedPecaIds, internalNoteText, occurrenceWindow, occurrenceWindowWarning,
  pecaOptions, reporterTypeValue, type ReporterKind,
} from "@/lib/adminOccurrence";
import { useAdminOccurrenceData, useStoreLalAssignments } from "./useAdminOccurrenceData";
import { ensureStoreToken, submitAdminOccurrences, type AdminOccurrenceEntry } from "./adminOccurrenceSubmit";
import { AdminStorePicker } from "./AdminStorePicker";
import { AdminOccurrenceEntryCard } from "./AdminOccurrenceEntryCard";

export interface AdminOccurrenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  clientId: string;
}

const newEntry = (): AdminOccurrenceEntry => ({
  key: Math.random().toString(36).slice(2), pecaId: "", motiveId: "", description: "", priority: "media", photos: [],
});

/**
 * "NOVA OCORRÊNCIA" interno (só admin/master). Grava como o portal do lojista,
 * sem a trava de prazo, e deixa uma nota interna em cada ocorrência.
 */
export default function AdminOccurrenceDialog({ open, onOpenChange, campaignId, clientId }: AdminOccurrenceDialogProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { stores, disabled, lal, meta } = useAdminOccurrenceData(campaignId, clientId, open);
  const [storeId, setStoreId] = useState("");
  const [reporter, setReporter] = useState<ReporterKind>("agencia");
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [entries, setEntries] = useState<AdminOccurrenceEntry[]>([newEntry()]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const assignments = useStoreLalAssignments(campaignId, storeId);

  const { data: userName = "" } = useQuery({
    queryKey: ["admin-occ-user-name", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nickname, display_name").eq("user_id", user!.id).maybeSingle();
      return data?.nickname || data?.display_name || user?.email || "";
    },
  });

  const storeList = useMemo(() => activeCampaignStores(stores.data ?? [], disabled.data ?? []), [stores.data, disabled.data]);
  const selectedStore = storeList.find((s) => s.id === storeId);
  const lalData = lal.data;
  const options = useMemo(() => {
    if (!lalData) return [];
    const assigned = storeId && assignments.data
      ? assignedPecaIds({ ...lalData, lojas: assignments.data })
      : new Set<string>();
    return pecaOptions({ ...lalData, assigned });
  }, [lalData, storeId, assignments.data]);
  const pecaById = useMemo(() => new Map((lalData?.pecas ?? []).map((p) => [p.id, p])), [lalData]);
  const occWindow = useMemo(() => occurrenceWindow(meta.data?.deadline ?? null), [meta.data?.deadline]);
  const warning = meta.data ? occurrenceWindowWarning(occWindow) : null;

  const loading = stores.isLoading || disabled.isLoading || lal.isLoading || meta.isLoading;
  const loadError = stores.error || disabled.error || lal.error || meta.error;
  const valid = !!storeId && entries.every((e) => e.pecaId && e.motiveId);
  const busy = submitting || uploadingKey !== null;

  const reset = () => {
    setStoreId(""); setReporter("agencia"); setContact({ name: "", phone: "", email: "" }); setEntries([newEntry()]);
  };
  const close = (v: boolean) => { if (submitting) return; if (!v) reset(); onOpenChange(v); };
  const patch = (key: string, p: Partial<AdminOccurrenceEntry>) =>
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...p } : e)));

  const handleSubmit = async () => {
    if (!valid || submitting || !selectedStore || !meta.data) return;
    setSubmitting(true);
    try {
      const tokenId = await ensureStoreToken(campaignId, storeId);
      const note = internalNoteText({
        userName, now: new Date(), outOfWindow: occWindow.kind !== "ok",
        storeContact: reporter === "lojista" ? contact : null,
      });
      const { saved, failed } = await submitAdminOccurrences({
        campaignId, storeId, tokenId, internalNote: note, entries, pecaById,
        reporterType: reporterTypeValue(reporter, meta.data.agencyName, meta.data.clientName),
      });
      ["portal-occurrences-v2", "portal-occurrences-by-store", "loja-a-loja-dashboard", "campaign_stats",
        "store-portal-occurrences", "occurrences", "store-portal-tokens"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k, campaignId] }));
      if (saved > 0) toast.success(`${saved} ocorrência(s) registrada(s) para ${selectedStore.name}.`);
      if (failed.length > 0) {
        toast.error(`Não foi possível gravar: ${failed.map((f) => `Ocorrência ${f.index + 1} (${f.message})`).join("; ")}.`);
        const failedKeys = new Set(failed.map((f) => entries[f.index].key));
        setEntries((prev) => prev.filter((e) => failedKeys.has(e.key)));
        return;
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Não foi possível registrar: ${err instanceof Error ? err.message : (err as { message?: string })?.message ?? "erro desconhecido"}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ocorrência</DialogTitle>
          <DialogDescription>Registro interno — grava como se viesse do portal do lojista.</DialogDescription>
        </DialogHeader>

        {warning && (
          <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
            <span>{warning}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : loadError ? (
          <p className="text-sm text-destructive py-6 text-center">Não foi possível carregar os dados da campanha.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Loja *</label>
              <AdminStorePicker stores={storeList} value={storeId} onChange={setStoreId} disabled={submitting} />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Reportado por *</label>
              <Select value={reporter} onValueChange={(v) => setReporter(v as ReporterKind)} disabled={submitting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agencia">Agência{meta.data?.agencyName ? ` (${meta.data.agencyName})` : ""}</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="cliente">Cliente{meta.data?.clientName ? ` (${meta.data.clientName})` : ""}</SelectItem>
                  <SelectItem value="lojista">Lojista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reporter === "lojista" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="Nome (opcional)" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} disabled={submitting} />
                <Input placeholder="DDD + telefone (opcional)" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} disabled={submitting} />
                <Input placeholder="E-mail (opcional)" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} disabled={submitting} />
              </div>
            )}

            {entries.map((e, i) => (
              <AdminOccurrenceEntryCard
                key={e.key}
                index={i}
                entry={e}
                options={options}
                motivos={meta.data?.motivos ?? []}
                showPriority={meta.data?.showPriority ?? true}
                canRemove={entries.length > 1}
                disabled={submitting}
                uploading={uploadingKey === e.key}
                photoPath={`internal/${campaignId}`}
                onChange={(p) => patch(e.key, p)}
                onRemove={() => setEntries((prev) => prev.filter((x) => x.key !== e.key))}
                onUploadingChange={(v) => setUploadingKey(v ? e.key : null)}
              />
            ))}

            <Button type="button" variant="outline" className="w-full gap-1.5" onClick={() => setEntries((p) => [...p, newEntry()])} disabled={busy}>
              <Plus className="h-4 w-4" /> Adicionar outra ocorrência
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => close(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!valid || busy || loading}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Registrando...</> : `Registrar ${entries.length} ocorrência(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
