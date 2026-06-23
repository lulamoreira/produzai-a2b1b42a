import { useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Send, MessageCircle, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface PieceLite {
  id: string;
  name: string;
  code: number;
  kit_only?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  pieces: PieceLite[];
}

interface SupplierLite {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone?: string | null;
}

interface KitLite {
  id: string;
  name: string;
  code: number;
}

type RowKey = string; // piece id or `kit:<id>`

const kitKey = (id: string) => `kit:${id}`;

export default function SendQtyRequoteDialog({
  open, onOpenChange, campaignId, campaignName, pieces,
}: Props) {
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  // Live ("current") quantity per piece — uses negotiation rateio if it exists, else original.
  const [liveQtyByPiece, setLiveQtyByPiece] = useState<Record<string, number>>({});
  // Original quantity per piece — always from campaign_store_pieces. Used as old_qty baseline.
  const [origQtyByPiece, setOrigQtyByPiece] = useState<Record<string, number>>({});

  const [kits, setKits] = useState<KitLite[]>([]);
  // Live and original qty per kit (derived from components).
  const [liveQtyByKit, setLiveQtyByKit] = useState<Record<string, number>>({});
  const [origQtyByKit, setOrigQtyByKit] = useState<Record<string, number>>({});

  const [selected, setSelected] = useState<Record<RowKey, boolean>>({});
  const [newQtyInputs, setNewQtyInputs] = useState<Record<RowKey, string>>({});

  const [expiresInDays, setExpiresInDays] = useState<number>(3);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      try {
        const { supabasePaginate } = await import("@/lib/supabasePaginate");

        const supsP = supabase
          .from("budget_suppliers")
          .select("id, company_name, contact_name, phone, status, negotiation_status")
          .eq("campaign_id", campaignId);

        const origRowsP = supabasePaginate<any>((from, to) =>
          (supabase as any)
            .from("campaign_store_pieces")
            .select("store_id, piece_id, quantity", { count: "exact" })
            .eq("campaign_id", campaignId)
            .order("store_id")
            .range(from, to)
        );

        const negRowsP = supabasePaginate<any>((from, to) =>
          (supabase as any)
            .from("budget_negotiation_store_pieces")
            .select("store_id, piece_id, quantity", { count: "exact" })
            .eq("campaign_id", campaignId)
            .is("supplier_id", null)
            .order("store_id")
            .range(from, to)
        );

        const kitsP = (supabase as any)
          .from("campaign_kits")
          .select("id, name, code")
          .eq("campaign_id", campaignId);

        const [{ data: sups }, origRows, negRows, kitsRes] = await Promise.all([
          supsP, origRowsP, negRowsP, kitsP,
        ]);
        if (cancelled) return;

        const filtered = (sups ?? []).filter((s: any) =>
          ["submitted", "enviado", "winner", "negotiation_submitted"].includes(s.status) ||
          s.negotiation_status === "submitted" || s.negotiation_status === "approved"
        );
        setSuppliers(filtered as any);

        const kitsList: KitLite[] = (kitsRes.data ?? []) as KitLite[];
        setKits(kitsList);

        const kitIds = kitsList.map((k) => k.id);
        const kitPiecesRes = kitIds.length
          ? await (supabase as any)
              .from("campaign_kit_pieces")
              .select("kit_id, piece_id, quantity")
              .in("kit_id", kitIds)
          : { data: [] };
        if (cancelled) return;
        const kitPieces: Array<{ kit_id: string; piece_id: string; quantity: number }> =
          kitPiecesRes.data ?? [];

        // Per-piece totals
        const origByPiece: Record<string, number> = {};
        const negByPiece: Record<string, number> = {};
        for (const r of origRows as any[]) {
          origByPiece[r.piece_id] = (origByPiece[r.piece_id] || 0) + Number(r.quantity || 0);
        }
        for (const r of negRows as any[]) {
          negByPiece[r.piece_id] = (negByPiece[r.piece_id] || 0) + Number(r.quantity || 0);
        }
        const hasNeg = (negRows as any[]).length > 0;
        setOrigQtyByPiece(origByPiece);
        setLiveQtyByPiece(hasNeg ? negByPiece : origByPiece);

        // Per-(store, piece) for kit derivation
        const origByStore = new Map<string, number>();
        const negByStore = new Map<string, number>();
        for (const r of origRows as any[]) origByStore.set(`${r.store_id}:${r.piece_id}`, Number(r.quantity) || 0);
        for (const r of negRows as any[]) negByStore.set(`${r.store_id}:${r.piece_id}`, Number(r.quantity) || 0);
        const allStoreIds = [...new Set<string>([
          ...(origRows as any[]).map((r) => r.store_id as string),
          ...(negRows as any[]).map((r) => r.store_id as string),
        ])];

        const componentsByKit = new Map<string, Array<{ piece_id: string; quantity: number }>>();
        for (const kp of kitPieces) {
          if (!componentsByKit.has(kp.kit_id)) componentsByKit.set(kp.kit_id, []);
          componentsByKit.get(kp.kit_id)!.push({ piece_id: kp.piece_id, quantity: kp.quantity });
        }

        const origKit: Record<string, number> = {};
        const liveKit: Record<string, number> = {};
        for (const kit of kitsList) {
          const components = componentsByKit.get(kit.id) ?? [];
          if (components.length === 0) { origKit[kit.id] = 0; liveKit[kit.id] = 0; continue; }
          let oldTotal = 0;
          let liveTotal = 0;
          for (const storeId of allStoreIds) {
            let oldMin = Infinity;
            let liveMin = Infinity;
            for (const comp of components) {
              const key = `${storeId}:${comp.piece_id}`;
              const mult = comp.quantity || 1;
              oldMin = Math.min(oldMin, Math.floor((origByStore.get(key) ?? 0) / mult));
              const liveSrc = hasNeg ? negByStore : origByStore;
              liveMin = Math.min(liveMin, Math.floor((liveSrc.get(key) ?? 0) / mult));
            }
            oldTotal += oldMin === Infinity ? 0 : oldMin;
            liveTotal += liveMin === Infinity ? 0 : liveMin;
          }
          origKit[kit.id] = oldTotal;
          liveKit[kit.id] = liveTotal;
        }
        setOrigQtyByKit(origKit);
        setLiveQtyByKit(liveKit);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, campaignId]);

  useEffect(() => {
    if (!open) {
      setSelectedSupplierId("");
      setSelected({});
      setNewQtyInputs({});
      setGeneratedLink(null);
      setCopied(false);
      setExpiresInDays(3);
    }
  }, [open]);

  const liveQtyFor = (key: RowKey) =>
    key.startsWith("kit:") ? (liveQtyByKit[key.slice(4)] ?? 0) : (liveQtyByPiece[key] ?? 0);

  const origQtyFor = (key: RowKey) =>
    key.startsWith("kit:") ? (origQtyByKit[key.slice(4)] ?? 0) : (origQtyByPiece[key] ?? 0);

  const toggle = (key: RowKey, checked: boolean) => {
    setSelected((s) => ({ ...s, [key]: checked }));
  };

  const updateNewQty = (key: RowKey, v: string) => {
    setNewQtyInputs((s) => ({ ...s, [key]: v }));
  };

  // Rows interleaved by código (peças visíveis + kits).
  const rows = useMemo(() => {
    const pieceRows = pieces
      .filter((p) => !p.kit_only)
      .map((p) => ({ key: p.id as RowKey, code: p.code, name: p.name, isKit: false }));
    const kitRows = kits.map((k) => ({
      key: kitKey(k.id) as RowKey, code: k.code, name: k.name, isKit: true,
    }));
    return [...pieceRows, ...kitRows].sort((a, b) => a.code - b.code);
  }, [pieces, kits]);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const canGenerate = !!selectedSupplierId && selectedCount > 0 && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const qty_changes: Record<string, { old_qty: number; new_qty: number }> = {};
      for (const row of rows) {
        if (!selected[row.key]) continue;
        const newRaw = newQtyInputs[row.key];
        const live = liveQtyFor(row.key);
        const parsed = parseInt(newRaw ?? "", 10);
        const newQ = Number.isFinite(parsed) ? parsed : live;
        qty_changes[row.key] = { old_qty: origQtyFor(row.key), new_qty: newQ };
      }

      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("budget_qty_requotes" as any)
        .insert({
          campaign_id: campaignId,
          supplier_id: selectedSupplierId,
          qty_changes,
          expires_at: expiresAt,
        } as any)
        .select("access_token")
        .single();
      if (error) throw error;
      const token = (data as any).access_token;
      const link = `${window.location.origin}/recotacao-qtd/${token}`;
      setGeneratedLink(link);
      toast.success("Link gerado!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar link");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast.success("Link copiado!");
  };

  const handleWhatsApp = () => {
    if (!generatedLink || !selectedSupplier) return;
    const msg = `Olá, ${selectedSupplier.contact_name || selectedSupplier.company_name}! Precisamos revisar os preços de ${campaignName} devido a ajuste de quantidades. Acesse o link para confirmar: ${generatedLink}`;
    const phone = (selectedSupplier.phone || "").replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recotação por Quantidade</DialogTitle>
          <DialogDescription>
            Envie um link para um fornecedor revisar preços com base nas novas quantidades.
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <Label className="text-xs">Link de recotação</Label>
              <div className="flex gap-2">
                <Input readOnly value={generatedLink} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <Button onClick={handleWhatsApp} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fornecedor</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.company_name}
                      </SelectItem>
                    ))}
                    {suppliers.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum fornecedor elegível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Math.max(1, Number(e.target.value) || 3))}
                />
              </div>
            </div>

            <div className="border rounded-lg max-h-[360px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Peça / Kit</TableHead>
                    <TableHead className="text-center w-24">Qtd. atual</TableHead>
                    <TableHead className="text-center w-32">Nova Qtd.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Carregando quantidades ao vivo…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingData && rows.map((row) => {
                    const checked = !!selected[row.key];
                    const orig = origQtyFor(row.key);
                    const live = liveQtyFor(row.key);
                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggle(row.key, !!v)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.isKit && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">KIT</span>
                            )}
                            <span className="text-muted-foreground">#{row.code}</span>
                            <span>{row.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground tabular-nums">
                          {orig}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 text-center"
                            value={newQtyInputs[row.key] ?? ""}
                            onChange={(e) => updateNewQty(row.key, e.target.value)}
                            placeholder={String(curr)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loadingData && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                        Nenhuma peça disponível.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-xs text-muted-foreground">
              {selectedCount} item(ns) selecionado(s)
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleGenerate} disabled={!canGenerate} className="gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gerar Link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
