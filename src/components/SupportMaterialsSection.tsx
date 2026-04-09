import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/compressImage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Upload, Trash2, FileText, Image, File, Download, Pencil, Check, X, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const CARD_GRADIENTS = [
  "from-primary/15 to-primary/5 border-primary/25",
  "from-secondary/15 to-secondary/5 border-secondary/25",
  "from-accent/15 to-accent/5 border-accent/25",
];

const ICON_GRADIENTS = [
  "gradient-primary",
  "gradient-secondary",
  "gradient-accent",
];

interface SupportMaterial {
  id: string;
  campaign_id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  display_order: number;
  created_at: string;
}

interface Props {
  campaignId: string;
  canEdit: boolean;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="w-5 h-5" />;
  if (fileType.startsWith("image/")) return <Image className="w-5 h-5" />;
  if (fileType === "application/pdf") return <FileText className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
}

const SupportMaterialsSection = ({ campaignId, canEdit }: Props) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: materials = [] } = useQuery<SupportMaterial[]>({
    queryKey: ["campaign_support_materials", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_support_materials")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (materials.length === 0 && canEdit && !initialized) {
      setInitialized(true);
      const init = async () => {
        const { data: existing } = await supabase
          .from("campaign_support_materials")
          .select("id")
          .eq("campaign_id", campaignId)
          .limit(1);
        if (existing && existing.length > 0) return;
        const inserts = [0, 1, 2].map((i) => ({
          campaign_id: campaignId,
          title: "",
          display_order: i,
        }));
        const { error } = await supabase.from("campaign_support_materials").insert(inserts);
        if (!error) queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] });
      };
      init();
    }
  }, [materials.length, canEdit, campaignId, queryClient, initialized]);

  const addCard = useMutation({
    mutationFn: async () => {
      const maxOrder = materials.length > 0 ? Math.max(...materials.map((m) => m.display_order)) : -1;
      const { error } = await supabase.from("campaign_support_materials").insert({
        campaign_id: campaignId,
        title: "",
        display_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] }),
    onError: (e: any) => toast.error(t("supportMaterials.errorAddCard") + ": " + e.message),
  });

  const updateTitle = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("campaign_support_materials").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(t("supportMaterials.errorSaveTitle") + ": " + e.message),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_support_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] }),
    onError: (e: any) => toast.error(t("supportMaterials.errorRemove") + ": " + e.message),
  });

  const handleFileUpload = async (materialId: string, file: globalThis.File) => {
    setUploadingId(materialId);
    try {
      let uploadBlob: Blob = file;
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        uploadBlob = await compressImage(file, 1600, 0.8);
      }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${campaignId}/${materialId}-${Date.now()}.${ext}`;
      const contentType = isImage ? "image/jpeg" : file.type;
      const { error: uploadError } = await supabase.storage
        .from("support-materials")
        .upload(path, uploadBlob, { upsert: true, contentType });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("support-materials").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("campaign_support_materials")
        .update({ file_url: urlData.publicUrl, file_name: file.name, file_type: file.type })
        .eq("id", materialId);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] });
      toast.success(t("supportMaterials.fileSent"));
    } catch (err: any) {
      toast.error(t("supportMaterials.errorUpload") + ": " + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const removeFile = async (materialId: string) => {
    const { error } = await supabase
      .from("campaign_support_materials")
      .update({ file_url: null, file_name: null, file_type: null })
      .eq("id", materialId);
    if (!error) queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] });
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between mb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground font-display">{t("supportMaterials.title")}</h2>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => addCard.mutate()} disabled={addCard.isPending} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {t("common.add")}
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map((mat, idx) => {
              const gradientClass = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
              const iconGradient = ICON_GRADIENTS[idx % ICON_GRADIENTS.length];
              const isEditing = editingId === mat.id;
              const isUploading = uploadingId === mat.id;
              const isImageFile = mat.file_type?.startsWith("image/");

              return (
                <Card key={mat.id} className={`bg-gradient-to-br ${gradientClass} border overflow-hidden transition-all hover:shadow-md`}>
                  <div className="relative h-36 flex items-center justify-center bg-background/30">
                    {mat.file_url ? (
                      isImageFile ? (
                        <img src={mat.file_url} alt={mat.title || "Material"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-12 h-12 rounded-xl ${iconGradient} flex items-center justify-center text-white`}>
                            {getFileIcon(mat.file_type)}
                          </div>
                          <span className="text-xs text-muted-foreground max-w-[80%] truncate">{mat.file_name}</span>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                        <div className={`w-12 h-12 rounded-xl ${iconGradient} flex items-center justify-center text-white/70`}>
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs">{t("supportMaterials.noFile")}</span>
                      </div>
                    )}

                    {canEdit && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        {mat.file_url && (
                          <>
                            <a href={mat.file_url} target="_blank" rel="noopener noreferrer"
                              className="w-7 h-7 rounded-md bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                              title={t("supportMaterials.openFile")}>
                              <ExternalLink className="w-3.5 h-3.5 text-foreground" />
                            </a>
                            <a href={mat.file_url} download={mat.file_name || "arquivo"}
                              className="w-7 h-7 rounded-md bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors"
                              title={t("common.download")}>
                              <Download className="w-3.5 h-3.5 text-foreground" />
                            </a>
                            <button onClick={() => removeFile(mat.id)}
                              className="w-7 h-7 rounded-md bg-destructive/80 backdrop-blur flex items-center justify-center hover:bg-destructive transition-colors"
                              title={t("supportMaterials.removeFile")}>
                              <X className="w-3.5 h-3.5 text-white" />
                            </button>
                          </>
                        )}
                        <button onClick={() => deleteCard.mutate(mat.id)}
                          className="w-7 h-7 rounded-md bg-destructive/80 backdrop-blur flex items-center justify-center hover:bg-destructive transition-colors"
                          title={t("supportMaterials.deleteCard")}>
                          <Trash2 className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    {isEditing ? (
                      <div className="flex gap-1.5">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={t("supportMaterials.materialTitle")} className="h-8 text-sm" autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateTitle.mutate({ id: mat.id, title: editTitle });
                            if (e.key === "Escape") setEditingId(null);
                          }} />
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => updateTitle.mutate({ id: mat.id, title: editTitle })}>
                          <Check className="w-3.5 h-3.5 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className={`flex items-center gap-2 ${canEdit ? "cursor-pointer group" : ""}`}
                        onClick={() => { if (canEdit) { setEditingId(mat.id); setEditTitle(mat.title); } }}>
                        <h3 className="font-semibold text-sm text-foreground truncate flex-1">
                          {mat.title || (
                            <span className="text-muted-foreground italic">{t("supportMaterials.clickToSetTitle")}</span>
                          )}
                        </h3>
                        {canEdit && <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                      </div>
                    )}

                    {canEdit && (
                      <div className="relative">
                        <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(mat.id, f); e.target.value = ""; }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading} />
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-background/40">
                          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {isUploading ? t("common.sending") : t("supportMaterials.sendFile")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default SupportMaterialsSection;