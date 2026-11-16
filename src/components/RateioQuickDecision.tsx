import { useState } from "react";
import { Check, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TaCertoButtonProps {
  /** Grava a justificativa "só este caso" com o motivo automático; devolve true quando gravou. */
  onConfirm: () => Promise<boolean>;
}

/** "TÁ CERTO": um clique, sem popover (o Justificar continua para motivo próprio/todas as lojas). */
export function TaCertoButton({ onConfirm }: TaCertoButtonProps) {
  const [saving, setSaving] = useState(false);
  const click = async () => {
    if (saving) return;
    setSaving(true);
    try { await onConfirm(); } finally { setSaving(false); }
  };
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1 mt-1 border-success/60 text-success hover:bg-success/10 hover:text-success"
      onClick={click}
      disabled={saving}
      title="Marcar só este caso como certo"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Tá certo
    </Button>
  );
}

/** "TÁ ERRADO": abre a janela de correção (só para quem pode editar o rateio). */
export function TaErradoButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1 mt-1 border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={onClick}
      title="Abrir a correção deste apontamento"
    >
      <Wrench className="w-3.5 h-3.5" /> Tá errado
    </Button>
  );
}
