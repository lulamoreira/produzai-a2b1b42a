import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOccurrenceMotives, useAddOccurrence } from "@/hooks/useOccurrences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Send, Package, X, ImagePlus, Plus, Trash2, Boxes } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";

const MAX_PHOTOS = 3;

type OccurrenceEntry = {
  pieceId: string;
  motiveId: string;
  locationInStore: string;
  description: string;
  photos: { url: string; preview: string }[];
};

const emptyEntry = (): OccurrenceEntry => ({
  pieceId: "",
  motiveId: "",
  locationInStore: "",
  description: "",
  photos: [],
});

const PublicOccurrence = () => {
  const { campaignId } = useParams<{ campaignId: string }>();

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ["public_campaign", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_id, occurrence_start_date, occurrence_end_date, clients(name, agency_id, agencies(name))")
        .eq("id", campaignId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  // Check if occurrence submission is within allowed date window
  const isWithinOccurrenceWindow = useMemo(() => {
    if (!campaign) return true;
    const startDate = (campaign as any).occurrence_start_date;
    const endDate = (campaign as any).occurrence_end_date;
    // If no period configured, block submissions
    if (!startDate && !endDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (startDate && today < startDate) return false;
    if (endDate && today > endDate) return false;
    return true;
  }, [campaign]);

  const { data: stores = [] } = useQuery({
    queryKey: ["public_stores", campaign?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stores")
        .select("id, name, nickname, phone, email")
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
        .select("id, name, code, image_url, kit_only, category")
        .eq("campaign_id", campaignId!)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: kits = [] } = useQuery({
    queryKey: ["public_kits", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_kits")
        .select("id, name, code, image_url")
        .eq("campaign_id", campaignId!)
        .order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: kitPieces = [] } = useQuery({
    queryKey: ["public_kit_pieces", campaignId],
    queryFn: async () => {
      const kitIds = kits.map((k) => k.id);
      if (kitIds.length === 0) return [];
      const { data, error } = await supabase
        .from("campaign_kit_pieces")
        .select("kit_id, piece_id")
        .in("kit_id", kitIds);
      if (error) throw error;
      return data;
    },
    enabled: kits.length > 0,
  });

  // Build grouped piece list filtered by location
  const buildGroupedPieceOptions = (locationFilter: string) => {
    const filteredPieces = locationFilter
      ? pieces.filter((p) => p.category === locationFilter)
      : pieces;
    const kitPieceIds = new Set(kitPieces.map((kp) => kp.piece_id));
    const standalonePieces = filteredPieces.filter((p) => !p.kit_only && !kitPieceIds.has(p.id));

    const kitGroups = kits.map((kit) => {
      const memberPieceIds = kitPieces.filter((kp) => kp.kit_id === kit.id).map((kp) => kp.piece_id);
      const memberPieces = filteredPieces.filter((p) => memberPieceIds.includes(p.id));
      return { kit, memberPieces };
    }).filter((g) => g.memberPieces.length > 0);

    return { standalonePieces, kitGroups };
  };

  const { data: locations = [] } = useQuery({
    queryKey: ["public_locations", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_piece_locations")
        .select("id, name")
        .eq("campaign_id", campaignId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: motives = [] } = useOccurrenceMotives();
  const activeMotives = useMemo(() => motives.filter((m) => m.active), [motives]);
  const addOccurrence = useAddOccurrence();

  const SPECIAL_AGENCY = "__agency__";
  const SPECIAL_FORNECEDOR = "__fornecedor__";
  const SPECIAL_CLIENTE = "__cliente__";
  const agencyName = (campaign as any)?.clients?.agencies?.name || "Agência";
  const clientName2 = (campaign as any)?.clients?.name || "Cliente";

  // Reporter info (shared)
  const [reporterType, setReporterType] = useState("");
  const [specialStoreId, setSpecialStoreId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [phoneDDD, setPhoneDDD] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");

  const isSpecialReporter = reporterType === SPECIAL_AGENCY || reporterType === SPECIAL_FORNECEDOR || reporterType === SPECIAL_CLIENTE;

  // Multiple occurrences
  const [entries, setEntries] = useState<OccurrenceEntry[]>([emptyEntry()]);
  const [uploading, setUploading] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateEntry = (idx: number, patch: Partial<OccurrenceEntry>) => {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== idx) return e;
      // Reset pieceId when location changes
      if (patch.locationInStore !== undefined && patch.locationInStore !== e.locationInStore) {
        return { ...e, ...patch, pieceId: "" };
      }
      return { ...e, ...patch };
    }));
  };

  const removeEntry = (idx: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePhotoUpload = async (entryIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const entry = entries[entryIdx];
    const remaining = MAX_PHOTOS - entry.photos.length;
    if (remaining <= 0) { toast.error(`Máximo de ${MAX_PHOTOS} fotos.`); return; }
    const toUpload = files.slice(0, remaining);

    setUploading(entryIdx);
    try {
      const newPhotos: { url: string; preview: string }[] = [];
      for (const file of toUpload) {
        const compressed = await compressImage(file, 1200, 0.7);
        const path = `occ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
        const { error } = await supabase.storage.from("occurrence-images").upload(path, compressed, {
          upsert: true,
          contentType: "image/jpeg",
        });
        if (error) { toast.error("Erro ao enviar foto."); continue; }
        const { data: urlData } = supabase.storage.from("occurrence-images").getPublicUrl(path);
        newPhotos.push({ url: urlData.publicUrl, preview: urlData.publicUrl });
      }
      updateEntry(entryIdx, { photos: [...entry.photos, ...newPhotos] });
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const removePhoto = (entryIdx: number, photoIdx: number) => {
    const entry = entries[entryIdx];
    updateEntry(entryIdx, { photos: entry.photos.filter((_, i) => i !== photoIdx) });
  };

  const allEntriesValid = entries.every((e) => e.pieceId && e.motiveId && (locations.length === 0 || e.locationInStore));
  const reporterValid = isSpecialReporter
    ? !!reporterType && !!specialStoreId
    : !!storeId && reporterName.trim() && phoneDDD.trim() && phoneNumber.trim() && reporterEmail.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !reporterValid || !allEntriesValid) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setSubmitting(true);
    try {
      const rType = reporterType === SPECIAL_AGENCY ? "agency" : reporterType === SPECIAL_FORNECEDOR ? "fornecedor" : reporterType === SPECIAL_CLIENTE ? "cliente" : "store";
      for (const entry of entries) {
        const occurrenceData: Record<string, unknown> = {
          campaign_id: campaignId,
          piece_id: entry.pieceId,
          motive_id: entry.motiveId,
          description: entry.description || undefined,
          location_in_store: entry.locationInStore || undefined,
          photo_url: entry.photos[0]?.url || undefined,
          reporter_type: rType,
        };
        if (isSpecialReporter) {
          occurrenceData.store_id = specialStoreId;
        } else {
          occurrenceData.store_id = storeId;
          occurrenceData.reporter_name = reporterName.trim();
          occurrenceData.reporter_phone_ddd = phoneDDD.trim();
          occurrenceData.reporter_phone_number = phoneNumber.trim();
          occurrenceData.reporter_email = reporterEmail.trim();
        }
        const occId = await addOccurrence.mutateAsync(occurrenceData as any);
        if (occId && entry.photos.length > 0) {
          const photoRows = entry.photos.map((p) => ({ occurrence_id: occId, photo_url: p.url }));
          await supabase.from("occurrence_photos").insert(photoRows);
        }
      }
      setSubmitted(true);
    } catch {
      toast.error("Erro ao registrar ocorrência.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNew = () => {
    setEntries([emptyEntry()]);
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

  if (!isWithinOccurrenceWindow) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">Período encerrado</h1>
          <p className="text-sm text-muted-foreground">Infelizmente o período de inclusão de ocorrências terminou, procure contato através do WhatsApp ou e-mail.</p>
          <Button variant="outline" className="mt-6" onClick={() => window.close()}>Fechar</Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            {entries.length > 1 ? `${entries.length} Ocorrências Registradas!` : "Ocorrência Registrada!"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">Suas ocorrências foram enviadas com sucesso. A equipe será notificada.</p>
          <Button onClick={handleNew}>Registrar novas ocorrências</Button>
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
          {/* ── Dados do Lojista (compartilhados) ── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Seus dados</h2>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Identifique-se *</label>
              <Select value={reporterType || storeId} onValueChange={(val) => {
                if (val === SPECIAL_AGENCY || val === SPECIAL_FORNECEDOR || val === SPECIAL_CLIENTE) {
                  setReporterType(val);
                  setStoreId("");
                  setSpecialStoreId("");
                  setReporterName("");
                  setPhoneDDD("");
                  setPhoneNumber("");
                  setReporterEmail("");
                } else {
                  setReporterType("");
                  setStoreId(val);
                  setSpecialStoreId("");
                  const selected = stores.find((s) => s.id === val);
                  if (selected) {
                    if (selected.phone) {
                      const digits = selected.phone.replace(/\D/g, "");
                      setPhoneDDD(digits.slice(0, 2));
                      setPhoneNumber(digits.slice(2));
                    }
                    if (selected.email) setReporterEmail(selected.email);
                  }
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione quem está reportando" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SPECIAL_AGENCY}>{agencyName}</SelectItem>
                  <SelectItem value={SPECIAL_CLIENTE}>{clientName2}</SelectItem>
                  <SelectItem value={SPECIAL_FORNECEDOR}>Fornecedor</SelectItem>
                  <SelectSeparator />
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nickname || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isSpecialReporter && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Loja relacionada *</label>
                <Select value={specialStoreId} onValueChange={setSpecialStoreId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nickname || s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isSpecialReporter && storeId && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Seu nome *</label>
                  <Input
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Nome completo"
                    required={!isSpecialReporter}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">WhatsApp *</label>
                  <div className="flex gap-2">
                    <Input
                      value={phoneDDD}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setPhoneDDD(v);
                      }}
                      placeholder="DDD"
                      className="w-20 text-center"
                      inputMode="numeric"
                      maxLength={2}
                      required={!isSpecialReporter}
                    />
                    <Input
                      value={phoneNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                        setPhoneNumber(v);
                      }}
                      placeholder="Número"
                      className="flex-1"
                      inputMode="numeric"
                      maxLength={9}
                      required={!isSpecialReporter}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">E-mail da loja *</label>
                  <Input
                    type="email"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="email@daloja.com.br"
                    required={!isSpecialReporter}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Informe o e-mail da loja, não o pessoal.</p>
                </div>
              </>
            )}
          </div>

          {/* ── Ocorrências ── */}
          {entries.map((entry, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-4 space-y-4 relative">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Ocorrência {entries.length > 1 ? `${idx + 1}` : ""}
                </h2>
                {entries.length > 1 && (
                  <button type="button" onClick={() => removeEntry(idx)} className="text-destructive hover:text-destructive/80 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {locations.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Localização na Loja *</label>
                  <Select value={entry.locationInStore} onValueChange={(v) => updateEntry(idx, { locationInStore: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a localização" /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Peça *</label>
                <Select
                  value={entry.pieceId}
                  onValueChange={(v) => updateEntry(idx, { pieceId: v })}
                  disabled={locations.length > 0 && !entry.locationInStore}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={locations.length > 0 && !entry.locationInStore ? "Selecione a localização primeiro" : "Selecione a peça"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const groupedPieceOptions = buildGroupedPieceOptions(entry.locationInStore);
                      return (
                        <>
                          {groupedPieceOptions.standalonePieces.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">Peças avulsas</SelectLabel>
                              {groupedPieceOptions.standalonePieces.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center gap-2">
                                    {p.image_url ? (
                                      <img src={p.image_url} alt={p.name} className="w-6 h-6 rounded object-cover" />
                                    ) : (
                                      <Package className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span>{p.code} - {p.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {groupedPieceOptions.kitGroups.map((group) => (
                            <SelectGroup key={group.kit.id}>
                              <SelectLabel className="text-xs font-bold text-white bg-[#1e3a5f] flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md mx-1">
                                <Boxes className="w-3.5 h-3.5" />
                                Kit {group.kit.code} - {group.kit.name}
                              </SelectLabel>
                              {group.memberPieces.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="border-l-2 border-[#1e3a5f]/30 ml-3">
                                  <div className="flex items-center gap-2 pl-1">
                                    {p.image_url ? (
                                      <img src={p.image_url} alt={p.name} className="w-6 h-6 rounded object-cover" />
                                    ) : (
                                      <Package className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className="text-sm">{p.code} - {p.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo *</label>
                <Select value={entry.motiveId} onValueChange={(v) => updateEntry(idx, { motiveId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {activeMotives.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Fale mais sobre o problema (opcional)</label>
                <Textarea
                  value={entry.description}
                  onChange={(e) => updateEntry(idx, { description: e.target.value })}
                  placeholder="Descreva o problema em detalhes..."
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Fotos (opcional · até {MAX_PHOTOS})
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {entry.photos.map((photo, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-lg border border-border overflow-hidden group">
                      <img src={photo.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx, i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {entry.photos.length < MAX_PHOTOS && (
                    <div className="relative w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/20 flex items-center justify-center cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => handlePhotoUpload(idx, e)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading === idx}
                      />
                      <div className="flex flex-col items-center gap-1">
                        {uploading === idx ? (
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
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setEntries((prev) => [...prev, emptyEntry()])}
          >
            <Plus className="w-4 h-4 mr-2" /> Acrescentar mais uma ocorrência
          </Button>

          <Button type="submit" className="w-full" disabled={submitting || !reporterValid || !allEntriesValid}>
            <Send className="w-4 h-4 mr-2" />
            Enviar {entries.length > 1 ? `${entries.length} Ocorrências` : "Ocorrência"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default PublicOccurrence;
