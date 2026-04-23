import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstallationPhotos, useAddInstallationPhoto, useUpdateInstallationPhoto, useDeleteInstallationPhoto, type InstallationPhoto, isVideo } from "@/hooks/useInstallationPhotos";
import { useOrphanPhotoCleanup } from "@/hooks/useOrphanPhotoCleanup";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/compressImage";
import { compressVideo } from "@/lib/compressVideo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Camera, Upload, Trash2, Edit3, X, ChevronLeft, ChevronRight, Image, Download, Video } from "lucide-react";
import { downloadPhotosAsZip } from "@/lib/downloadPhotosZip";
import PhasePickerDialog, { type PhotoPhase } from "@/components/PhasePickerDialog";

const CATEGORIES = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
];

export default function PhotoCheckin() {
  const { campaignId, storeId } = useParams<{ campaignId: string; storeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const [uploadCategory, setUploadCategory] = useState("before");
  const [phasePickerOpen, setPhasePickerOpen] = useState(false);
  const pendingMethodRef = useRef<"upload" | "camera">("upload");
  const pendingPhaseRef = useRef<PhotoPhase>("before");

  const { data: store, isLoading: loadingStore } = useQuery({
    queryKey: ["store-detail", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stores")
        .select("*")
        .eq("id", storeId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const { data: photos = [], isLoading: loadingPhotos } = useInstallationPhotos(campaignId!);
  
  const { data: campaign } = useQuery({
    queryKey: ["campaign-name", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("name").eq("id", campaignId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
  const addPhoto = useAddInstallationPhoto();
  const updatePhoto = useUpdateInstallationPhoto();
  const deletePhoto = useDeleteInstallationPhoto();
  const { handleMediaError } = useOrphanPhotoCleanup();

  const storePhotos = photos.filter((p) => p.store_id === storeId);

  const filteredPhotos = selectedCategory
    ? storePhotos.filter((p) => p.category === selectedCategory)
    : storePhotos;

  const address = store
    ? [store.street, store.number, store.complement, store.neighborhood, store.city, store.state, store.zip_code]
        .filter(Boolean)
        .join(", ")
    : "";

  const handleUpload = async (files: FileList | null, category: string, method: "upload" | "camera" = "upload") => {
    if (!files || !campaignId || !storeId || !user) return;
    for (const file of Array.from(files)) {
      try {
        const fileIsVideo = file.type.startsWith("video/");
        let blob: Blob;
        if (fileIsVideo) {
          toast.info("Processando vídeo, aguarde...");
          blob = await compressVideo(file);
        } else {
          blob = await compressImage(file);
        }
        const ext = fileIsVideo ? "webm" : (file.name.split(".").pop() || "jpg");
        const path = `${campaignId}/${storeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const contentType = fileIsVideo ? (blob.type || "video/webm") : "image/jpeg";
        const { error: upErr } = await supabase.storage.from("installation-photos").upload(path, blob, { contentType });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("installation-photos").getPublicUrl(path);
        await addPhoto.mutateAsync({
          campaign_id: campaignId,
          store_id: storeId,
          photo_url: urlData.publicUrl,
          category,
          uploaded_by: user.id,
          upload_method: method,
          media_type: fileIsVideo ? "video" : "photo",
        });
        toast.success(fileIsVideo ? "Vídeo enviado!" : "Foto enviada!");
      } catch (err: any) {
        toast.error("Erro ao enviar: " + err.message);
      }
    }
  };

  const handleDelete = async (photo: InstallationPhoto) => {
    if (!confirm("Deseja excluir esta foto?")) return;
    await deletePhoto.mutateAsync({ id: photo.id, photo_url: photo.photo_url });
    toast.success("Foto excluída!");
    if (lightboxIndex !== null) setLightboxIndex(null);
  };

  const handleSaveCaption = async (photo: InstallationPhoto) => {
    await updatePhoto.mutateAsync({ id: photo.id, caption: captionValue });
    setEditingCaption(null);
    toast.success("Legenda atualizada!");
  };

  const handleChangeCategory = async (photo: InstallationPhoto, newCategory: string) => {
    await updatePhoto.mutateAsync({ id: photo.id, category: newCategory });
    toast.success("Categoria atualizada!");
  };

  const currentLightbox = lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  if (loadingStore || loadingPhotos) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loja não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.close()} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold flex items-center gap-2 truncate">
              <Camera className="w-5 h-5 shrink-0" />
              Checkin Fotográfico
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {store.store_code ? `${store.store_code} — ` : ""}{store.name}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Store info */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {store.store_code ? `${store.store_code} — ` : ""}{store.name}
          </p>
          <p className="text-xs text-muted-foreground">{store.state} · {store.city || "—"}</p>
          {address && <p className="text-xs text-muted-foreground">{address}</p>}
          {store.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {store.cnpj}</p>}
        </div>

        {/* Upload controls */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Adicionar fotos e vídeos</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                pendingMethodRef.current = "upload";
                setPhasePickerOpen(true);
              }}
            >
              <Upload className="w-3.5 h-3.5" /> Enviar arquivo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                pendingMethodRef.current = "camera";
                setPhasePickerOpen(true);
              }}
            >
              <Camera className="w-3.5 h-3.5" /> Tirar foto/vídeo
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Aceita imagens e vídeos (MP4, MOV, WebM). Vídeos acima de 10 MB serão comprimidos automaticamente.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files, pendingPhaseRef.current, "upload"); e.target.value = ""; }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files, pendingPhaseRef.current, "camera"); e.target.value = ""; }}
          />
          <PhasePickerDialog
            open={phasePickerOpen}
            onOpenChange={setPhasePickerOpen}
            onSelect={(phase) => {
              pendingPhaseRef.current = phase;
              setUploadCategory(phase);
              setPhasePickerOpen(false);
              setTimeout(() => {
                if (pendingMethodRef.current === "camera") cameraRef.current?.click();
                else fileRef.current?.click();
              }, 50);
            }}
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            Todas ({storePhotos.length})
          </Button>
          {CATEGORIES.map((cat) => {
            const count = storePhotos.filter((p) => p.category === cat.value).length;
            return (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label} ({count})
              </Button>
            );
          })}
          {storePhotos.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                toast.info("Preparando download...");
                downloadPhotosAsZip(storePhotos, {
                  module: "Instalacao",
                  campaignName: campaign?.name || "",
                  storeName: store.name,
                }).then(() => toast.success("Download concluído!")).catch(() => toast.error("Erro ao baixar fotos"));
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Baixar todas ({storePhotos.length})
            </Button>
          )}
        </div>

        {/* Photo grid */}
        {filteredPhotos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nenhuma foto {selectedCategory ? "nesta categoria" : "registrada"}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredPhotos.map((photo, i) => (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted/30">
                {isVideo(photo) ? (
                  <div className="w-full aspect-square relative cursor-pointer bg-black flex items-center justify-center" onClick={() => setLightboxIndex(i)}>
                    <video src={photo.photo_url} className="w-full h-full object-cover" muted preload="metadata" onError={() => handleMediaError(photo.id, campaignId!)} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="w-8 h-8 text-white" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || `Foto ${i + 1}`}
                    className="w-full aspect-square object-cover cursor-pointer transition-transform hover:scale-105"
                    onClick={() => setLightboxIndex(i)}
                    onError={() => handleMediaError(photo.id, campaignId!)}
                  />
                )}
                <span className={cn(
                  "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white",
                  photo.category === "before" && "bg-blue-500",
                  photo.category === "during" && "bg-amber-500",
                  photo.category === "after" && "bg-emerald-500",
                )}>
                  {CATEGORIES.find((c) => c.value === photo.category)?.label || photo.category}
                </span>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="p-2 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {photo.upload_method === "camera" ? <Camera className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                    {photo.upload_method === "camera" ? "Foto" : "Upload"} · {format(new Date(photo.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                  {photo.caption && (
                    <p className="text-[10px] text-muted-foreground truncate">{photo.caption}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {currentLightbox && lightboxIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-6 h-6" />
          </Button>

          {filteredPhotos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length); }}
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length); }}
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </>
          )}

          {isVideo(currentLightbox) ? (
            <video
              src={currentLightbox.photo_url}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[75vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={currentLightbox.photo_url}
              alt={currentLightbox.caption || "Foto"}
              className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-xs text-white/70 flex items-center justify-center gap-1.5">
              {currentLightbox.upload_method === "camera" ? <Camera className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              {currentLightbox.upload_method === "camera" ? "Foto tirada" : "Upload"} em {format(new Date(currentLightbox.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <div className="flex items-center gap-2 justify-center">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={currentLightbox.category === cat.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => handleChangeCategory(currentLightbox, cat.value)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-lg mx-auto w-full">
              {editingCaption === currentLightbox.id ? (
                <>
                  <Input
                    value={captionValue}
                    onChange={(e) => setCaptionValue(e.target.value)}
                    placeholder="Legenda da foto..."
                    className="flex-1 h-8 text-xs bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveCaption(currentLightbox); }}
                  />
                  <Button size="sm" className="h-8 text-xs" onClick={() => handleSaveCaption(currentLightbox)}>Salvar</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-white" onClick={() => setEditingCaption(null)}>Cancelar</Button>
                </>
              ) : (
                <button
                  className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors mx-auto"
                  onClick={() => { setEditingCaption(currentLightbox.id); setCaptionValue(currentLightbox.caption || ""); }}
                >
                  <Edit3 className="w-3 h-3" />
                  {currentLightbox.caption || "Adicionar legenda"}
                </button>
              )}
            </div>

            <div className="flex justify-center">
              <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={() => handleDelete(currentLightbox)}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir foto
              </Button>
            </div>

            {filteredPhotos.length > 1 && (
              <div className="flex items-center gap-1.5 justify-center">
                {filteredPhotos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className={cn("w-2 h-2 rounded-full transition-all", i === lightboxIndex ? "bg-white scale-125" : "bg-white/40")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
