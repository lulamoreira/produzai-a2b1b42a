import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAddCampaignPiece, useUpdateCampaignPiece } from "@/hooks/useMultiClientData";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compressImage";
import { Plus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AddPieceDialogProps {
  existingPieces: any[];
  customFieldLabels?: (string | null)[];
  campaignId?: string;
  clientId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialPiece?: any;
  addPieceMutation?: any;
  updatePieceMutation?: any;
}

const AddPieceDialog = ({ 
  existingPieces, 
  customFieldLabels, 
  campaignId, 
  clientId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialPiece,
  addPieceMutation,
  updatePieceMutation
}: AddPieceDialogProps) => {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  const [form, setForm] = useState({ 
    code: "", 
    category: "", 
    name: "", 
    width: "",
    height: "",
    length: "",
    image_url: "", 
    specification: t("pieces.videManual"), 
    installation_instructions: t("pieces.noSpecificInfo"),
    custom_field_1: "",
    custom_field_2: "",
    custom_field_3: "",
    custom_field_4: "",
    custom_field_5: "",
    kit_only: false,
    is_new: false,
    store_category: "",
  });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const addCampaignPiece = useAddCampaignPiece();
  const updateCampaignPiece = useUpdateCampaignPiece();
  
  const addPieceAction = addPieceMutation || addCampaignPiece;
  const updatePieceAction = updatePieceMutation || updateCampaignPiece;

  useEffect(() => {
    if (initialPiece) {
      const [w, h, l] = (initialPiece.size || "").split(/[x×]/i).map((s: string) => s.trim());
      setForm({
        code: String(initialPiece.code || ""),
        category: initialPiece.category || "",
        name: initialPiece.name || "",
        width: w || "",
        height: h || "",
        length: l || "",
        image_url: initialPiece.image_url || "",
        specification: initialPiece.specification || t("pieces.videManual"),
        installation_instructions: initialPiece.installation_instructions || t("pieces.noSpecificInfo"),
        custom_field_1: initialPiece.custom_field_1 || "",
        custom_field_2: initialPiece.custom_field_2 || "",
        custom_field_3: initialPiece.custom_field_3 || "",
        custom_field_4: initialPiece.custom_field_4 || "",
        custom_field_5: initialPiece.custom_field_5 || "",
        kit_only: initialPiece.kit_only ?? false,
        is_new: initialPiece.is_new ?? false,
        store_category: initialPiece.store_category || "",
      });
      setPreviewUrl(initialPiece.image_url || null);
    } else {
      setForm({ 
        code: "", 
        category: "", 
        name: "", 
        width: "",
        height: "",
        length: "",
        image_url: "", 
        specification: t("pieces.videManual"), 
        installation_instructions: t("pieces.noSpecificInfo"),
        custom_field_1: "",
        custom_field_2: "",
        custom_field_3: "",
        custom_field_4: "",
        custom_field_5: "",
        kit_only: false,
        is_new: false,
        store_category: "",
      });
      setPreviewUrl(null);
    }
  }, [initialPiece, open, t]);

  const maxCode = Array.isArray(existingPieces) 
    ? existingPieces.reduce((max, p) => Math.max(max, Number(p.code) || 0), 0) 
    : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file, 800, 0.6);
      const path = `piece-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("piece-images")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("piece-images").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
      setPreviewUrl(urlData.publicUrl);
      toast.success(t("imageUpload.uploadSuccess"));
    } catch (err: any) {
      toast.error(t("imageUpload.uploadError", { message: err.message }));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setForm((f) => ({ ...f, image_url: "" }));
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.width || !form.height) {
      toast.error("Largura e Altura são obrigatórios.");
      return;
    }

    const size = [form.width, form.height, form.length]
      .map(v => v?.trim())
      .filter(Boolean)
      .join("×");

    const pieceData = {
      code: Number(form.code) || (maxCode + 1),
      category: form.category.toUpperCase(),
      name: form.name,
      size: size,
      image_url: form.image_url || null,
      specification: form.specification,
      installation_instructions: form.installation_instructions,
      campaign_id: campaignId as string,
      custom_field_1: form.custom_field_1 || null,
      custom_field_2: form.custom_field_2 || null,
      custom_field_3: form.custom_field_3 || null,
      custom_field_4: form.custom_field_4 || null,
      custom_field_5: form.custom_field_5 || null,
      store_category: form.store_category || null,
    };

    try {
      if (initialPiece) {
        await updatePieceAction.mutateAsync({
          id: initialPiece.id,
          ...pieceData,
          kit_only: form.kit_only,
          is_new: form.is_new,
        });
        toast.success(t("pieces.pieceUpdated"));
      } else {
        await addPieceAction.mutateAsync({
          ...pieceData,
          display_order: maxCode + 1,
          is_mockup: false,
          kit_only: form.kit_only,
          is_new: form.is_new,
        });
      }
      setOpen(false);
    } catch (error) {
      // toast.error is already handled by mutations
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
            <Plus className="w-4 h-4 mr-1" /> {t("pieces.newPiece")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex flex-col max-h-[90vh] overflow-hidden sm:max-w-[600px] p-0">
        <div className="p-6 pb-2 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="font-display">
              {initialPiece ? t("pieces.editPieceTitle") : t("pieces.addPieceTitle")}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("common.code")}</label>
                <Input
                  type="number"
                  placeholder={String(maxCode + 1)}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{t("common.category")}</label>
                <Input
                  required
                  placeholder={t("pieces.pieceCategoryPlaceholder")}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t("common.name")}</label>
              <Input
                required
                placeholder={t("pieces.pieceNamePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Largura</label>
                <Input
                  required
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: e.target.value })}
                  placeholder="Ex: 40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Altura</label>
                <Input
                  required
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Comprimento</label>
                <Input
                  value={form.length}
                  onChange={(e) => setForm({ ...form, length: e.target.value })}
                  placeholder="Ex: 5 (opcional)"
                />
              </div>
            </div>

            {customFieldLabels?.map((label, i) => {
              if (!label) return null;
              const fieldName = `custom_field_${i + 1}`;
              return (
                <div key={fieldName} className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input
                    value={(form as any)[fieldName]}
                    onChange={(e) => setForm({ ...form, [fieldName]: e.target.value })}
                    placeholder={t("pieces.enterCustomFieldValue", { label })}
                  />
                </div>
              );
            })}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t("pieces.specification")}</label>
              <Textarea
                value={form.specification}
                onChange={(e) => setForm({ ...form, specification: e.target.value })}
                placeholder={t("pieces.videManual")}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">{t("pieces.installationInstructions")}</label>
              <Textarea
                value={form.installation_instructions}
                onChange={(e) => setForm({ ...form, installation_instructions: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("pieces.piecePhoto")}</label>
              {previewUrl ? (
                <div className="relative group">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-contain rounded-lg border border-border bg-muted/30"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveImage}
                  >
                    <X className="w-4 h-4 mr-1" /> {t("common.remove")}
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? t("common.sending") : t("common.clickOrDrag")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4 px-6 pb-6 shrink-0 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={uploading}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1" disabled={addPieceAction.isPending || updatePieceAction.isPending || uploading}>
              {(addPieceAction.isPending || updatePieceAction.isPending) ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddPieceDialog;
