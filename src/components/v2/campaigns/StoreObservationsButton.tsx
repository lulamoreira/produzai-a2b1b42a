import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StoreObservationsButton({ store, canEdit }: { store: any; canEdit?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(store?.observations ?? "");
  const [saving, setSaving] = useState(false);
  const has = !!(store?.observations && String(store.observations).trim());
  // Quando não tem observação e não pode editar, não mostra nada (nada a ver).
  if (!has && !canEdit) return null;
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("client_stores").update({ observations: value.trim() || null }).eq("id", store.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar observação: " + error.message); return; }
    store.observations = value.trim() || null; // reflete de imediato no objeto da linha
    qc.invalidateQueries({ queryKey: ["client_stores"] });
    toast.success("Observação salva.");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(store?.observations ?? ""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={has ? "Observações da loja" : "Adicionar observação"}
          aria-label="Observações da loja"
          className={cn(
            "shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full border transition-colors",
            has ? "bg-amber-100 text-amber-700 border-amber-300" : "text-stone-300 border-stone-200 opacity-50 hover:opacity-100"
          )}
        >
          <AlertCircle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-semibold text-stone-700">Observações da loja</div>
        {canEdit ? (
          <>
            <Textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: teto baixo; tem 2 promotables..." className="text-sm" />
            <Button size="sm" className="w-full" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </>
        ) : (
          <p className="text-sm text-stone-600 whitespace-pre-wrap">{store?.observations || "Sem observações."}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
