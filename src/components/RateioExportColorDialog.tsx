import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Check } from "lucide-react";

export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  light: string;
}

const PRESETS: ColorPalette[] = [
  { name: "Azul oceano",   primary: "#1A3A5C", secondary: "#2E6DA4", light: "#D6E8F7" },
  { name: "Verde musgo",   primary: "#1A3A2A", secondary: "#2E6B45", light: "#D4EDE0" },
  { name: "Terracota",     primary: "#5C2A1A", secondary: "#A04030", light: "#F5DDD8" },
  { name: "Roxo profundo", primary: "#2A1A5C", secondary: "#5040A0", light: "#E0DCF5" },
  { name: "Grafite",       primary: "#1C1C1C", secondary: "#444444", light: "#E8E8E8" },
  { name: "Dourado",       primary: "#5C3D00", secondary: "#A06800", light: "#F5E8C0" },
  { name: "Teal",          primary: "#0A3A3A", secondary: "#1A6B6B", light: "#C8EDED" },
  { name: "Marrom brand",  primary: "#3D2E1E", secondary: "#8C6F4E", light: "#F0E9DC" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (palette: ColorPalette) => void;
}

export default function RateioExportColorDialog({ open, onOpenChange, onExport }: Props) {
  const [selected, setSelected] = useState<ColorPalette>(PRESETS[0]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Exportar Rateio</DialogTitle>
          <DialogDescription>
            Escolha a paleta de cores da planilha antes de exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 my-1">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg border-2 transition-colors relative ${
                selected.name === p.name
                  ? "border-primary"
                  : "border-transparent hover:border-border"
              } bg-card`}
              onClick={() => setSelected(p)}
            >
              <div className="w-full h-7 rounded-md overflow-hidden flex">
                <div style={{ background: p.primary, flex: 1 }} />
                <div style={{ background: p.secondary, flex: 1 }} />
                <div style={{ background: p.light, flex: 1 }} />
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {p.name}
              </span>
              {selected.name === p.name && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-lg overflow-hidden border border-border text-[11px]">
          <div className="px-2.5 py-1.5 font-bold text-white" style={{ background: selected.primary }}>
            NOME DA PEÇA / KIT
          </div>
          <div className="px-2.5 py-1 text-white text-[10px]" style={{ background: selected.secondary }}>
            CÓDIGO · LOCAL · TAMANHO
          </div>
          <div className="px-2.5 py-1 text-muted-foreground" style={{ background: selected.light }}>
            Nome da Loja · Santiago · 1
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onExport(selected)} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
