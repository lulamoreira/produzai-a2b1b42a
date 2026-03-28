import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Clock, CalendarDays, Save } from "lucide-react";
import { toast } from "sonner";

interface AccessWindowConfigProps {
  campaignId: string;
}

export default function AccessWindowConfig({ campaignId }: AccessWindowConfigProps) {
  const queryClient = useQueryClient();

  const { data: campaign } = useQuery({
    queryKey: ["campaign_access_config", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("access_hours_before, access_hours_after, access_ignore_time, access_days_before, access_days_after, access_ignore_date")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [hoursBefore, setHoursBefore] = useState(2);
  const [hoursAfter, setHoursAfter] = useState(24);
  const [ignoreTime, setIgnoreTime] = useState(false);
  const [daysBefore, setDaysBefore] = useState(0);
  const [daysAfter, setDaysAfter] = useState(0);
  const [ignoreDate, setIgnoreDate] = useState(false);

  useEffect(() => {
    if (campaign) {
      setHoursBefore(campaign.access_hours_before ?? 2);
      setHoursAfter(campaign.access_hours_after ?? 24);
      setIgnoreTime(campaign.access_ignore_time ?? false);
      setDaysBefore(campaign.access_days_before ?? 0);
      setDaysAfter(campaign.access_days_after ?? 0);
      setIgnoreDate(campaign.access_ignore_date ?? false);
    }
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({
          access_hours_before: hoursBefore,
          access_hours_after: hoursAfter,
          access_ignore_time: ignoreTime,
          access_days_before: daysBefore,
          access_days_after: daysAfter,
          access_ignore_date: ignoreDate,
        })
        .eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_access_config", campaignId] });
      toast.success("Configurações de acesso salvas!");
    },
    onError: () => toast.error("Erro ao salvar configurações"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Janela de Acesso Temporário</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure quanto tempo antes e depois do agendamento o instalador pode acessar o sistema.
      </p>

      {/* Time config */}
      <div className="aqua-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Horário</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ignore-time" className="text-xs text-muted-foreground">Ignorar horário</Label>
            <Switch
              id="ignore-time"
              checked={ignoreTime}
              onCheckedChange={setIgnoreTime}
            />
          </div>
        </div>

        {!ignoreTime && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Horas antes</Label>
              <Input
                type="number"
                min={0}
                max={72}
                value={hoursBefore}
                onChange={(e) => setHoursBefore(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-card border-border"
              />
              <p className="text-[10px] text-muted-foreground">Liberar acesso X horas antes</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Horas depois</Label>
              <Input
                type="number"
                min={0}
                max={168}
                value={hoursAfter}
                onChange={(e) => setHoursAfter(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-card border-border"
              />
              <p className="text-[10px] text-muted-foreground">Expirar acesso X horas depois</p>
            </div>
          </div>
        )}

        {ignoreTime && (
          <p className="text-xs text-muted-foreground italic">
            O horário agendado não será considerado para liberar/expirar o acesso.
          </p>
        )}
      </div>

      {/* Date config */}
      <div className="aqua-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Data</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ignore-date" className="text-xs text-muted-foreground">Ignorar data</Label>
            <Switch
              id="ignore-date"
              checked={ignoreDate}
              onCheckedChange={setIgnoreDate}
            />
          </div>
        </div>

        {!ignoreDate && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dias antes</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={daysBefore}
                onChange={(e) => setDaysBefore(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-card border-border"
              />
              <p className="text-[10px] text-muted-foreground">Liberar X dias antes da data</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dias depois</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={daysAfter}
                onChange={(e) => setDaysAfter(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-card border-border"
              />
              <p className="text-[10px] text-muted-foreground">Manter acesso X dias depois</p>
            </div>
          </div>
        )}

        {ignoreDate && (
          <p className="text-xs text-muted-foreground italic">
            A data agendada não será considerada — o acesso ficará liberado independente do dia.
          </p>
        )}
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        size="sm"
        className="gap-1.5"
      >
        <Save className="w-3.5 h-3.5" />
        {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
