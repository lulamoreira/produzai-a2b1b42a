import { useState } from "react";
import { FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { ReportData } from "@/lib/exportExecutiveReport";

interface Props {
  campaignId: string;
  clientId: string;
  campaignName: string;
  clientName: string;
}

async function fetchReportData(campaignId: string, clientId: string, campaignName: string, clientName: string): Promise<ReportData> {
  const [storesRes, schedulesRes, occurrencesRes, photosRes] = await Promise.all([
    supabase
      .from("client_stores")
      .select("id, name, city, state, store_model")
      .eq("client_id", clientId),
    supabase
      .from("campaign_schedules")
      .select("store_id, scheduled_date, completed_at, checkin_timestamp, photo_checkin")
      .eq("campaign_id", campaignId),
    supabase
      .from("occurrences")
      .select("store_id, status, priority, description, created_at, resolved_date, motive_id")
      .eq("campaign_id", campaignId),
    supabase
      .from("installation_photos")
      .select("store_id, category")
      .eq("campaign_id", campaignId),
  ]);

  if (storesRes.error) throw storesRes.error;
  if (schedulesRes.error) throw schedulesRes.error;
  if (occurrencesRes.error) throw occurrencesRes.error;
  if (photosRes.error) throw photosRes.error;

  // Fetch motive descriptions for occurrences that have a motive_id
  const motiveIds = [...new Set((occurrencesRes.data || []).filter((o) => o.motive_id).map((o) => o.motive_id!))];
  let motiveMap: Record<string, string> = {};
  if (motiveIds.length > 0) {
    const { data: motives } = await supabase
      .from("occurrence_motives")
      .select("id, description")
      .in("id", motiveIds);
    (motives || []).forEach((m) => { motiveMap[m.id] = m.description; });
  }

  return {
    campaignName,
    clientName,
    stores: storesRes.data || [],
    schedules: (schedulesRes.data || []).map((s) => ({
      store_id: s.store_id,
      scheduled_date: s.scheduled_date,
      completed_at: s.completed_at,
      checkin_timestamp: s.checkin_timestamp,
      photo_checkin: s.photo_checkin,
    })),
    occurrences: (occurrencesRes.data || []).map((o) => ({
      store_id: o.store_id,
      status: o.status,
      priority: o.priority,
      description: o.description,
      created_at: o.created_at,
      resolved_date: o.resolved_date,
      motive_description: o.motive_id ? motiveMap[o.motive_id] || "" : "",
    })),
    photos: (photosRes.data || []).map((p) => ({
      store_id: p.store_id,
      category: p.category,
    })),
  };
}

export default function ExportReportDropdown({ campaignId, clientId, campaignName, clientName }: Props) {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleExport = async (format: "excel" | "pdf") => {
    setLoading(true);
    const toastId = toast.loading(format === "excel" ? "Gerando relatório Excel…" : "Gerando relatório PDF…");
    try {
      const data = await fetchReportData(campaignId, clientId, campaignName, clientName);
      if (format === "excel") {
        const { exportExecutiveExcel } = await import("@/lib/exportExecutiveReport");
        exportExecutiveExcel(data);
      } else {
        const { exportExecutivePDF } = await import("@/lib/exportExecutiveReport");
        exportExecutivePDF(data);
      }
      toast.success("Relatório exportado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar relatório", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={loading}>
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {t("Exportar Relatório")}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" />
          Relatório Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4" />
          Relatório PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
