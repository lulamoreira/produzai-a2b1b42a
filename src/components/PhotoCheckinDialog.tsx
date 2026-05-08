import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Trash2, Edit3, X, ChevronLeft, ChevronRight, Camera, Video } from "lucide-react";
import { type ClientStore } from "@/hooks/useMultiClientData";
import { type InstallationPhoto, useUpdateInstallationPhoto, useDeleteInstallationPhoto, isVideo } from "@/hooks/useInstallationPhotos";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrphanPhotoCleanup } from "@/hooks/useOrphanPhotoCleanup";
import { ReinstallPhotoBadge } from "@/components/ReinstallPhotoBadge";
import { ReinstallPhotoFilter, type ReinstallPhotoFilterValue } from "@/components/ReinstallPhotoFilter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "before", label: "Antes" },
  { value: "during", label: "Durante" },
  { value: "after", label: "Depois" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: ClientStore;
  photos: InstallationPhoto[];
}

export default function PhotoCheckinDialog({ open, onOpenChange, store, photos }: Props) {
  const { isAdminOrMaster } = useUserRole();
  const updatePhoto = useUpdateInstallationPhoto();
  const deletePhoto = useDeleteInstallationPhoto();
  const { handleMediaError } = useOrphanPhotoCleanup();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const [reinstallFilter, setReinstallFilter] = useState<ReinstallPhotoFilterValue>("all");

  const reinstallFilteredPhotos = reinstallFilter === "all"
    ? photos
    : reinstallFilter === "original"
      ? photos.filter((p) => !p.reinstall_seq || p.reinstall_seq === 0)
      : photos.filter((p) => (p.reinstall_seq ?? 0) === reinstallFilter);

  const filteredPhotos = selectedCategory
    ? reinstallFilteredPhotos.filter((p) => p.category === selectedCategory)
    : reinstallFilteredPhotos;

  const address = [store.street, store.number, store.complement, store.neighborhood, store.city, store.state, store.zip_code]
    .filter(Boolean)
    .join(", ");

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

  const lightboxPhotos = filteredPhotos;
  const currentLightbox = lightboxIndex !== null ? lightboxPhotos[lightboxIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Checkin Fotográfico
          </DialogTitle>
          <DialogDescription>Galeria de fotos da instalação</DialogDescription>
        </DialogHeader>

        {/* Store info */}
        <div className="px-6 pb-3 space-y-1 border-b border-border">
          <p className="text-sm font-semibold text-foreground">{store.store_code ? `${store.store_code} — ` : ""}{store.name}</p>
          <p className="text-xs text-muted-foreground">{store.state} · {store.city || "—"}</p>
          {address && <p className="text-xs text-muted-foreground">{address}</p>}
        </div>

        {/* Reinstallation filter (auto-hides if there are no reinstallation photos) */}
        <div className="px-6 pt-3">
          <ReinstallPhotoFilter
            photos={photos}
            value={reinstallFilter}
            onChange={(v) => setReinstallFilter(v)}
          />
        </div>

        {/* Category filter */}
        <div className="px-6 py-3 flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            Todas ({reinstallFilteredPhotos.length})
          </Button>
          {CATEGORIES.map((cat) => {
            const count = reinstallFilteredPhotos.filter((p) => p.category === cat.value).length;
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
        </div>

        {/* Photo grid */}
        <div className="px-6 pb-6">
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
              Nenhuma foto {selectedCategory ? "nesta categoria" : "registrada"}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredPhotos.map((photo, i) => (
                <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted/30">
                  {isVideo(photo) ? (
                    <div className="w-full aspect-square relative cursor-pointer bg-black flex items-center justify-center" onClick={() => setLightboxIndex(i)}>
                      <video src={photo.photo_url} className="w-full h-full object-cover" muted preload="metadata" onError={() => handleMediaError(photo.id, photo.campaign_id)} />
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
                      onError={() => handleMediaError(photo.id, photo.campaign_id)}
                    />
                  )}
                  {/* Category badge - clickable dropdown for Admin/Master */}
                  {isAdminOrMaster ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className={cn(
                          "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white cursor-pointer hover:opacity-80 transition-opacity",
                          photo.category === "before" && "bg-blue-500",
                          photo.category === "during" && "bg-amber-500",
                          photo.category === "after" && "bg-emerald-500",
                        )}>
                          {CATEGORIES.find((c) => c.value === photo.category)?.label || photo.category}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[100px]">
                        {CATEGORIES.map((cat) => (
                          <DropdownMenuItem
                            key={cat.value}
                            className={cn("text-xs", photo.category === cat.value && "font-bold")}
                            onClick={(e) => { e.stopPropagation(); handleChangeCategory(photo, cat.value); }}
                          >
                            {cat.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className={cn(
                      "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white",
                      photo.category === "before" && "bg-blue-500",
                      photo.category === "during" && "bg-amber-500",
                      photo.category === "after" && "bg-emerald-500",
                    )}>
                      {CATEGORIES.find((c) => c.value === photo.category)?.label || photo.category}
                    </span>
                  )}
                  {/* Action buttons on hover */}
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
                  {/* Caption */}
                  {photo.caption && (
                    <div className="p-2">
                      <p className="text-[10px] text-muted-foreground truncate">{photo.caption}</p>
                    </div>
                  )}
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

            {lightboxPhotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length); }}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % lightboxPhotos.length); }}
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

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
              {/* Category selector */}
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

              {/* Caption edit */}
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

              {/* Delete button */}
              <div className="flex justify-center">
                <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={() => handleDelete(currentLightbox)}>
                  <Trash2 className="w-3.5 h-3.5" /> Excluir foto
                </Button>
              </div>

              {/* Dots */}
              {lightboxPhotos.length > 1 && (
                <div className="flex items-center gap-1.5 justify-center">
                  {lightboxPhotos.map((_, i) => (
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
      </DialogContent>
    </Dialog>
  );
}
