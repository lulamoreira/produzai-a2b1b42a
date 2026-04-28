import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/compressImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Upload, Trash2, FileText, Image, File, Download, Pencil, Check, X, ExternalLink, Video, Share2 } from "lucide-react";

interface SupportMaterial {
  id: string;
  campaign_id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  display_order: number;
  share_with_supplier: boolean;
  created_at: string;
}

interface Props {
  campaignId: string;
  canEdit: boolean;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="w-4 h-4" />;
  if (fileType.startsWith("image/")) return <Image className="w-4 h-4" />;
  if (fileType.startsWith("video/")) return <Video className="w-4 h-4" />;
  if (fileType === "application/pdf") return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
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

  const toggleShare = useMutation({
    mutationFn: async ({ id, share }: { id: string; share: boolean }) => {
      const { error } = await supabase
        .from("campaign_support_materials")
        .update({ share_with_supplier: share } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["campaign_support_materials", campaignId] });
      toast.success(v.share ? "Compartilhado com o fornecedor" : "Removido do compartilhamento");
    },
    onError: (e: any) => toast.error("Erro ao atualizar: " + e.message),
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

  return (
    <div className="mb-6">
      <div
        className="overflow-hidden"
        style={{
          background: "var(--bg-surface, #fff)",
          borderRadius: "var(--radius-card, 12px)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.07))",
          }}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("supportMaterials.title")}
            </span>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => addCard.mutate()}
              disabled={addCard.isPending}
              className="gap-1.5 h-7 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("common.add")}
            </Button>
          )}
        </div>

        {/* File list */}
        {materials.length === 0 ? (
          <div className="px-5 py-8 text-center" style={{ color: "var(--text-muted)" }}>
            <File className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("supportMaterials.noFile", "Nenhum material adicionado")}</p>
          </div>
        ) : (
          <div>
            {materials.map((mat) => {
              const isEditing = editingId === mat.id;
              const isUploading = uploadingId === mat.id;

              return (
                <div
                  key={mat.id}
                  className="flex items-center gap-3 transition-colors"
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.07))",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-muted, #EDE8E0)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* File type icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--bg-muted, #EDE8E0)", color: "var(--text-secondary)" }}
                  >
                    {getFileIcon(mat.file_type)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex gap-1.5 items-center">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={t("supportMaterials.materialTitle")}
                          className="h-7 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") updateTitle.mutate({ id: mat.id, title: editTitle });
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => updateTitle.mutate({ id: mat.id, title: editTitle })}
                          className="p-1 rounded hover:bg-accent"
                        >
                          <Check className="w-3.5 h-3.5" style={{ color: "var(--s-success)" }} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-accent">
                          <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`${canEdit ? "cursor-pointer group" : ""}`}
                        onClick={() => {
                          if (canEdit) { setEditingId(mat.id); setEditTitle(mat.title); }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[13px] font-medium truncate"
                            style={{ color: mat.title ? "var(--text-primary)" : "var(--text-muted)" }}
                          >
                            {mat.title || mat.file_name || (
                              <span className="italic">{t("supportMaterials.clickToSetTitle")}</span>
                            )}
                          </span>
                          {canEdit && (
                            <Pencil
                              className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              style={{ color: "var(--text-muted)" }}
                            />
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {mat.file_name
                            ? `${mat.file_name} · ${new Date(mat.created_at).toLocaleDateString("pt-BR")}`
                            : t("supportMaterials.noFile", "Sem arquivo")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {mat.file_url ? (
                      <>
                        <a
                          href={mat.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md transition-colors hover:bg-accent"
                          title={t("supportMaterials.openFile")}
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={mat.file_url}
                          download={mat.file_name || "arquivo"}
                          className="p-1.5 rounded-md transition-colors hover:bg-accent"
                          title={t("common.download")}
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; }}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </>
                    ) : canEdit ? (
                      <div className="relative">
                        <input
                          type="file"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(mat.id, f); e.target.value = ""; }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isUploading}
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Upload className="w-3 h-3" />
                          {isUploading ? t("common.sending") : t("supportMaterials.sendFile")}
                        </Button>
                      </div>
                    ) : null}

                    {canEdit && mat.file_url && (
                      <button
                        onClick={() => toggleShare.mutate({ id: mat.id, share: !mat.share_with_supplier })}
                        className="p-1.5 rounded-md transition-colors hover:bg-accent"
                        title={mat.share_with_supplier ? "Compartilhado com fornecedor (clique para remover)" : "Compartilhar com fornecedor de orçamento"}
                        style={{ color: mat.share_with_supplier ? "var(--brand, #8C6F4E)" : "var(--text-muted)" }}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        onClick={() => deleteCard.mutate(mat.id)}
                        className="p-1.5 rounded-md transition-colors hover:bg-accent"
                        title={t("supportMaterials.deleteCard")}
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--s-danger)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportMaterialsSection;
