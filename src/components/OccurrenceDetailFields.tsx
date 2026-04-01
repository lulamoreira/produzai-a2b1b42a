import { useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Occurrence,
  useUpdateOccurrenceFields,
  useOccurrenceComments,
  useAddOccurrenceComment,
} from "@/hooks/useOccurrences";
import type { CampaignPiece } from "@/hooks/useMultiClientData";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import DebouncedInput from "@/components/DebouncedInput";
import DebouncedTextarea from "@/components/DebouncedTextarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MapPin, Wrench, RotateCcw, FileText, Building2, CalendarClock, CalendarCheck,
  MessageSquare, ImagePlus, Send, ChevronUp, ChevronDown, CalendarIcon, User, Phone, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import PhotoLightbox from "./PhotoLightbox";

interface Props {
  occ: Occurrence;
  campaignId: string;
  pieceLocations: { id: string; name: string }[];
  canEdit: boolean;
  canEditReporter?: boolean;
}

const OccurrenceDetailFields = ({ occ, campaignId, pieceLocations, canEdit, canEditReporter = false }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const updateFields = useUpdateOccurrenceFields();
  const { data: comments = [] } = useOccurrenceComments(occ.id);
  const addComment = useAddOccurrenceComment();

  // Local state for actions_taken scrolling
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [reporterOpen, setReporterOpen] = useState(false);
  const [reporterEditing, setReporterEditing] = useState(false);

  // Comment input
  const [commentText, setCommentText] = useState("");

  // Profile for display name
  const { data: profile } = useQuery({
    queryKey: ["my_profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Resolution photos
  const { data: resolutionPhotos = [] } = useQuery({
    queryKey: ["occurrence_resolution_photos", occ.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("occurrence_photos")
        .select("*")
        .eq("occurrence_id", occ.id)
        .eq("category", "resolution");
      if (error) throw error;
      return data as { id: string; photo_url: string }[];
    },
  });

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFieldUpdate = (field: string, value: unknown) => {
    if (!canEdit) return;
    updateFields.mutate({ id: occ.id, campaignId, [field]: value });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const files = Array.from(e.target.files || []);
    const currentCount = resolutionPhotos.length;
    if (currentCount + files.length > 3) {
      toast.error("Máximo de 3 fotos de resolução.");
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const compressed = await compressImage(file, 1200, 0.7);
        const fileName = `${occ.id}/resolution_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("occurrence-images")
          .upload(fileName, compressed, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("occurrence-images").getPublicUrl(fileName);
        await supabase.from("occurrence_photos").insert({
          occurrence_id: occ.id,
          photo_url: urlData.publicUrl,
          category: "resolution",
        });
      }
      qc.invalidateQueries({ queryKey: ["occurrence_resolution_photos", occ.id] });
      toast.success("Foto(s) enviada(s)!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddComment = () => {
    if (!commentText.trim() || !user || !profile?.display_name) return;
    addComment.mutate({
      occurrenceId: occ.id,
      userId: user.id,
      displayName: profile.display_name,
      content: commentText.trim(),
    }, {
      onSuccess: () => setCommentText(""),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border/50">
      {/* 0 - Dados do Lojista */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors"
          onClick={() => setReporterOpen(!reporterOpen)}
        >
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3" /> Dados do Lojista
          </span>
          {reporterOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {reporterOpen && (
          <div className="p-3 space-y-2 bg-card">
            {canEditReporter && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 px-2"
                  onClick={() => setReporterEditing(!reporterEditing)}
                >
                  <Pencil className="w-3 h-3" />
                  {reporterEditing ? "Concluir" : "Editar"}
                </Button>
              </div>
            )}
            {/* Nome */}
            <div>
              <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                <User className="w-3 h-3" /> Nome
              </label>
              {reporterEditing ? (
                <DebouncedInput
                  className="h-7 text-xs"
                  value={occ.reporter_name || ""}
                  onValueCommit={(v) => handleFieldUpdate("reporter_name", v)}
                  placeholder="Nome do lojista..."
                />
              ) : (
                <span className="text-xs font-medium">{occ.reporter_name || "—"}</span>
              )}
            </div>
            {/* Telefone */}
            <div>
              <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                <Phone className="w-3 h-3" /> WhatsApp
              </label>
              {reporterEditing ? (
                <div className="flex gap-1.5">
                  <DebouncedInput
                    className="h-7 text-xs w-16"
                    value={occ.reporter_phone_ddd || ""}
                    onValueCommit={(v) => handleFieldUpdate("reporter_phone_ddd", v)}
                    placeholder="DDD"
                    maxLength={2}
                  />
                  <DebouncedInput
                    className="h-7 text-xs flex-1"
                    value={occ.reporter_phone_number || ""}
                    onValueCommit={(v) => handleFieldUpdate("reporter_phone_number", v)}
                    placeholder="Número"
                  />
                </div>
              ) : (
                <span className="text-xs font-medium">
                  {occ.reporter_phone_ddd && occ.reporter_phone_number
                    ? `(${occ.reporter_phone_ddd}) ${occ.reporter_phone_number}`
                    : "—"}
                </span>
              )}
            </div>
            {/* Email */}
            <div>
              <label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                <Mail className="w-3 h-3" /> E-mail da Loja
              </label>
              {reporterEditing ? (
                <DebouncedInput
                  className="h-7 text-xs"
                  value={occ.reporter_email || ""}
                  onValueCommit={(v) => handleFieldUpdate("reporter_email", v)}
                  placeholder="email@loja.com"
                />
              ) : (
                <span className="text-xs font-medium">{occ.reporter_email || "—"}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1 - Localização na Loja */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3" /> Localização na Loja
        </label>
        <span className="text-xs">{occ.location_in_store || "—"}</span>
      </div>

      {/* 2 - Ações Tomadas */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Wrench className="w-3 h-3" /> Ações Tomadas
        </label>
        {canEdit ? (
          <DebouncedTextarea
            className="text-xs min-h-[3.5rem] max-h-[5rem] resize-none"
            rows={3}
            value={occ.actions_taken || ""}
            onValueCommit={(v) => handleFieldUpdate("actions_taken", v)}
            placeholder="Descreva as ações tomadas..."
          />
        ) : (
          <div className="relative">
            <p className={cn("text-xs text-muted-foreground whitespace-pre-wrap", !actionsExpanded && "line-clamp-3")}>
              {occ.actions_taken || "—"}
            </p>
            {(occ.actions_taken?.length || 0) > 150 && (
              <Button variant="ghost" size="sm" className="h-5 text-[10px] p-0 mt-0.5" onClick={() => setActionsExpanded(!actionsExpanded)}>
                {actionsExpanded ? <><ChevronUp className="w-3 h-3 mr-0.5" /> Menos</> : <><ChevronDown className="w-3 h-3 mr-0.5" /> Mais</>}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 3 - Precisa de Reinstalação */}
      <div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={!!occ.needs_reinstallation}
            onCheckedChange={(checked) => {
              if (!canEdit) return;
              handleFieldUpdate("needs_reinstallation", !!checked);
              if (!checked) {
                handleFieldUpdate("reinstallation_os", null);
                handleFieldUpdate("reinstallation_datetime", null);
              }
            }}
            disabled={!canEdit}
          />
          <label className="text-xs font-semibold flex items-center gap-1">
            <RotateCcw className="w-3 h-3 text-warning" /> Precisa de Reinstalação
          </label>
        </div>

        {/* 4 - Campos condicionais de reinstalação */}
        {occ.needs_reinstallation && (
          <div className="ml-6 mt-2 space-y-2 pl-2 border-l-2 border-warning/30">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Nova OS para Reinstalação</label>
              {canEdit ? (
                <Input
                  className="h-7 text-xs"
                  value={occ.reinstallation_os || ""}
                  onChange={(e) => handleFieldUpdate("reinstallation_os", e.target.value)}
                  placeholder="Número da OS..."
                />
              ) : (
                <span className="text-xs">{occ.reinstallation_os || "—"}</span>
              )}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">Data e Hora da Reinstalação</label>
              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-7 text-xs w-full justify-start">
                      <CalendarIcon className="w-3 h-3 mr-1.5" />
                      {occ.reinstallation_datetime
                        ? format(new Date(occ.reinstallation_datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "Selecione data e hora"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={occ.reinstallation_datetime ? new Date(occ.reinstallation_datetime) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const existing = occ.reinstallation_datetime ? new Date(occ.reinstallation_datetime) : new Date();
                          date.setHours(existing.getHours(), existing.getMinutes());
                          handleFieldUpdate("reinstallation_datetime", date.toISOString());
                        }
                      }}
                      className="p-3 pointer-events-auto"
                    />
                    <div className="p-3 border-t flex gap-2 items-center">
                      <label className="text-xs text-muted-foreground">Hora:</label>
                      <Input
                        type="time"
                        className="h-7 text-xs w-auto"
                        value={occ.reinstallation_datetime ? format(new Date(occ.reinstallation_datetime), "HH:mm") : ""}
                        onChange={(e) => {
                          const [h, m] = e.target.value.split(":").map(Number);
                          const d = occ.reinstallation_datetime ? new Date(occ.reinstallation_datetime) : new Date();
                          d.setHours(h, m);
                          handleFieldUpdate("reinstallation_datetime", d.toISOString());
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="text-xs">
                  {occ.reinstallation_datetime
                    ? format(new Date(occ.reinstallation_datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "—"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5 - Observação da Agência */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Building2 className="w-3 h-3" /> Observação da Agência
        </label>
        {canEdit ? (
          <Textarea
            className="text-xs min-h-[2rem] max-h-[4rem] resize-none"
            rows={2}
            value={occ.agency_observation || ""}
            onChange={(e) => handleFieldUpdate("agency_observation", e.target.value)}
            placeholder="Observação da agência..."
          />
        ) : (
          <span className="text-xs text-muted-foreground">{occ.agency_observation || "—"}</span>
        )}
      </div>

      {/* 6 - Resolução Prevista */}
      <div className="bg-warning/10 rounded-lg p-2 border border-warning/20">
        <label className="text-[10px] font-bold text-warning uppercase tracking-wider flex items-center gap-1 mb-1">
          <CalendarClock className="w-3 h-3" /> Resolução prevista para:
        </label>
        {canEdit ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 text-xs w-full justify-start">
                <CalendarIcon className="w-3 h-3 mr-1.5" />
                {occ.expected_resolution_date
                  ? format(new Date(occ.expected_resolution_date), "dd/MM/yyyy", { locale: ptBR })
                  : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={occ.expected_resolution_date ? new Date(occ.expected_resolution_date) : undefined}
                onSelect={(date) => handleFieldUpdate("expected_resolution_date", date ? format(date, "yyyy-MM-dd") : null)}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span className="text-xs font-semibold">
            {occ.expected_resolution_date
              ? format(new Date(occ.expected_resolution_date), "dd/MM/yyyy", { locale: ptBR })
              : "—"}
          </span>
        )}
      </div>

      {/* 7 - Resolvido dia */}
      <div className="bg-success/10 rounded-lg p-2 border border-success/20">
        <label className="text-[10px] font-bold text-success uppercase tracking-wider flex items-center gap-1 mb-1">
          <CalendarCheck className="w-3 h-3" /> Resolvido dia:
        </label>
        {canEdit ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-7 text-xs w-full justify-start">
                <CalendarIcon className="w-3 h-3 mr-1.5" />
                {occ.resolved_date
                  ? format(new Date(occ.resolved_date), "dd/MM/yyyy", { locale: ptBR })
                  : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={occ.resolved_date ? new Date(occ.resolved_date) : undefined}
                onSelect={(date) => handleFieldUpdate("resolved_date", date ? format(date, "yyyy-MM-dd") : null)}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        ) : (
          <span className="text-xs font-semibold">
            {occ.resolved_date
              ? format(new Date(occ.resolved_date), "dd/MM/yyyy", { locale: ptBR })
              : "—"}
          </span>
        )}
      </div>

      {/* 8 - Observações (Chat) */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <MessageSquare className="w-3 h-3" /> Observações
        </label>
        <div className="bg-muted/30 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1.5">
          {comments.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">Nenhuma observação ainda.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="font-semibold text-primary">{c.user_display_name}:</span>{" "}
              <span className="text-foreground">{c.content}</span>
              <span className="text-[9px] text-muted-foreground ml-1.5">
                {format(new Date(c.created_at), "dd/MM HH:mm")}
              </span>
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1.5 mt-1.5">
            <Input
              className="h-7 text-xs flex-1"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escreva uma observação..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddComment())}
            />
            <Button size="sm" className="h-7 px-2" onClick={handleAddComment} disabled={!commentText.trim() || addComment.isPending}>
              <Send className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* 9 - Fotos de Resolução */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <ImagePlus className="w-3 h-3" /> Fotos da Resolução / Problema
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {resolutionPhotos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="w-16 h-16 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all flex-shrink-0"
              onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
            >
              <img src={p.photo_url} alt={`Resolução ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
          {canEdit && resolutionPhotos.length < 3 && (
            <button
              type="button"
              className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <ImagePlus className="w-5 h-5" />
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
      </div>

      <PhotoLightbox
        photos={resolutionPhotos.map((p) => p.photo_url)}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
};

export default OccurrenceDetailFields;
