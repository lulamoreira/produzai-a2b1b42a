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

export default function SendQtyRequoteDialog({
  open, onOpenChange, campaignId, campaignName, pieces,
}: Props) {
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [qtyChanges, setQtyChanges] = useState<Record<string, { old_qty: number; new_qty: number }>>({});
  const [newQtyInputs, setNewQtyInputs] = useState<Record<string, string>>({});
  const [currentQtyMap, setCurrentQtyMap] = useState<Record<string, number>>({});
  const [expiresInDays, setExpiresInDays] = useState<number>(3);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load suppliers + current qty per piece when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: sups } = await supabase
        .from("budget_suppliers")
        .select("id, company_name, contact_name, phone, status, negotiation_status")
        .eq("campaign_id", campaignId);
      const filtered = (sups ?? []).filter((s: any) =>
        ["submitted", "enviado", "winner", "negotiation_submitted"].includes(s.status) ||
        s.negotiation_status === "submitted" || s.negotiation_status === "approved"
      );
      setSuppliers(filtered as any);

      const { data: csp } = await supabase
        .from("campaign_store_pieces")
        .select("piece_id, quantity")
        .eq("campaign_id", campaignId);
      const m: Record<string, number> = {};
      (csp ?? []).forEach((r: any) => {
        m[r.piece_id] = (m[r.piece_id] || 0) + Number(r.quantity || 0);
      });
      setCurrentQtyMap(m);
    })();
  }, [open, campaignId]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSelectedSupplierId("");
      setQtyChanges({});
      setNewQtyInputs({});
      setGeneratedLink(null);
      setCopied(false);
      setExpiresInDays(3);
    }
  }, [open]);

  const togglePiece = (pieceId: string, checked: boolean) => {
    setQtyChanges((s) => {
      const next = { ...s };
      if (checked) {
        const newQty = parseInt(newQtyInputs[pieceId] || "", 10);
        next[pieceId] = {
          old_qty: currentQtyMap[pieceId] || 0,
          new_qty: Number.isFinite(newQty) ? newQty : (currentQtyMap[pieceId] || 0),
        };
      } else {
        delete next[pieceId];
      }
      return next;
    });
  };

  const updateNewQty = (pieceId: string, v: string) => {
    setNewQtyInputs((s) => ({ ...s, [pieceId]: v }));
    setQtyChanges((s) => {
      if (!s[pieceId]) return s;
      const n = parseInt(v, 10);
      return {
        ...s,
        [pieceId]: { ...s[pieceId], new_qty: Number.isFinite(n) ? n : 0 },
      };
    });
  };

  const filteredPieces = useMemo(
    () => pieces.filter((p) => !p.kit_only).sort((a, b) => a.code - b.code),
    [pieces]
  );

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const canGenerate =
    !!selectedSupplierId && Object.keys(qtyChanges).length > 0 && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("budget_qty_requotes" as any)
        .insert({
          campaign_id: campaignId,
          supplier_id: selectedSupplierId,
          qty_changes: qtyChanges,
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
                    <TableHead>Peça</TableHead>
                    <TableHead className="text-center w-24">Qtd. atual</TableHead>
                    <TableHead className="text-center w-32">Nova Qtd.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPieces.map((p) => {
                    const checked = !!qtyChanges[p.id];
                    const curr = currentQtyMap[p.id] || 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => togglePiece(p.id, !!v)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="text-muted-foreground">#{p.code}</span> {p.name}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground tabular-nums">
                          {curr}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 text-center"
                            value={newQtyInputs[p.id] ?? ""}
                            onChange={(e) => updateNewQty(p.id, e.target.value)}
                            placeholder={String(curr)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredPieces.length === 0 && (
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
              {Object.keys(qtyChanges).length} peça(s) selecionada(s)
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
