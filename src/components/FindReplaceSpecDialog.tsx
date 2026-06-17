import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface FindReplaceSpecDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: any[];
  updatePiece: any;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function FindReplaceSpecDialog({
  open,
  onOpenChange,
  pieces,
  updatePiece,
}: FindReplaceSpecDialogProps) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [includeSpec, setIncludeSpec] = useState(true);
  const [includeInstall, setIncludeInstall] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) {
      setFind(""); setReplace(""); setCaseSensitive(false);
      setIncludeSpec(true); setIncludeInstall(false); setApplying(false);
    }
  }, [open]);

  const regex = useMemo(() => {
    if (!find) return null;
    try {
      return new RegExp(escapeRegExp(find), caseSensitive ? "g" : "gi");
    } catch {
      return null;
    }
  }, [find, caseSensitive]);

  const { matchCount, affectedPieces } = useMemo(() => {
    if (!regex) return { matchCount: 0, affectedPieces: [] as any[] };
    let total = 0;
    const affected: any[] = [];
    for (const p of pieces || []) {
      let pieceMatches = 0;
      if (includeSpec && p.specification) {
        const m = String(p.specification).match(regex);
        if (m) pieceMatches += m.length;
      }
      if (includeInstall && p.installation_instructions) {
        const m = String(p.installation_instructions).match(regex);
        if (m) pieceMatches += m.length;
      }
      if (pieceMatches > 0) {
        total += pieceMatches;
        affected.push(p);
      }
    }
    return { matchCount: total, affectedPieces: affected };
  }, [regex, pieces, includeSpec, includeInstall]);

  const handleReplaceAll = async () => {
    if (!regex || !updatePiece?.mutateAsync) return;
    if (!includeSpec && !includeInstall) {
      toast.error("Selecione ao menos um campo.");
      return;
    }
    setApplying(true);
    let okCount = 0;
    let errCount = 0;
    for (const p of affectedPieces) {
      const updates: any = { id: p.id };
      if (includeSpec && p.specification) {
        updates.specification = String(p.specification).replace(regex, replace);
      }
      if (includeInstall && p.installation_instructions) {
        updates.installation_instructions = String(p.installation_instructions).replace(regex, replace);
      }
      try {
        await updatePiece.mutateAsync(updates);
        okCount++;
      } catch (e) {
        errCount++;
      }
    }
    setApplying(false);
    if (errCount === 0) {
      toast.success(`${matchCount} ocorrência(s) substituída(s) em ${okCount} peça(s).`);
      onOpenChange(false);
    } else {
      toast.error(`${okCount} peça(s) atualizada(s), ${errCount} falha(s).`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Search className="w-4 h-4" /> Localizar e Substituir
          </DialogTitle>
          <DialogDescription>
            Busca e substitui texto nos campos de especificação das peças desta campanha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Localizar</Label>
            <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Texto a localizar" autoFocus />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Substituir por</Label>
            <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Novo texto (deixe vazio para remover)" />
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground">Campos</Label>
            <div className="flex items-center gap-2">
              <Checkbox id="fr-spec" checked={includeSpec} onCheckedChange={(v) => setIncludeSpec(!!v)} />
              <label htmlFor="fr-spec" className="text-sm cursor-pointer">Especificação</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="fr-install" checked={includeInstall} onCheckedChange={(v) => setIncludeInstall(!!v)} />
              <label htmlFor="fr-install" className="text-sm cursor-pointer">Instruções de Instalação</label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox id="fr-case" checked={caseSensitive} onCheckedChange={(v) => setCaseSensitive(!!v)} />
              <label htmlFor="fr-case" className="text-sm cursor-pointer">Diferenciar maiúsculas/minúsculas</label>
            </div>
          </div>

          {find && (
            <div className="text-sm rounded-md border bg-muted/30 px-3 py-2">
              {matchCount > 0
                ? <><strong>{matchCount}</strong> ocorrência(s) em <strong>{affectedPieces.length}</strong> peça(s).</>
                : <span className="text-muted-foreground">Nenhuma ocorrência encontrada.</span>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Cancelar</Button>
          <Button onClick={handleReplaceAll} disabled={applying || !find || matchCount === 0}>
            {applying ? "Substituindo..." : "Substituir tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
