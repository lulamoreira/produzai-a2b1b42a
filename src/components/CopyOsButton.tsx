import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface CopyOsButtonProps {
  /** Valor da OS a ser copiado. Quando vazio, o botão fica desabilitado. */
  value?: string | null;
  className?: string;
  title?: string;
}

/**
 * Botão compacto para copiar o número da OS para a área de transferência.
 * Usa fallback via execCommand quando a Clipboard API não está disponível
 * (ex.: contextos não seguros em alguns navegadores mobile).
 */
const CopyOsButton = ({ value, className, title = "Copiar OS" }: CopyOsButtonProps) => {
  const [copied, setCopied] = useState(false);
  const text = (value ?? "").trim();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    try {
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
      toast.success("OS copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar OS:", err);
      toast.error("Não foi possível copiar a OS");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!text}
      onClick={handleCopy}
      title={title}
      aria-label={title}
      className={`h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground ${className ?? ""}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
};

export default CopyOsButton;
