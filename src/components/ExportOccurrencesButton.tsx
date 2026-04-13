import { useState } from "react";
import { FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { OccurrenceReportData } from "@/lib/exportOccurrencesReport";

interface Props {
  data: OccurrenceReportData;
}

export default function ExportOccurrencesButton({ data }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: "excel" | "pdf") => {
    setLoading(true);
    const toastId = toast.loading(format === "excel" ? "Gerando relatório Excel…" : "Gerando relatório PDF…");
    try {
      if (format === "excel") {
        const { exportOccurrencesExcel } = await import("@/lib/exportOccurrencesReport");
        await exportOccurrencesExcel(data);
      } else {
        const { exportOccurrencesPDF } = await import("@/lib/exportOccurrencesReport");
        exportOccurrencesPDF(data);
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
          Exportar Ocorrências
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
