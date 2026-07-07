import { FileText, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Briefing, BriefingStatus } from "@/hooks/useBriefing";

interface Props {
  briefing: Briefing | undefined;
  canEditStatus: boolean;
  onStatusChange: (s: BriefingStatus) => void;
  onDeadlineChange: (d: string | null) => void;
}

const STATUS_META: Record<BriefingStatus, { label: string; className: string }> = {
  draft:     { label: "Rascunho",  className: "bg-stone-200 text-stone-700" },
  in_review: { label: "Em revisão", className: "bg-amber-100 text-amber-800" },
  approved:  { label: "Aprovado",   className: "bg-emerald-100 text-emerald-800" },
};

const BriefingHeader = ({ briefing, canEditStatus, onStatusChange, onDeadlineChange }: Props) => {
  const status = briefing?.status ?? "draft";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Briefing da Campanha</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Documento colaborativo com objetivo, público, referências, vídeo-brief e notas.
            </p>
          </div>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            {canEditStatus ? (
              <Select value={status} onValueChange={(v) => onStatusChange(v as BriefingStatus)}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="in_review">Em revisão</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={STATUS_META[status].className}>{STATUS_META[status].label}</Badge>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Prazo
            </Label>
            <Input
              type="date"
              className="h-9 w-40"
              value={briefing?.deadline ?? ""}
              onChange={(e) => onDeadlineChange(e.target.value || null)}
              disabled={!canEditStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BriefingHeader;
