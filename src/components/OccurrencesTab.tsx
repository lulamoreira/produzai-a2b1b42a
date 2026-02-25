import { useState } from "react";
import {
  useOccurrences, useUpdateOccurrenceStatus, useDeleteOccurrence,
  useCampaignEmails, useAddCampaignEmail, useDeleteCampaignEmail,
  useOccurrenceMotives, useAddOccurrenceMotive, useUpdateOccurrenceMotive, useDeleteOccurrenceMotive,
} from "@/hooks/useOccurrences";
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
import { Plus, Trash2, Mail, Settings, AlertTriangle, Copy, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  campaignId: string;
  stores: ClientStore[];
  pieces: CampaignPiece[];
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

const OccurrencesTab = ({ campaignId, stores, pieces }: Props) => {
  const { isAdmin } = useUserRole();
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newMotive, setNewMotive] = useState("");
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const publicLink = `${window.location.origin}/ocorrencias/${campaignId}`;

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
        <a href={publicLink} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir formulário
          </Button>
        </a>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-3.5 h-3.5 mr-1.5" /> Configurar
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{occurrences.length} ocorrência(s)</span>
      </div>

      {/* Occurrences list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
      ) : occurrences.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma ocorrência registrada.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Peça</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {occurrences.map((occ) => (
                <TableRow key={occ.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{getStoreName(occ.store_id)}</TableCell>
                  <TableCell className="text-sm">{getPieceName(occ.piece_id)}</TableCell>
                  <TableCell className="text-sm">{getMotiveName(occ.motive_id)}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Select
                        value={occ.status || "pending"}
                        onValueChange={(val) => updateStatus.mutate({ id: occ.id, status: val, campaignId })}
                      >
                        <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="resolved">Resolvida</SelectItem>
                          <SelectItem value="rejected">Rejeitada</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={statusColors[occ.status || "pending"]}>
                        {statusLabels[occ.status || "pending"]}
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {occ.photo_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewPhoto(occ.photo_url)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Photo viewer */}
      <Dialog open={!!viewPhoto} onOpenChange={(open) => !open && setViewPhoto(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Foto da Ocorrência</DialogTitle>
          </DialogHeader>
          {viewPhoto && <img src={viewPhoto} alt="Ocorrência" className="w-full rounded-lg" />}
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
