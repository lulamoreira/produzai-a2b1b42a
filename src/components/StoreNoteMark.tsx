import { AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StoreNoteMarkProps {
  /** Texto da nota da loja; sem nota, nada é exibido. */
  note: string | null | undefined;
  storeName?: string;
  className?: string;
}

/**
 * Ícone âmbar ao lado do nome de uma loja que tem observação (somente leitura).
 * Passar o mouse mostra o texto (title); clicar/tocar abre um popover com a nota completa.
 */
export function StoreNoteMark({ note, storeName, className }: StoreNoteMarkProps) {
  if (!note) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Nota da loja: ${note}`}
          aria-label={storeName ? `Ver nota da loja ${storeName}` : "Ver nota da loja"}
          // Dentro de listas clicáveis: abrir a nota não aciona a linha.
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex h-3.5 w-3.5 shrink-0 translate-y-[1px] items-center justify-center rounded-full border border-warning/50 bg-warning/15 text-warning align-baseline",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
        >
          <AlertCircle className="h-2.5 w-2.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="z-[80] w-72 max-w-[calc(100vw-2rem)] max-h-[min(50vh,var(--radix-popover-content-available-height))] overflow-y-auto space-y-1 p-3"
        onClick={(e) => e.stopPropagation()}
        // O bloqueio de rolagem do Dialog de trás cancela roda/toque no popover portado.
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <AlertCircle className="h-3.5 w-3.5 text-warning" aria-hidden /> Nota da loja{storeName ? ` · ${storeName}` : ""}
        </p>
        <p className="whitespace-pre-wrap break-words text-xs text-foreground">{note}</p>
      </PopoverContent>
    </Popover>
  );
}
