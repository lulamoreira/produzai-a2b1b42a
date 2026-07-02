import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Search, MessageSquare, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import type { AgencySupplier } from "@/hooks/useAgencySuppliers";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suppliers: AgencySupplier[];
}

function buildAddress(s: AgencySupplier): string {
  const parts = [
    s.logradouro && (s.numero ? `${s.logradouro}, ${s.numero}` : s.logradouro),
    s.complemento,
    s.bairro,
    s.cidade && s.estado ? `${s.cidade}/${s.estado}` : s.cidade || s.estado,
    s.cep,
  ].filter(Boolean);
  if (parts.length) return parts.join(" - ");
  return s.address || "";
}

function buildSupplierBlock(s: AgencySupplier): string {
  const lines: string[] = [];
  lines.push(`*${s.company_name}*`);
  if (s.cnpj) lines.push(`CNPJ: ${s.cnpj}`);

  const services = (s.services || []).filter(Boolean);
  if (services.length) lines.push(`Serviços: ${services.join(", ")}`);

  const addr = buildAddress(s);
  if (addr) lines.push(`Endereço: ${addr}`);

  if (s.website) lines.push(`Site: ${s.website}`);
  if (s.instagram) lines.push(`Instagram: ${s.instagram}`);
  if (s.linkedin) lines.push(`LinkedIn: ${s.linkedin}`);
  if (s.facebook) lines.push(`Facebook: ${s.facebook}`);

  // Contato principal (legado) — só se não houver contatos estruturados
  if ((!s.contacts || s.contacts.length === 0)) {
    if (s.contact_name) lines.push(`Contato: ${s.contact_name}`);
    if (s.phone) lines.push(`Telefone: ${s.phone}`);
    if (s.whatsapp) lines.push(`WhatsApp: ${s.whatsapp}`);
    if (s.email) lines.push(`E-mail: ${s.email}`);
  } else {
    lines.push(`Contatos:`);
    s.contacts.forEach((c) => {
      const header = [c.nome, c.funcao].filter(Boolean).join(" - ");
      if (header) lines.push(`  • ${header}`);
      const info = [
        c.telefone && `Tel: ${c.telefone}`,
        c.whatsapp && `WhatsApp: ${c.whatsapp}`,
        c.email && `E-mail: ${c.email}`,
      ].filter(Boolean);
      if (info.length) lines.push(`    ${info.join(" | ")}`);
    });
    // Fallback: e-mail/telefone principal se não estiver nos contatos
    if (s.email && !s.contacts.some((c) => c.email === s.email)) {
      lines.push(`E-mail geral: ${s.email}`);
    }
  }

  return lines.join("\n");
}

export default function SupplierRecommendDialog({ open, onOpenChange, suppliers }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [intro, setIntro] = useState(
    "Olá! Segue abaixo a indicação de fornecedores parceiros de confiança:",
  );

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...suppliers].sort((a, b) =>
      a.company_name.localeCompare(b.company_name),
    );
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.company_name.toLowerCase().includes(q) ||
        (s.services || []).some((sv) => sv.toLowerCase().includes(q)),
    );
  }, [suppliers, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (filtered.every((s) => selected.has(s.id))) {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((s) => n.delete(s.id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((s) => n.add(s.id));
        return n;
      });
    }
  };

  const selectedSuppliers = useMemo(
    () => suppliers.filter((s) => selected.has(s.id)),
    [suppliers, selected],
  );

  const generatedText = useMemo(() => {
    if (selectedSuppliers.length === 0) return "";
    const blocks = selectedSuppliers.map(buildSupplierBlock).join("\n\n————————————————\n\n");
    return `${intro}\n\n${blocks}`;
  }, [intro, selectedSuppliers]);

  const copy = async () => {
    if (!generatedText) return;
    await navigator.clipboard.writeText(generatedText);
    toast.success("Indicação copiada!");
  };

  const shareWhats = () => {
    if (!generatedText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(generatedText)}`, "_blank");
  };

  const allSelectedInView = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="w-5 h-5" /> Indicar Fornecedores
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lista de seleção */}
          <div className="flex flex-col gap-2 min-h-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou serviço..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <button
                type="button"
                onClick={toggleAll}
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                {allSelectedInView ? "Desmarcar todos" : "Selecionar todos"}
              </button>
              <span>{selected.size} selecionado(s)</span>
            </div>
            <div className="border rounded-md divide-y max-h-[50dvh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </div>
              ) : (
                filtered.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{s.company_name}</div>
                      {(s.services || []).length > 0 && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          {(s.services || []).slice(0, 4).join(", ")}
                          {(s.services || []).length > 4 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Prévia do texto */}
          <div className="flex flex-col gap-2 min-h-0">
            <div className="space-y-1">
              <Label className="text-xs">Introdução</Label>
              <Input value={intro} onChange={(e) => setIntro(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1 flex flex-col min-h-0">
              <Label className="text-xs">Texto gerado</Label>
              <Textarea
                value={generatedText}
                readOnly
                placeholder="Selecione fornecedores à esquerda para gerar o texto de indicação."
                className="flex-1 min-h-[300px] max-h-[50dvh] text-xs font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={copy}
                disabled={!generatedText}
              >
                <Copy className="w-4 h-4 mr-2" /> Copiar
              </Button>
              <Button
                className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white"
                onClick={shareWhats}
                disabled={!generatedText}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
