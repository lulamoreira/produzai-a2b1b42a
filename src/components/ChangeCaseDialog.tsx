import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type CaseMode = "sentence" | "lower" | "upper" | "title" | "toggle";

const LOCALE = "pt-BR";
const PT_LOWER = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
  "para", "com", "a", "o", "as", "os",
]);

export function transformLower(s: string): string {
  return s.toLocaleLowerCase(LOCALE);
}
export function transformUpper(s: string): string {
  return s.toLocaleUpperCase(LOCALE);
}
export function transformSentenceCase(s: string): string {
  const lower = s.toLocaleLowerCase(LOCALE);
  const idx = lower.search(/\S/);
  if (idx < 0) return lower;
  return lower.slice(0, idx) + lower.charAt(idx).toLocaleUpperCase(LOCALE) + lower.slice(idx + 1);
}
export function transformTitleCase(s: string): string {
  const lower = s.toLocaleLowerCase(LOCALE);
  const parts = lower.split(/(\s+)/);
  let wordIndex = 0;
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || part === "") return part;
      const isFirst = wordIndex === 0;
      wordIndex++;
      if (!isFirst && PT_LOWER.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase(LOCALE) + part.slice(1);
    })
    .join("");
}
export function transformToggle(s: string): string {
  let out = "";
  for (const ch of s) {
    const up = ch.toLocaleUpperCase(LOCALE);
    const lo = ch.toLocaleLowerCase(LOCALE);
    if (ch === up && ch !== lo) out += lo;
    else if (ch === lo && ch !== up) out += up;
    else out += ch;
  }
  return out;
}

function applyMode(value: string, mode: CaseMode): string {
  switch (mode) {
    case "sentence": return transformSentenceCase(value);
    case "lower": return transformLower(value);
    case "upper": return transformUpper(value);
    case "title": return transformTitleCase(value);
    case "toggle": return transformToggle(value);
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: any[];
  kits: any[];
  customFieldLabels: (string | null)[];
  campaignId: string;
}

const BASE_COLUMNS: { value: string; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "category", label: "Localização na Loja" },
  { value: "sub_location", label: "Sub-localização" },
  { value: "size", label: "Medidas" },
  { value: "store_category", label: "Modelo de Loja" },
  { value: "specification", label: "Especificação" },
  { value: "installation_instructions", label: "Instruções de Instalação" },
];

