import { useState, useMemo, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useAgencySuppliers,
  useAddAgencySupplier,
  useUpdateAgencySupplier,
  useDeleteAgencySupplier,
  VISUAL_COMMUNICATION_SERVICES,
  type AgencySupplier,
  type SupplierContact
} from "@/hooks/useAgencySuppliers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Copy,
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Upload, 
  FileText, 
  Globe, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare,
  X,
  LayoutGrid,
  List,
  Building2,
  User as UserIcon,
  Loader2,
  Share2,
  Eye
} from "lucide-react";
import SupplierDetailsSheet from "@/components/SupplierDetailsSheet";
import SupplierFormDialog from "@/components/SupplierFormDialog";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

const AgencySuppliers = () => {
  const { user } = useAuth();
  
  const { agencyId: agencyIdParam } = useParams<{ agencyId?: string }>();
  const navigate = useNavigate();

  // Valida formato UUID — protege contra links inválidos tipo /agency/suppliers/suppliers
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isValidParam = !agencyIdParam || UUID_REGEX.test(agencyIdParam);

  // Fetch agency ID
  const { data: profileAgencyId } = useQuery({
    queryKey: ["user_agency_id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data?.agency_id;
    },
    enabled: !!user && (!agencyIdParam || !isValidParam),
  });

  const agencyId = isValidParam ? (agencyIdParam ?? profileAgencyId) : profileAgencyId;

  // Avisa e redireciona se o link era inválido
  useEffect(() => {
    if (agencyIdParam && !isValidParam) {
      toast.error(
        `Link inválido: "${agencyIdParam}" não é uma agência válida. Redirecionando para sua agência...`
      );
      if (profileAgencyId) {
        navigate(`/agency/${profileAgencyId}/suppliers`, { replace: true });
      }
    }
  }, [agencyIdParam, isValidParam, profileAgencyId, navigate]);

  const { data: suppliers = [], isLoading } = useAgencySuppliers(agencyId);
  const addSupplier = useAddAgencySupplier();
  const updateSupplier = useUpdateAgencySupplier();
  const deleteSupplier = useDeleteAgencySupplier();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<AgencySupplier | null>(null);
  const [detailsSupplier, setDetailsSupplier] = useState<AgencySupplier | null>(null);
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteDays, setInviteDays] = useState(7);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{ url: string; expiresAt: Date } | null>(null);


  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.services as string[]).some(service => service.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [suppliers, searchTerm]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: AgencySupplier) => {
    setEditingSupplier(s);
    setDialogOpen(true);
  };



  const handleGenerateInvite = async () => {
    if (!agencyId || !user) return;
    setGeneratingInvite(true);
    try {
      const expiresAt = addDays(new Date(), inviteDays);
      const { data, error } = await supabase
        .from("supplier_invitations")
        .insert([{
          agency_id: agencyId,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          status: "pending"
        }])
        .select()
        .single();

      if (error) throw error;

      const url = `${window.location.origin}/convite/fornecedor/${data.token}`;
      setGeneratedInvite({ url, expiresAt });
    } catch (err: any) {
      toast.error("Erro ao gerar convite: " + err.message);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const { data: agencyInfo } = useQuery({
    queryKey: ["agency_name", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });

  const inviteText = generatedInvite && agencyInfo ? `Olá! 👋

A *${agencyInfo.name}* convida você a se cadastrar como fornecedor parceiro em nossa plataforma.

Clique no link abaixo para preencher seu cadastro — é rápido e não precisa criar conta:

🔗 ${generatedInvite.url}

O link estará disponível por ${inviteDays} dias, até ${format(generatedInvite.expiresAt, "dd/MM/yyyy")}.

Qualquer dúvida, estamos à disposição!` : "";

  const handleWhatsAppShare = () => {
    if (!inviteText) return;
    const url = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;
    window.open(url, "_blank");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };




  const content = (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar fornecedores..." 
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex border rounded-md overflow-hidden bg-background">
              <Button 
                variant={viewMode === "table" ? "secondary" : "ghost"} 
                size="icon" 
                className="h-10 w-10 rounded-none border-r"
                onClick={() => setViewMode("table")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button 
                variant={viewMode === "cards" ? "secondary" : "ghost"} 
                size="icon" 
                className="h-10 w-10 rounded-none"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setGeneratedInvite(null);
                setInviteDialogOpen(true);
              }} 
              className="h-10 px-4"
            >
              <Share2 className="w-4 h-4 mr-2" /> Convidar Fornecedor
            </Button>
            <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground h-10 px-4">
              <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border border-dashed border-stone-300">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-medium">Nenhum fornecedor encontrado</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">
              {searchTerm ? "Tente mudar os termos da busca." : "Comece cadastrando seu primeiro fornecedor da agência."}
            </p>
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-semibold">{s.company_name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.cnpj}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {s.contacts && s.contacts.length > 0 
                          ? `${s.contacts[0].nome}${s.contacts[0].funcao ? ` (${s.contacts[0].funcao})` : ""}`
                          : s.contact_name || "Sem contato"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {(s.contacts?.[0]?.telefone || s.phone) && <Phone className="w-3 h-3 text-muted-foreground" />}
                        {(s.contacts?.[0]?.email || s.email) && <Mail className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(s.services as string[]).slice(0, 3).map((service, i) => (
                          <span key={i} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
                            {service}
                          </span>
                        ))}
                        {(s.services as string[]).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{(s.services as string[]).length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailsSupplier(s)} title="Ver detalhes / enviar e-mail de confirmação">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(s)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Fornecedor?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O fornecedor {s.company_name} será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteSupplier.mutate(s.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((s) => (
              <div key={s.id} className="bg-card p-5 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{s.company_name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{s.cnpj}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailsSupplier(s)} title="Ver detalhes / enviar e-mail">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(s)}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="font-medium">
                      {s.contacts && s.contacts.length > 0 
                        ? `${s.contacts[0].nome}${s.contacts[0].funcao ? ` (${s.contacts[0].funcao})` : ""}`
                        : s.contact_name || "Sem contato"}
                    </span>
                  </div>
                  {(s.contacts?.[0]?.telefone || s.contacts?.[0]?.whatsapp || s.phone || s.whatsapp) && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span>{s.contacts?.[0]?.telefone || s.contacts?.[0]?.whatsapp || s.phone || s.whatsapp}</span>
                    </div>
                  )}
                  {(s.contacts?.[0]?.email || s.email) && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="truncate">{s.contacts?.[0]?.email || s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="line-clamp-2">{s.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Serviços</p>
                  <div className="flex flex-wrap gap-1">
                    {(s.services as string[]).map((service, i) => (
                      <span key={i} className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <SupplierFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          agencyId={agencyId}
          editingSupplier={editingSupplier}
        />


        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Convidar Fornecedor</DialogTitle>
            </DialogHeader>
            
            {!generatedInvite ? (
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>Link válido por quantos dias?</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={90} 
                    value={inviteDays} 
                    onChange={e => setInviteDays(parseInt(e.target.value) || 7)} 
                  />
                  <p className="text-[10px] text-muted-foreground">Mínimo 1 dia, máximo 90 dias.</p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleGenerateInvite} 
                  disabled={generatingInvite}
                >
                  {generatingInvite && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gerar Link
                </Button>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>URL do Convite</Label>
                  <div className="flex gap-2">
                    <Input value={generatedInvite.url} readOnly />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedInvite.url)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Expira em {format(generatedInvite.expiresAt, "dd/MM/yyyy HH:mm")}</p>
                </div>

                <div className="space-y-2">
                  <Label>Texto para WhatsApp</Label>
                  <div className="bg-muted p-3 rounded-md text-xs whitespace-pre-wrap border italic">
                    {inviteText}
                  </div>
                </div>

                <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleWhatsAppShare}>
                  <MessageSquare className="w-4 h-4 mr-2" /> Enviar via WhatsApp
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <SupplierDetailsSheet
          open={!!detailsSupplier}
          onOpenChange={(o) => !o && setDetailsSupplier(null)}
          supplier={detailsSupplier}
        />
      </div>

  );


  return (
    <AppLayout
      breadcrumbs={[
        { label: agencyInfo?.name || "Agência", href: `/agency/${agencyId}` },
        { label: "Fornecedores" },
      ]}
    >
      {content}
    </AppLayout>
  );
};

const User = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default AgencySuppliers;
