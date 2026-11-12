import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { findCodeConflicts, parseItemCode, type CodedItem } from "@/lib/itemCodeConflicts";
import { useCodeConflictConfirm } from "@/hooks/useCodeConflictConfirm";
import { CodeConflictHint } from "./CodeConflictHint";

export interface KitCodeEditorProps {
  kitId: string;
  campaignId: string;
  code: number;
  pieces: CodedItem[];
  kits: CodedItem[];
  canEdit: boolean;
  onSave: (code: number) => Promise<unknown>;
}

/**
 * Selo do código do kit; quando editável, um clique abre o campo para trocar
 * o número. Avisa (e pede confirmação) se o número já existir na campanha.
 */
export function KitCodeEditor({ kitId, campaignId, code, pieces, kits, canEdit, onSave }: KitCodeEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState<number | null>(null);
  const { confirmCode, dialog } = useCodeConflictConfirm();

  // Mostra o código recém-salvo até a lista da tela recarregar.
  const displayCode = savedCode ?? code;
  const parsed = parseItemCode(value);
  const invalid = value.trim() !== "" && parsed === null;
  const conflicts = parsed !== null && parsed !== displayCode
    ? findCodeConflicts(parsed, { pieces, kits }, { kitId })
    : [];

  const cancel = () => { setEditing(false); setValue(""); };

  const save = async () => {
    if (parsed === null) {
      toast.error("Código inválido. Use um número inteiro maior que zero.");
      return;
    }
    if (parsed === displayCode) { cancel(); return; }
    setSaving(true);
    try {
      const ok = await confirmCode(campaignId, parsed, { kitId }, conflicts);
      if (!ok) return;
      await onSave(parsed);
      setSavedCode(parsed);
      setEditing(false);
      toast.success(`Código do kit alterado para ${parsed}.`);
    } catch (err) {
      console.error("Falha ao salvar código do kit:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <>
        {dialog}
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => { setValue(String(displayCode)); setEditing(true); }}
          title={canEdit ? "Clique para mudar o código do kit" : undefined}
          aria-label={canEdit ? `Mudar código do kit (atual ${displayCode})` : `Código do kit ${displayCode}`}
          className={cn(
            "text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded",
            canEdit && "hover:bg-primary/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {displayCode}
        </button>
      </>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      {dialog}
      <span className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          autoFocus
          aria-label="Novo código do kit"
          aria-invalid={invalid || conflicts.length > 0}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void save(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
          }}
          className="h-7 w-20 text-xs"
        />
        <Button type="button" size="icon" className="h-7 w-7" onClick={() => void save()} disabled={saving} aria-label="Salvar código">
          <Check className="w-3 h-3" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={cancel} disabled={saving} aria-label="Cancelar">
          <X className="w-3 h-3" />
        </Button>
      </span>
      <CodeConflictHint conflicts={conflicts} invalid={invalid} className="max-w-xs font-normal" />
    </span>
  );
}
