import { useState, useRef, useMemo } from "react";
import {
  useOccurrences, useUpdateOccurrenceStatus, useDeleteOccurrence,
  useCampaignEmails, useAddCampaignEmail, useDeleteCampaignEmail,
  useOccurrenceMotives, useAddOccurrenceMotive, useUpdateOccurrenceMotive, useDeleteOccurrenceMotive,
} from "@/hooks/useOccurrences";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Mail, Settings, AlertTriangle, Copy, ExternalLink, Eye, QrCode, Download, Store, Puzzle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import OccurrencesDashboard from "./OccurrencesDashboard";
import PhotoLightbox from "./PhotoLightbox";

interface Props {
  campaignId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
  canEdit?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  resolved: "Resolvida",
  rejected: "Rejeitada",
};

const OccurrencesTab = ({ campaignId, stores, pieces, canEdit: canEditProp }: Props) => {
  const { isAdmin } = useUserRole();
  const canEdit = canEditProp ?? isAdmin;
  const { data: occurrences = [], isLoading } = useOccurrences(campaignId);
  const { data: motives = [] } = useOccurrenceMotives();
  const { data: emails = [] } = useCampaignEmails(campaignId);
  const updateStatus = useUpdateOccurrenceStatus();
  const deleteOcc = useDeleteOccurrence();
  const addEmail = useAddCampaignEmail();
  const deleteEmail = useDeleteCampaignEmail();
  const addMotive = useAddOccurrenceMotive();
  const updateMotive = useUpdateOccurrenceMotive();
  const deleteMotive = useDeleteOccurrenceMotive();

  // Fetch all photos for occurrences in this campaign
  const occurrenceIds = useMemo(() => occurrences.map((o) => o.id), [occurrences]);
  const { data: allPhotos = [] } = useQuery({
    queryKey: ["occurrence_photos", campaignId],
    queryFn: async () => {
      if (occurrenceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("occurrence_photos")
        .select("*")
        .in("occurrence_id", occurrenceIds);
      if (error) throw error;
      return data as { id: string; occurrence_id: string; photo_url: string }[];
    },
    enabled: occurrenceIds.length > 0,
  });

  const photosMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allPhotos.forEach((p) => {
      if (!map[p.occurrence_id]) map[p.occurrence_id] = [];
      map[p.occurrence_id].push(p.photo_url);
    });
    // Also include legacy photo_url from occurrences table
    occurrences.forEach((occ) => {
      if (occ.photo_url && (!map[occ.id] || !map[occ.id].includes(occ.photo_url))) {
        if (!map[occ.id]) map[occ.id] = [];
        map[occ.id].unshift(occ.photo_url);
      }
    });
    return map;
  }, [allPhotos, occurrences]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newMotive, setNewMotive] = useState("");
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = `qrcode-ocorrencias-${campaignId}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const publicLink = `https://harry2025.lovable.app/ocorrencias/${campaignId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    toast.success("Link copiado!");
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAX_EMAIL_LENGTH = 254;

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      toast.error("Por favor, insira um email válido");
      return;
    }
    if (trimmed.length > MAX_EMAIL_LENGTH) {
      toast.error("Email muito longo");
      return;
    }
    addEmail.mutate({ campaignId, email: trimmed }, {
      onSuccess: () => setNewEmail(""),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleAddMotive = () => {
    if (!newMotive.trim()) return;
    addMotive.mutate(newMotive.trim(), { onSuccess: () => setNewMotive("") });
  };

  const getStoreName = (id: string) => {
    const s = stores.find((s) => s.id === id);
    return s?.nickname || s?.name || "—";
  };

  const getPieceName = (id: string) => {
    const p = pieces.find((p) => p.id === id);
    return p?.name || "—";
  };

  const getMotiveName = (id: string | null) => {
    if (!id) return "—";
    return motives.find((m) => m.id === id)?.description || "—";
  };

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link público
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
          <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR Code
        </Button>
        <a href={publicLink} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir formulário
          </Button>
        </a>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-3.5 h-3.5 mr-1.5" /> Configurar
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{occurrences.length} ocorrência(s)</span>
      </div>

      {/* Dashboard */}
      {!isLoading && occurrences.length > 0 && (
        <OccurrencesDashboard occurrences={occurrences} stores={stores} pieces={pieces} motives={motives} />
      )}

      {/* Occurrences list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : occurrences.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma ocorrência registrada.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {occurrences.map((occ) => {
            const motiveIdx = motives.findIndex((m) => m.id === occ.motive_id);
            const MOTIVE_COLORS = [
              "border-l-primary from-primary/8 to-primary/3",
              "border-l-secondary from-secondary/8 to-secondary/3",
              "border-l-accent from-accent/8 to-accent/3",
              "border-l-info from-info/8 to-info/3",
              "border-l-destructive from-destructive/8 to-destructive/3",
              "border-l-[hsl(280,75%,55%)] from-[hsl(280,75%,55%)]/8 to-[hsl(280,75%,55%)]/3",
              "border-l-success from-success/8 to-success/3",
              "border-l-warning from-warning/8 to-warning/3",
            ];
            const motiveColor = motiveIdx >= 0 ? MOTIVE_COLORS[motiveIdx % MOTIVE_COLORS.length] : MOTIVE_COLORS[0];

            return (
              <div
                key={occ.id}
                className={`group bg-gradient-to-br ${motiveColor} border border-border border-l-4 rounded-xl p-4 hover:shadow-lg transition-all duration-200 relative`}
              >
                {/* Header: date + status */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  </span>
                  {canEdit ? (
                    <Select
                      value={occ.status || "pending"}
                      onValueChange={(val) => updateStatus.mutate({ id: occ.id, status: val, campaignId })}
                    >
                      <SelectTrigger className="w-[110px] h-6 text-[10px] border-0 bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="resolved">Resolvida</SelectItem>
                        <SelectItem value="rejected">Rejeitada</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 ${statusColors[occ.status || "pending"]}`}>
                      {statusLabels[occ.status || "pending"]}
                    </Badge>
                  )}
                </div>

                {/* Store + Piece */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">{getStoreName(occ.store_id)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Puzzle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">{getPieceName(occ.piece_id)}</span>
                  </div>
                </div>

                {/* Motive badge */}
                <Badge variant="secondary" className="text-[10px] font-medium mb-2">
                  {getMotiveName(occ.motive_id)}
                </Badge>

                {/* Description */}
                {occ.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{occ.description}</p>
                )}

                {/* Photo thumbnails */}
                {(photosMap[occ.id]?.length ?? 0) > 0 && (
                  <div className="flex gap-1.5 mt-3">
                    {photosMap[occ.id].slice(0, 3).map((url, pi) => (
                      <button
                        key={pi}
                        type="button"
                        className="w-16 h-16 rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all flex-shrink-0"
                        onClick={() => { setLightboxPhotos(photosMap[occ.id]); setLightboxIndex(pi); setLightboxOpen(true); }}
                      >
                        <img src={url} alt={`Foto ${pi + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border/50">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteOcc.mutate({ id: occ.id, campaignId })}>
                            SIM
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Photo lightbox */}
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      {/* QR Code dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code - Ocorrências</DialogTitle>
            <DialogDescription>Escaneie para abrir o formulário público.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div ref={qrRef} className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={publicLink} size={200} level="M" />
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadQR}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings dialog (emails + motives) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações de Ocorrências</DialogTitle>
            <DialogDescription>Gerencie emails de notificação e motivos.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="emails">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="emails" className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Emails</TabsTrigger>
              <TabsTrigger value="motives" className="gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Motivos</TabsTrigger>
            </TabsList>

            <TabsContent value="emails" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">Até 5 emails receberão notificação de novas ocorrências.</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
                />
                <Button size="sm" onClick={handleAddEmail} disabled={emails.length >= 5 || addEmail.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {emails.map((em) => (
                <div key={em.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                  <span className="text-sm">{em.email}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEmail.mutate({ id: em.id, campaignId })}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="motives" className="space-y-3 mt-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Novo motivo"
                  value={newMotive}
                  onChange={(e) => setNewMotive(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMotive())}
                />
                <Button size="sm" onClick={handleAddMotive} disabled={addMotive.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {motives.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                  <span className="text-sm">{m.description}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={m.active}
                      onCheckedChange={(checked) => updateMotive.mutate({ id: m.id, active: checked })}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir motivo?</AlertDialogTitle>
                          <AlertDialogDescription>Ocorrências existentes com este motivo não serão afetadas.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMotive.mutate(m.id)}>
                            SIM
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OccurrencesTab;
