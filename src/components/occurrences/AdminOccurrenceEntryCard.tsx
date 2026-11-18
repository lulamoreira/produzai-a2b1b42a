import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StorePortalPhotoUpload from "@/components/StorePortal/StorePortalPhotoUpload";
import { AdminPecaPicker } from "./AdminPecaPicker";
import type { AdminOccurrenceEntry } from "./adminOccurrenceSubmit";
import type { PecaOption } from "@/lib/adminOccurrence";

export interface AdminOccurrenceEntryCardProps {
  index: number;
  entry: AdminOccurrenceEntry;
  options: PecaOption[];
  motivos: Array<{ id: string; descricao: string }>;
  showPriority: boolean;
  canRemove: boolean;
  disabled: boolean;
  uploading: boolean;
  photoPath: string;
  onChange: (patch: Partial<AdminOccurrenceEntry>) => void;
  onRemove: () => void;
  onUploadingChange: (v: boolean) => void;
}

/** Uma ocorrência dentro do diálogo: peça, motivo, descrição, prioridade e fotos (como no portal). */
export function AdminOccurrenceEntryCard(p: AdminOccurrenceEntryCardProps) {
  const { entry } = p;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Ocorrência {p.index + 1}</p>
        {p.canRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={p.onRemove} disabled={p.disabled}>
            <Trash2 className="h-4 w-4 mr-1" /> Remover
          </Button>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Peça *</label>
        {p.options.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-2">
            Esta campanha ainda não tem peças cadastradas no Loja a Loja.
          </p>
        ) : (
          <AdminPecaPicker options={p.options} value={entry.pecaId} onChange={(pecaId) => p.onChange({ pecaId })} disabled={p.disabled} />
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Motivo *</label>
        <Select value={entry.motiveId || undefined} onValueChange={(motiveId) => p.onChange({ motiveId })} disabled={p.disabled}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {p.motivos.map((m) => <SelectItem key={m.id} value={m.id}>{m.descricao}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-xs font-medium text-foreground mb-1 block">Descrição (não obrigatório)</label>
        <Textarea value={entry.description} onChange={(e) => p.onChange({ description: e.target.value })}
          placeholder="Descreva o problema encontrado..." className="min-h-[70px]" disabled={p.disabled} />
      </div>

      {p.showPriority && (
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">Prioridade</label>
          <Select value={entry.priority} onValueChange={(priority) => p.onChange({ priority })} disabled={p.disabled}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <StorePortalPhotoUpload
        photos={entry.photos}
        onPhotosChange={(photos) => p.onChange({ photos })}
        uploading={p.uploading}
        onUploadingChange={p.onUploadingChange}
        bucketPath={p.photoPath}
      />
    </div>
  );
}
