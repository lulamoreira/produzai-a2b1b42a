import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Pencil, Save, X, CalendarIcon, CheckCircle, Trash2, Clock, FileText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateReinstallReason } from "@/hooks/useCampaignSchedules";
import type { Schedule } from "@/types/schedule";

interface Props {
  reinstall: Schedule & { reinstall_seq?: number; reinstall_reason?: string | null };
  campaignId: string;
  storeName: string;
  canEdit: boolean;
  isAdminOrMaster: boolean;
}

const TEAM_NONE = "__none__";

export default function ReinstallCard({ reinstall, campaignId, storeName, canEdit, isAdminOrMaster }: Props) {
  const qc = useQueryClient();
  const updateReason = useUpdateReinstallReason();
  const seq = (reinstall as any).reinstall_seq ?? 0;
  const reason = (reinstall as any).reinstall_reason ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reason);
  const [dateOpen, setDateOpen] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ["installation_teams", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_teams")
        .select("id, name")
        .eq("campaign_id", campaignId)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const isCompleted = !!reinstall.completed_at;
  const scheduledDate = reinstall.scheduled_date
    ? new Date(reinstall.scheduled_date + "T12:00:00")
    : undefined;

  const editAllowed = canEdit && (!reinstall.locked || isAdminOrMaster);

  const persist = async (patch: Record<string, any>, successMsg: string) => {
    const { error } = await supabase
      .from("campaign_schedules")
      .update(patch as any)
      .eq("id", reinstall.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    qc.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
    toast.success(successMsg);
    return true;
  };

  const handleSaveReason = async () => {
    await updateReason.mutateAsync({
      installationId: reinstall.id,
      campaignId,
      reason: draft.trim(),
    });
    setEditing(false);
  };

  const handleSetDate = async (d: Date | undefined) => {
    setDateOpen(false);
    await persist({ scheduled_date: d ? format(d, "yyyy-MM-dd") : null }, "Data atualizada");
  };

  const handleSetTime = async (v: string) => {
    await persist({ scheduled_time: v || null }, "Horário atualizado");
  };

  const handleSetOs = async (v: string) => {
    await persist({ installation_os: v.trim() || null }, "OS atualizada");
  };

  const handleSetTeam = async (v: string) => {
    await persist({ team_id: v === TEAM_NONE ? null : v }, "Equipe atualizada");
  };

  const handleToggleComplete = async () => {
    await persist(
      { completed_at: isCompleted ? null : new Date().toISOString() },
      isCompleted ? "Marcada como pendente" : "Reinstalação concluída"
    );
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir reinstalação #${seq} de ${storeName}?`)) return;
    const { error } = await supabase.from("campaign_schedules").delete().eq("id", reinstall.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["campaign_schedules", campaignId] });
    toast.success("Reinstalação excluída");
  };

  return (
    <div
      className={cn(
        "card-base overflow-hidden flex flex-col ml-0 md:ml-4 relative",
        "border-t-4 border-t-amber-400"
      )}
      style={{ padding: 0 }}
    >
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 gap-1">
              <RefreshCw className="w-3 h-3" />
              Reinstalação #{seq}
            </Badge>
            {isCompleted ? (
              <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 border-0 gap-1">
                <CheckCircle className="w-3 h-3" /> Concluída
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Pendente</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {editAllowed && !isCompleted && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleToggleComplete}>
                <CheckCircle className="w-3 h-3" /> Marcar concluída
              </Button>
            )}
            {editAllowed && isCompleted && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleToggleComplete}>
                Desfazer
              </Button>
            )}
            {isAdminOrMaster && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive hover:text-destructive"
                onClick={handleDelete}
                title="Excluir reinstalação"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Editable fields grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {/* Date */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground shrink-0">Data:</span>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" disabled={!editAllowed} className="h-7 px-2 text-xs flex-1 justify-start">
                  {scheduledDate
                    ? format(scheduledDate, "dd/MM/yyyy", { locale: ptBR })
                    : "Definir"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={handleSetDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground shrink-0">Horário:</span>
            <Input
              type="time"
              defaultValue={reinstall.scheduled_time ?? ""}
              disabled={!editAllowed}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (reinstall.scheduled_time ?? "")) handleSetTime(v);
              }}
              className="h-7 px-2 text-xs flex-1"
            />
          </div>

          {/* OS */}
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground shrink-0">OS:</span>
            <Input
              type="text"
              placeholder="Nº OS"
              defaultValue={reinstall.installation_os ?? ""}
              disabled={!editAllowed}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (reinstall.installation_os ?? "")) handleSetOs(v);
              }}
              className="h-7 px-2 text-xs flex-1"
            />
          </div>

          {/* Team */}
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground shrink-0">Equipe:</span>
            <Select
              value={reinstall.team_id ?? TEAM_NONE}
              onValueChange={handleSetTeam}
              disabled={!editAllowed}
            >
              <SelectTrigger className="h-7 px-2 text-xs flex-1 min-w-0 [&>span]:truncate [&>span]:block [&>span]:max-w-full">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TEAM_NONE}>— Sem equipe —</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reason — editable inline */}
        <div className="text-xs">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-medium text-foreground">Motivo:</span>
            {!editing && editAllowed && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => {
                  setDraft(reason);
                  setEditing(true);
                }}
                title="Editar motivo"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={handleSaveReason}
                  disabled={updateReason.isPending || !draft.trim()}
                >
                  <Save className="w-3 h-3" /> Salvar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setEditing(false)}
                >
                  <X className="w-3 h-3" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="italic text-muted-foreground whitespace-pre-wrap">
              {reason || "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
