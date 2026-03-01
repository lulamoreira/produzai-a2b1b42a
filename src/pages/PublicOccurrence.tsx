import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOccurrenceMotives, useAddOccurrence } from "@/hooks/useOccurrences";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Send, Package, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";

const MAX_PHOTOS = 3;

const PublicOccurrence = () => {
  const { campaignId } = useParams<{ campaignId: string }>();

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ["public_campaign", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_id, clients(name)")
        .eq("id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["public_stores", campaign?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stores")
        .select("id, name, nickname")
        .eq("client_id", campaign!.client_id)
        .order("nickname");
      if (error) throw error;
      return data;
    },
    enabled: !!campaign?.client_id,
  });

  const { data: pieces = [] } = useQuery({
    queryKey: ["public_pieces", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_pieces")
        .select("id, name, code, image_url")
        .eq("campaign_id", campaignId!)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: motives = [] } = useOccurrenceMotives();
  const activeMotives = useMemo(() => motives.filter((m) => m.active), [motives]);
  const addOccurrence = useAddOccurrence();

  const [storeId, setStoreId] = useState("");
  const [pieceId, setPieceId] = useState("");
  const [motiveId, setMotiveId] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ url: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_PHOTOS} fotos.`); return; }
    const toUpload = files.slice(0, remaining);

    setUploading(true);
    try {
      for (const file of toUpload) {
        const compressed = await compressImage(file, 1200, 0.7);
        const path = `occ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage.from("occurrence-images").upload(path, compressed, {
          upsert: true,
          contentType: "image/jpeg",
        });
        if (error) { toast.error("Erro ao enviar foto."); continue; }
        const { data: urlData } = supabase.storage.from("occurrence-images").getPublicUrl(path);
        setPhotos((prev) => [...prev, { url: urlData.publicUrl, preview: urlData.publicUrl }]);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !storeId || !pieceId || !motiveId) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    try {
      const occurrenceData = {
        campaign_id: campaignId,
        store_id: storeId,
        piece_id: pieceId,
        motive_id: motiveId,
        description: description || undefined,
        photo_url: photos[0]?.url || undefined,
      };
      const occId = await addOccurrence.mutateAsync(occurrenceData);

      // Save photos to occurrence_photos table if we got an ID back
      if (occId && photos.length > 0) {
        const photoRows = photos.map((p) => ({ occurrence_id: occId, photo_url: p.url }));
        await supabase.from("occurrence_photos").insert(photoRows);
      }

      setSubmitted(true);
    } catch {
      toast.error("Erro ao registrar ocorrência.");
    }
  };

  const handleNew = () => {
    setPieceId("");
    setMotiveId("");
    setDescription("");
    setPhotos([]);
    setSubmitted(false);
  };

  if (loadingCampaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h1 className="text-lg font-bold text-foreground mb-1">Campanha não encontrada</h1>
          <p className="text-sm text-muted-foreground">O link pode estar incorreto ou a campanha foi removida.</p>
        </div>
      </div>
    );
  }

  const clientName = (campaign as any).clients?.name || "";

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Ocorrência Registrada!</h1>
          <p className="text-sm text-muted-foreground mb-6">Sua ocorrência foi enviada com sucesso. A equipe será notificada.</p>
          <Button onClick={handleNew}>Registrar outra ocorrência</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 text-center">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-2 shadow-glow-primary">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Registrar Ocorrência</h1>
          <p className="text-xs text-muted-foreground mt-1">{clientName} · {campaign.name}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Identifique sua loja *</label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger><SelectValue placeholder="Selecione pelo apelido da loja" /></SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nickname || s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Peça *</label>
            <Select value={pieceId} onValueChange={setPieceId}>
              <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
              <SelectContent>
                {pieces.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo *</label>
            <Select value={motiveId} onValueChange={setMotiveId}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {activeMotives.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição (opcional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema em detalhes..."
              rows={3}
            />
          </div>

          {/* Multi-photo upload */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Fotos (opcional · até {MAX_PHOTOS})
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg border border-border overflow-hidden group">
                  <img src={photo.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <div className="relative w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20 flex items-center justify-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-1">
                    {uploading ? (
                      <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Adicionar</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={addOccurrence.isPending || !storeId || !pieceId || !motiveId}>
            <Send className="w-4 h-4 mr-2" /> Enviar Ocorrência
          </Button>
        </form>
      </main>
    </div>
  );
};

export default PublicOccurrence;
