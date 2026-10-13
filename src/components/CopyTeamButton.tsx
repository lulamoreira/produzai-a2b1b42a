import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildTeamClipboardText, type TeamClipboardData } from "@/lib/exportTeamDetail";

export interface CopyTeamButtonProps extends TeamClipboardData {
  className?: string;
  title?: string;
}

/**
 * Botão compacto que copia a equipe exibida (instaladores, documentos,
 * telefones e veículos) para a área de transferência.
 * Usa a Clipboard API com fallback via execCommand quando ela não está
 * disponível (contextos não seguros em alguns navegadores mobile).
 */
const CopyTeamButton = ({ className, title = "Copiar esta equipe", ...data }: CopyTeamButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = buildTeamClipboardText(data);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Equipe copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar equipe:", err);
      toast.error("Não foi possível copiar a equipe");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      title={title}
      aria-label={title}
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-600" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
};

export default CopyTeamButton;
