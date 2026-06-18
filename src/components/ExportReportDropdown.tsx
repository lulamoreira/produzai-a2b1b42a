import { useState, useRef } from "react";
import { FileSpreadsheet, FileText, ChevronDown, Presentation, Upload, History, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import type { ReportData } from "@/lib/exportExecutiveReport";
import { useCampaign, useUpdateCampaign } from "@/hooks/useMultiClientData";


interface Props {
  campaignId: string;
  clientId: string;
  campaignName: string;
  clientName: string;
  pieces?: any[];
  kits?: any[];
  kitPieces?: any[];
  agencyName?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

async function fetchReportData(campaignId: string, clientId: string, campaignName: string, clientName: string): Promise<ReportData> {
  const [stores, schedules, occurrences, photos] = await Promise.all([
    supabasePaginate<{ id: string; name: string; city: string | null; state: string | null; store_model: string | null }>(
      (from, to) =>
        supabase
          .from("client_stores")
          .select("id, name, city, state, store_model")
          .eq("client_id", clientId)
          .range(from, to) as any
    ),
    supabasePaginate<{ store_id: string; scheduled_date: string | null; completed_at: string | null; checkin_timestamp: string | null; photo_checkin: boolean | null }>(
      (from, to) =>
        supabase
          .from("campaign_schedules")
          .select("store_id, scheduled_date, completed_at, checkin_timestamp, photo_checkin")
          .eq("campaign_id", campaignId)
          .range(from, to) as any
    ),
    supabasePaginate<{ store_id: string | null; status: string | null; priority: string | null; description: string | null; created_at: string | null; resolved_date: string | null; motive_id: string | null }>(
      (from, to) =>
        supabase
          .from("occurrences")
          .select("store_id, status, priority, description, created_at, resolved_date, motive_id")
          .eq("campaign_id", campaignId)
          .range(from, to) as any
    ),
    supabasePaginate<{ store_id: string | null; category: string | null }>(
      (from, to) =>
        supabase
          .from("installation_photos")
          .select("store_id, category")
          .eq("campaign_id", campaignId)
          .range(from, to) as any
    ),
  ]);

  const motiveIds = [...new Set(occurrences.filter((o) => o.motive_id).map((o) => o.motive_id!))];
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
    stores,
    schedules: schedules.map((s) => ({
      store_id: s.store_id,
      scheduled_date: s.scheduled_date,
      completed_at: s.completed_at,
      checkin_timestamp: s.checkin_timestamp,
      photo_checkin: s.photo_checkin,
    })),
    occurrences: occurrences.map((o) => ({
      store_id: o.store_id,
      status: o.status,
      priority: o.priority,
      description: o.description,
      created_at: o.created_at,
      resolved_date: o.resolved_date,
      motive_description: o.motive_id ? motiveMap[o.motive_id] || "" : "",
    })),
    photos: photos.map((p) => ({
      store_id: p.store_id,
      category: p.category,
    })),
  };
}

export default function ExportReportDropdown({ 
  campaignId, 
  clientId, 
  campaignName, 
  clientName, 
  pieces = [], 
  kits = [],
  kitPieces = [],
  agencyName = "",
  isOpen,
  onOpenChange,
  trigger
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pptDialogOpen, setPptDialogOpen] = useState(false);
  const [catalogProgress, setCatalogProgress] = useState<{ open: boolean; current: number; total: number; label: string; title?: string }>({
    open: false, current: 0, total: 0, label: "",
  });



  const { t } = useTranslation();
  const { data: campaign } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();

  const customFieldLabels: Array<string | null> = [
    (campaign as any)?.piece_custom_field_1_label ?? null,
    (campaign as any)?.piece_custom_field_2_label ?? null,
    (campaign as any)?.piece_custom_field_3_label ?? null,
    (campaign as any)?.piece_custom_field_4_label ?? null,
    (campaign as any)?.piece_custom_field_5_label ?? null,
  ];

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

  const handlePPTExportWithImage = async (imageUrl?: string) => {
    setPptDialogOpen(false);
    setLoading(true);
    setCatalogProgress({ open: true, current: 0, total: 0, label: "Preparando dados...", title: "Gerando Apresentacao PPT" });
    const toastId = toast.loading("Gerando apresentação PPT...");
    try {
      const piecesData = pieces.map(p => {
        const sizeParts = (p.size || "").split(" x ");
        return {
          id: p.id,
          name: p.name,
          description: p.specification,
          width: sizeParts[0] ? Number(sizeParts[0]) || undefined : undefined,
          height: sizeParts[1] ? Number(sizeParts[1]) || undefined : undefined,
          material: undefined,
          quantity: undefined,
          code: String(p.code ?? ""),
          observations: p.installation_instructions || undefined,
          status: undefined,
          photo_url: p.image_url || undefined,
        };
      });

      const kitsData = kits.map(k => {
        const kpForKit = kitPieces.filter((kp: any) => kp.kit_id === k.id);
        const kitPieceDetails = kpForKit
          .map((kp: any) => pieces.find(p => p.id === kp.piece_id))
          .filter(Boolean);
        return {
          id: k.id,
          name: k.name,
          description: undefined,
          pieces_count: kpForKit.length,
          code: String(k.code ?? ""),
          observations: undefined,
          photo_url: k.image_url || undefined,
          pieces: kitPieceDetails.map((p: any) => ({
            name: p.name,
            photo_url: p.image_url || undefined,
          })),
        };
      });

      const { exportCampaignPPT } = await import("@/lib/exportCampaignPPT");
      await exportCampaignPPT({
        campaign: {
          name: campaignName,
          client_name: clientName,
          agency_name: agencyName,
          cover_image_url: imageUrl
        },
        pieces: piecesData,
        kits: kitsData,
        onProgress: (current, total, label) => {
          setCatalogProgress({ open: true, current, total, label, title: "Gerando Apresentacao PPT" });
        },
      });
      toast.success("PPT exportado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("PPT Export error:", err);
      toast.error("Erro ao exportar PPT", { id: toastId });
    } finally {
      setLoading(false);
      setTimeout(() => setCatalogProgress(p => ({ ...p, open: false })), 600);
    }
  };


  const handleCatalogPDFExport = async () => {
    setLoading(true);
    setCatalogProgress({ open: true, current: 0, total: 0, label: "Preparando dados...", title: "Gerando Catalogo PDF" });
    const toastId = toast.loading("Gerando catalogo PDF com imagens...");
    try {
      const piecesData = pieces.map((p: any) => ({
        id: p.id,
        name: p.name,
        code: String(p.code ?? ""),
        size: p.size || undefined,
        category: p.category || undefined,
        sub_location: p.sub_location || undefined,
        specification: p.specification || undefined,
        installation_instructions: p.installation_instructions || undefined,
        custom_field_1: p.custom_field_1 ?? null,
        custom_field_2: p.custom_field_2 ?? null,
        custom_field_3: p.custom_field_3 ?? null,
        custom_field_4: p.custom_field_4 ?? null,
        custom_field_5: p.custom_field_5 ?? null,
        photo_url: p.image_url || undefined,
        is_new: p.is_new ?? false,
      }));

      const kitsData = kits.map(k => {
        const kpForKit = kitPieces.filter((kp: any) => kp.kit_id === k.id);
        const kitPieceDetails = kpForKit
          .map((kp: any) => pieces.find(p => p.id === kp.piece_id))
          .filter(Boolean);
        return {
          id: k.id,
          name: k.name,
          code: String(k.code ?? ""),
          pieces: kitPieceDetails.map((p: any) => ({ name: p.name })),
        };
      });

      const { exportPiecesCatalogPDF } = await import("@/lib/exportPiecesCatalogPDF");
      await exportPiecesCatalogPDF({
        campaign: {
          name: campaignName,
          client_name: clientName,
          agency_name: agencyName,
          cover_image_url: campaign?.cover_images?.[0]?.url,
        },
        pieces: piecesData,
        kits: kitsData,
        customFieldLabels,
        onProgress: (current, total, label) => {
          setCatalogProgress({ open: true, current, total, label, title: "Gerando Catalogo PDF" });
        },
      });
      toast.success("Catalogo PDF exportado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("PDF Catalog Export error:", err);
      toast.error("Erro ao exportar catalogo PDF", { id: toastId });
    } finally {
      setLoading(false);
      setTimeout(() => setCatalogProgress(p => ({ ...p, open: false })), 600);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


    const toastId = toast.loading("Enviando imagem de capa...");
    try {
      // Create a unique path for the file
      const fileExt = file.name.split('.').pop();
      const fileName = `${campaignId}_cover_${Date.now()}.${fileExt}`;
      const filePath = `ppt_covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('campaign-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-assets')
        .getPublicUrl(filePath);

      // Update campaign history
      const currentHistory = campaign?.cover_images || [];
      const newHistory = [
        { url: publicUrl, timestamp: new Date().toISOString() },
        ...currentHistory
      ].slice(0, 3);

      await updateCampaign.mutateAsync({
        id: campaignId,
        cover_images: newHistory as any
      });

      toast.success("Capa atualizada!", { id: toastId });
      handlePPTExportWithImage(publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar imagem", { id: toastId });
    }
  };

  const dropdownTrigger = trigger || (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={loading}>
      <FileSpreadsheet className="w-3.5 h-3.5" />
      {t("Exportar Relatório")}
      <ChevronDown className="w-3 h-3 opacity-60" />
    </Button>
  );

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          {dropdownTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" />
            Relatorio Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
            <FileText className="w-4 h-4" />
            Relatorio PDF (.pdf)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2">Catalogo de Pecas</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleCatalogPDFExport} className="gap-2 cursor-pointer">
            <FileText className="w-4 h-4" />
            Catalogo PDF com Imagens (.pdf)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPptDialogOpen(true)} className="gap-2 cursor-pointer">
            <Presentation className="w-4 h-4" />
            Catalogo PPT com Imagens (.pptx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pptDialogOpen} onOpenChange={setPptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Apresentação PPT</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <label className="w-full">
                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 flex flex-col items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Nova imagem de capa</p>
                    <p className="text-xs text-muted-foreground">Clique para selecionar</p>
                  </div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              
              <div className="text-center">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ou use uma anterior</span>
              </div>
            </div>

            {campaign?.cover_images && campaign.cover_images.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {campaign.cover_images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePPTExportWithImage(img.url)}
                    className="group relative aspect-video rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img src={img.url} alt={`Capa ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Presentation className="w-5 h-5 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-muted/30 rounded-lg border border-dashed">
                <History className="w-5 h-5 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">Nenhum histórico de capas disponível</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={() => handlePPTExportWithImage()} className="text-xs">
              Exportar sem capa personalizada
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPptDialogOpen(false)} className="text-xs">
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catalogProgress.open} onOpenChange={(o) => { if (!o && !loading) setCatalogProgress(p => ({ ...p, open: false })); }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{catalogProgress.title || "Gerando arquivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Progress value={catalogProgress.total > 0 ? (catalogProgress.current / catalogProgress.total) * 100 : 0} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{catalogProgress.label}</span>
              <span className="font-mono shrink-0">
                {catalogProgress.total > 0
                  ? `${Math.round((catalogProgress.current / catalogProgress.total) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Nao feche esta janela ate o download iniciar.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
