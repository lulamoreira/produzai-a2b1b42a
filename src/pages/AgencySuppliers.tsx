import { useState, useMemo } from "react";
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
  type AgencySupplier
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
  Building2
} from "lucide-react";
import { toast } from "sonner";

const AgencySuppliers = () => {
  const { user } = useAuth();
  
  // Fetch agency ID
  const { data: agencyId } = useQuery({
    queryKey: ["user_agency_id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data?.agency_id;
    },
    enabled: !!user,
  });

  const { data: suppliers = [], isLoading } = useAgencySuppliers(agencyId);
  const addSupplier = useAddAgencySupplier();
  const updateSupplier = useUpdateAgencySupplier();
  const deleteSupplier = useDeleteAgencySupplier();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<AgencySupplier | null>(null);
  
  const [form, setForm] = useState({
    company_name: "",
    cnpj: "",
    contact_name: "",
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    observations: "",
    services: [] as string[],
    custom_service: "",
    file_urls: [] as { name: string; url: string }[],
  });

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
    setForm({
      company_name: "",
      cnpj: "",
      contact_name: "",
      address: "",
      phone: "",
      whatsapp: "",
      email: "",
      website: "",
      observations: "",
      services: [],
      custom_service: "",
      file_urls: [],
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (s: AgencySupplier) => {
    setEditingSupplier(s);
    setForm({
      company_name: s.company_name,
      cnpj: s.cnpj || "",
      contact_name: s.contact_name || "",
      address: s.address || "",
      phone: s.phone || "",
      whatsapp: s.whatsapp || "",
      email: s.email || "",
      website: s.website || "",
      observations: s.observations || "",
      services: (s.services as string[]) || [],
      custom_service: "",
      file_urls: (s.file_urls as { name: string; url: string }[]) || [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;

    const finalServices = [...form.services];
    if (form.custom_service.trim()) {
      finalServices.push(form.custom_service.trim());
    }

    const payload = {
      agency_id: agencyId,
      company_name: form.company_name,
      cnpj: form.cnpj || null,
      contact_name: form.contact_name || null,
      address: form.address || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      website: form.website || null,
      observations: form.observations || null,
      services: finalServices,
      file_urls: form.file_urls,
    };

    if (editingSupplier) {
      await updateSupplier.mutateAsync({ id: editingSupplier.id, ...payload });
    } else {
      await addSupplier.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const toggleService = (service: string) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(service)
        ? f.services.filter(s => s !== service)
        : [...f.services, service]
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `suppliers/${agencyId}/${Date.now()}-${file.name}`;
      
      const { data, error } = await supabase.storage
        .from("supplier_files")
        .upload(filePath, file);

      if (error) {
        toast.error(`Erro ao enviar arquivo: ${file.name}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("supplier_files")
        .getPublicUrl(filePath);

      setForm(f => ({
        ...f,
        file_urls: [...f.file_urls, { name: file.name, url: publicUrl }]
      }));
    }
    toast.success("Arquivos enviados!");
  };

  const removeFile = (index: number) => {
    setForm(f => ({
      ...f,
      file_urls: f.file_urls.filter((_, i) => i !== index)
    }));
  };

  return (
    <AppLayout title="Fornecedores" breadcrumbs={[{ label: "Administração" }, { label: "Fornecedores" }]}>
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
          <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground h-10 px-4">
            <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
          </Button>
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
                      <div className="text-sm">{s.contact_name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {s.phone && <Phone className="w-3 h-3 text-muted-foreground" />}
                        {s.email && <Mail className="w-3 h-3 text-muted-foreground" />}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(s)}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>{s.contact_name || "Sem contato"}</span>
                  </div>
                  {(s.phone || s.whatsapp) && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span>{s.phone || s.whatsapp}</span>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="truncate">{s.email}</span>
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nome da Empresa *</Label>
                    <Input 
                      id="company_name" 
                      required 
                      value={form.company_name}
                      onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input 
                      id="cnpj" 
                      value={form.cnpj}
                      onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">Nome do Contato</Label>
                    <Input 
                      id="contact_name" 
                      value={form.contact_name}
                      onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input 
                        id="phone" 
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input 
                        id="whatsapp" 
                        value={form.whatsapp}
                        onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço Completo</Label>
                    <Input 
                      id="address" 
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Serviços Oferecidos</Label>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 border rounded-md p-3 max-h-[220px] overflow-y-auto bg-muted/30">
                      {VISUAL_COMMUNICATION_SERVICES.map((s) => (
                        <div key={s} className="flex items-center gap-2">
                          <Checkbox 
                            id={`service-${s}`} 
                            checked={form.services.includes(s)}
                            onCheckedChange={() => toggleService(s)}
                          />
                          <Label htmlFor={`service-${s}`} className="text-xs font-normal cursor-pointer line-clamp-1">{s}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Label htmlFor="custom_service" className="text-[10px] text-muted-foreground">Outro serviço (separar por vírgula se mais de um)</Label>
                      <Input 
                        id="custom_service" 
                        placeholder="Ex: Drone, Brindes..."
                        value={form.custom_service}
                        onChange={e => setForm(f => ({ ...f, custom_service: e.target.value }))}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Arquivos e Anexos</Label>
                    <div 
                      className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Arraste ou clique para enviar arquivos (PDF, Imagens, Documentos)</p>
                      <input 
                        id="file-upload" 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={handleFileUpload}
                      />
                    </div>
                    {form.file_urls.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {form.file_urls.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded text-xs border">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{file.name}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(i)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="observations">Observações</Label>
                <Textarea 
                  id="observations" 
                  placeholder="Informações adicionais sobre o fornecedor..."
                  className="min-h-[100px]"
                  value={form.observations}
                  onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pb-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={addSupplier.isPending || updateSupplier.isPending}>
                  {editingSupplier ? "Salvar Alterações" : "Cadastrar Fornecedor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
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