export default function ChangeCaseDialog({
  open, onOpenChange, pieces, kits, customFieldLabels, campaignId,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<CaseMode>("sentence");
  const [column, setColumn] = useState<string>("name");
  const [alsoKits, setAlsoKits] = useState(false);
  const [applying, setApplying] = useState(false);

  const columns = useMemo(() => {
    const custom = customFieldLabels
      .map((label, idx) => ({ label, value: `custom_field_${idx + 1}` }))
      .filter((c) => !!c.label)
      .map((c) => ({ value: c.value, label: c.label as string }));
    return [...BASE_COLUMNS, ...custom];
  }, [customFieldLabels]);

  const previews = useMemo(() => {
    const samples = pieces
      .filter((p) => {
        const v = p?.[column];
        return typeof v === "string" && v.trim() !== "";
      })
      .slice(0, 3)
      .map((p) => {
        const v = String(p[column]);
        return { before: v, after: applyMode(v, mode) };
      });
    return samples;
  }, [pieces, column, mode]);

  const snapshotRef = useRef<{ pieces: Record<string, string>; kits: Record<string, string> } | null>(null);

  const restore = async (snap: { pieces: Record<string, string>; kits: Record<string, string> }) => {
    const toastId = toast.loading("Desfazendo alterações...");
    try {
      const pIds = Object.keys(snap.pieces);
      let done = 0;
      for (const id of pIds) {
        await supabase.from("campaign_pieces").update({ [column]: snap.pieces[id] }).eq("id", id);
        done++;
        if (done % 5 === 0) toast.loading(`Desfazendo ${done}/${pIds.length}...`, { id: toastId });
      }
      const kIds = Object.keys(snap.kits);
      for (const id of kIds) {
        await supabase.from("campaign_kits").update({ name: snap.kits[id] }).eq("id", id);
      }
      await qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
      await qc.invalidateQueries({ queryKey: ["campaign_kits"] });
      toast.success("Alterações desfeitas", { id: toastId });
    } catch (e: any) {
      toast.error(`Erro ao desfazer: ${e?.message || e}`, { id: toastId });
    }
  };

  const handleApply = async () => {
    const targetPieces = pieces.filter((p) => {
      const v = p?.[column];
      return typeof v === "string" && v.trim() !== "" && applyMode(v, mode) !== v;
    });
    const targetKits = column === "name" && alsoKits
      ? kits.filter((k) => typeof k?.name === "string" && k.name.trim() !== "" && applyMode(k.name, mode) !== k.name)
      : [];

    const total = targetPieces.length + targetKits.length;
    if (total === 0) {
      toast.info("Nada para alterar nesta coluna.");
      return;
    }

    setApplying(true);
    const toastId = toast.loading(`Aplicando 0/${total}...`);
    const snap: { pieces: Record<string, string>; kits: Record<string, string> } = { pieces: {}, kits: {} };

    try {
      let done = 0;
      for (const p of targetPieces) {
        snap.pieces[p.id] = String(p[column]);
        const newVal = applyMode(String(p[column]), mode);
        const { error } = await supabase.from("campaign_pieces").update({ [column]: newVal }).eq("id", p.id);
        if (error) throw error;
        done++;
        if (done % 3 === 0 || done === total) toast.loading(`Aplicando ${done}/${total}...`, { id: toastId });
      }
      for (const k of targetKits) {
        snap.kits[k.id] = String(k.name);
        const newVal = applyMode(String(k.name), mode);
        const { error } = await supabase.from("campaign_kits").update({ name: newVal }).eq("id", k.id);
        if (error) throw error;
        done++;
        if (done % 3 === 0 || done === total) toast.loading(`Aplicando ${done}/${total}...`, { id: toastId });
      }
      snapshotRef.current = snap;
      await qc.invalidateQueries({ queryKey: ["campaign_pieces", campaignId] });
      await qc.invalidateQueries({ queryKey: ["campaign_kits"] });
      toast.success(`${total} ${total === 1 ? "item alterado" : "itens alterados"}`, {
        id: toastId,
        duration: 10000,
        action: {
          label: "Desfazer",
          onClick: () => restore(snap),
        },
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Erro ao aplicar: ${e?.message || e}`, { id: toastId });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Maiúsculas e Minúsculas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de caixa</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as CaseMode)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="sentence" id="cc-sentence" />
                <Label htmlFor="cc-sentence" className="font-normal cursor-pointer">Primeira letra da sentença em maiúscula</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="lower" id="cc-lower" />
                <Label htmlFor="cc-lower" className="font-normal cursor-pointer">minúscula</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="upper" id="cc-upper" />
                <Label htmlFor="cc-upper" className="font-normal cursor-pointer">MAIÚSCULAS</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="title" id="cc-title" />
                <Label htmlFor="cc-title" className="font-normal cursor-pointer">Colocar Cada Palavra em Maiúscula</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="toggle" id="cc-toggle" />
                <Label htmlFor="cc-toggle" className="font-normal cursor-pointer">aLTERNAR mAIÚSC./mINÚSC.</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Aplicar à coluna</Label>
            <Select value={column} onValueChange={setColumn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {column === "name" && (
            <div className="flex items-center gap-2">
              <Checkbox id="cc-kits" checked={alsoKits} onCheckedChange={(v) => setAlsoKits(v === true)} />
              <Label htmlFor="cc-kits" className="font-normal cursor-pointer">Aplicar também aos nomes dos kits</Label>
            </div>
          )}

          <div className="space-y-2">
            <Label>Prévia</Label>
            <div className="bg-muted rounded-md p-3 text-sm space-y-1 min-h-[60px]">
              {previews.length === 0 ? (
                <span className="text-muted-foreground">Nenhum valor não vazio nessa coluna.</span>
              ) : (
                previews.map((p, i) => (
                  <div key={i} className="truncate">
                    <span className="text-muted-foreground">{p.before}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">{p.after}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Cancelar</Button>
          <Button onClick={handleApply} disabled={applying}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
