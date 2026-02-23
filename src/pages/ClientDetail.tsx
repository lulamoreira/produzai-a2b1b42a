import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useClient, useCampaigns, useAddCampaign, useDeleteCampaign,
  useClientStores, useAddClientStore, useImportClientStores, useDeleteClientStore,
  useUpdateClient, useUpdateClientStore, fetchAddressByCep,
  type ClientStore,
} from "@/hooks/useMultiClientData";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Upload, Search, Megaphone, Store, Settings, Edit3 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const emptyStoreForm = {
  name: "", nickname: "", cnpj: "", state_registration: "",
  zip_code: "", street: "", number: "", complement: "", neighborhood: "",
  city: "", state: "", phone: "", manager_name: "",
  custom_field_1: "", custom_field_2: "", custom_field_3: "", custom_field_4: "", custom_field_5: "",
};

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { data: client, isLoading: loadingClient } = useClient(clientId);
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns(clientId);
  const { data: stores = [], isLoading: loadingStores } = useClientStores(clientId);
  const addCampaign = useAddCampaign();
  const deleteCampaign = useDeleteCampaign();
  const addStore = useAddClientStore();
  const importStores = useImportClientStores();
  const deleteStore = useDeleteClientStore();
  const updateClient = useUpdateClient();
  const updateStore = useUpdateClientStore();

  const [campaignName, setCampaignName] = useState("");
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Store form
  const [storeForm, setStoreForm] = useState({ ...emptyStoreForm });
  const nicknameTouchedRef = useRef(false);

  // Edit store
  const [editStoreDialogOpen, setEditStoreDialogOpen] = useState(false);
  const [editStoreForm, setEditStoreForm] = useState({ ...emptyStoreForm });
  const [editStoreId, setEditStoreId] = useState<string | null>(null);

  // Custom field labels
  const [customLabels, setCustomLabels] = useState({
    custom_field_1_label: client?.custom_field_1_label || "",
    custom_field_2_label: client?.custom_field_2_label || "",
    custom_field_3_label: client?.custom_field_3_label || "",
    custom_field_4_label: client?.custom_field_4_label || "",
    custom_field_5_label: client?.custom_field_5_label || "",
  });

  const handleNameChange = (value: string) => {
    setStoreForm((f) => ({
      ...f,
      name: value,
      ...(nicknameTouchedRef.current ? {} : { nickname: value }),
    }));
  };

  const handleNicknameChange = (value: string) => {
    nicknameTouchedRef.current = true;
    setStoreForm((f) => ({ ...f, nickname: value }));
  };

  const handleCepLookup = async (form: typeof storeForm, setForm: typeof setStoreForm) => {
    const address = await fetchAddressByCep(form.zip_code);
    if (address) {
      setForm((f) => ({ ...f, ...address }));
      toast.success("Endereço preenchido!");
    } else {
      toast.error("CEP não encontrado.");
    }
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !campaignName.trim()) return;
    await addCampaign.mutateAsync({ client_id: clientId, name: campaignName.trim() });
    setCampaignName("");
    setCampaignDialogOpen(false);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    await addStore.mutateAsync({ client_id: clientId, ...storeForm });
    setStoreForm({ ...emptyStoreForm });
    nicknameTouchedRef.current = false;
    setStoreDialogOpen(false);
  };

  const handleOpenEditStore = (store: ClientStore) => {
    setEditStoreId(store.id);
    setEditStoreForm({
      name: store.name || "",
      nickname: store.nickname || "",
      cnpj: store.cnpj || "",
      state_registration: store.state_registration || "",
      zip_code: store.zip_code || "",
      street: store.street || "",
      number: store.number || "",
      complement: store.complement || "",
      neighborhood: store.neighborhood || "",
      city: store.city || "",
      state: store.state || "",
      phone: store.phone || "",
      manager_name: store.manager_name || "",
      custom_field_1: store.custom_field_1 || "",
      custom_field_2: store.custom_field_2 || "",
      custom_field_3: store.custom_field_3 || "",
      custom_field_4: store.custom_field_4 || "",
      custom_field_5: store.custom_field_5 || "",
    });
    setEditStoreDialogOpen(true);
  };

  const handleEditStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreId) return;
    await updateStore.mutateAsync({ id: editStoreId, ...editStoreForm });
    setEditStoreDialogOpen(false);
    setEditStoreId(null);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        const mapped = rows.map((r) => ({
          client_id: clientId,
          name: r["nome"] || r["Nome"] || r["name"] || "",
          nickname: r["apelido"] || r["Apelido"] || r["nickname"] || null,
          city: r["cidade"] || r["Cidade"] || r["city"] || null,
          state: r["estado"] || r["Estado"] || r["uf"] || r["UF"] || null,
          cnpj: r["cnpj"] || r["CNPJ"] || null,
          state_registration: r["inscricao_estadual"] || r["Inscricao Estadual"] || r["IE"] || null,
          zip_code: r["cep"] || r["CEP"] || null,
          street: r["rua"] || r["Rua"] || r["logradouro"] || r["Logradouro"] || null,
          number: r["numero"] || r["Numero"] || r["Número"] || null,
          complement: r["complemento"] || r["Complemento"] || null,
          neighborhood: r["bairro"] || r["Bairro"] || null,
          phone: r["telefone"] || r["Telefone"] || r["phone"] || null,
          manager_name: r["gerente"] || r["Gerente"] || r["responsavel"] || r["Responsavel"] || null,
        })).filter((s) => s.name);
        if (mapped.length === 0) {
          toast.error("Nenhuma loja encontrada na planilha.");
          return;
        }
        importStores.mutate(mapped);
      } catch {
        toast.error("Erro ao ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleSaveSettings = async () => {
    if (!clientId) return;
    await updateClient.mutateAsync({ id: clientId, ...customLabels });
    setSettingsOpen(false);
  };

  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
    s.nickname?.toLowerCase().includes(storeSearch.toLowerCase()) ||
    s.city?.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const customFieldLabels = [
    client?.custom_field_1_label,
    client?.custom_field_2_label,
    client?.custom_field_3_label,
    client?.custom_field_4_label,
    client?.custom_field_5_label,
  ];

  if (loadingClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  const renderStoreFormFields = (
    form: typeof storeForm,
    setForm: typeof setStoreForm,
    options?: { nameChangeHandler?: (v: string) => void; nicknameChangeHandler?: (v: string) => void }
  ) => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input
          placeholder="Nome *"
          value={form.name}
          onChange={(e) => options?.nameChangeHandler ? options.nameChangeHandler(e.target.value) : setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <Input
          placeholder="Apelido"
          value={form.nickname}
          onChange={(e) => options?.nicknameChangeHandler ? options.nicknameChangeHandler(e.target.value) : setForm((f) => ({ ...f, nickname: e.target.value }))}
        />
        <Input placeholder="CNPJ" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
        <Input placeholder="Inscrição Estadual" value={form.state_registration} onChange={(e) => setForm((f) => ({ ...f, state_registration: e.target.value }))} />
        <div className="flex gap-2">
          <Input placeholder="CEP" value={form.zip_code} onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))} />
          <Button type="button" variant="outline" size="sm" onClick={() => handleCepLookup(form, setForm)}>Buscar</Button>
        </div>
        <Input placeholder="Rua" value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
        <Input placeholder="Número" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
        <Input placeholder="Complemento" value={form.complement} onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))} />
        <Input placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
        <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        <Input placeholder="Estado" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <Input placeholder="Gerente Responsável" value={form.manager_name} onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))} className="col-span-2" />
      </div>

      {customFieldLabels.some(Boolean) && (
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-medium text-foreground">Campos Personalizados</p>
          {customFieldLabels.map((label, i) =>
            label ? (
              <Input
                key={i}
                placeholder={label}
                value={(form as any)[`custom_field_${i + 1}`]}
                onChange={(e) => setForm((f) => ({ ...f, [`custom_field_${i + 1}`]: e.target.value }))}
              />
            ) : null
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">{client.name}</h1>
          </div>
          {isAdmin && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setCustomLabels({
                  custom_field_1_label: client.custom_field_1_label || "",
                  custom_field_2_label: client.custom_field_2_label || "",
                  custom_field_3_label: client.custom_field_3_label || "",
                  custom_field_4_label: client.custom_field_4_label || "",
                  custom_field_5_label: client.custom_field_5_label || "",
                })}>
                  <Settings className="w-4 h-4 mr-1" /> Campos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Campos Personalizáveis</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground mb-4">Defina os nomes dos campos extras para as lojas deste cliente. Campos sem nome não serão exibidos.</p>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Input
                      key={i}
                      placeholder={`Campo personalizado ${i} (ex: Tipo de Piso)`}
                      value={(customLabels as any)[`custom_field_${i}_label`]}
                      onChange={(e) => setCustomLabels((l) => ({ ...l, [`custom_field_${i}_label`]: e.target.value }))}
                    />
                  ))}
                </div>
                <Button onClick={handleSaveSettings} className="w-full mt-4" disabled={updateClient.isPending}>Salvar</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6">
            <TabsTrigger value="campaigns" className="gap-1"><Megaphone className="w-4 h-4" /> Campanhas</TabsTrigger>
            <TabsTrigger value="stores" className="gap-1"><Store className="w-4 h-4" /> Lojas</TabsTrigger>
          </TabsList>

          {/* ─── Campaigns Tab ─── */}
          <TabsContent value="campaigns">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-foreground">{campaigns.length} campanha(s)</h2>
              {isAdmin && (
                <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Campanha</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddCampaign} className="space-y-4">
                      <Input placeholder="Nome da campanha" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
                      <Button type="submit" className="w-full" disabled={addCampaign.isPending}>Criar</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {loadingCampaigns ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16">
                <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma campanha cadastrada.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="group bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer relative"
                    onClick={() => navigate(`/clients/${clientId}/campaigns/${c.id}`)}
                  >
                    <h3 className="font-display font-bold text-foreground group-hover:text-primary transition-colors">{c.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                            <AlertDialogDescription>Todos os dados desta campanha serão removidos.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCampaign.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Stores Tab ─── */}
          <TabsContent value="stores">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar loja..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="pl-10" />
              </div>
              <span className="text-sm text-muted-foreground">{stores.length} loja(s)</span>
              {isAdmin && (
                <>
                  <Dialog open={storeDialogOpen} onOpenChange={(open) => {
                    setStoreDialogOpen(open);
                    if (!open) {
                      setStoreForm({ ...emptyStoreForm });
                      nicknameTouchedRef.current = false;
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Loja</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Nova Loja</DialogTitle></DialogHeader>
                      <form onSubmit={handleAddStore} className="space-y-4">
                        {renderStoreFormFields(storeForm, setStoreForm, {
                          nameChangeHandler: handleNameChange,
                          nicknameChangeHandler: handleNicknameChange,
                        })}
                        <Button type="submit" className="w-full" disabled={addStore.isPending}>Adicionar Loja</Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Store Dialog */}
                  <Dialog open={editStoreDialogOpen} onOpenChange={setEditStoreDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>Editar Loja</DialogTitle></DialogHeader>
                      <form onSubmit={handleEditStore} className="space-y-4">
                        {renderStoreFormFields(editStoreForm, setEditStoreForm)}
                        <Button type="submit" className="w-full" disabled={updateStore.isPending}>Salvar Alterações</Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <label className="cursor-pointer">
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                    <Button size="sm" variant="outline" asChild>
                      <span><Upload className="w-4 h-4 mr-1" /> Importar Planilha</span>
                    </Button>
                  </label>
                </>
              )}
            </div>

            {loadingStores ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-16">
                <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma loja cadastrada.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Apelido</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Gerente</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.nickname || "—"}</TableCell>
                        <TableCell>{s.city || "—"}</TableCell>
                        <TableCell>{s.state || "—"}</TableCell>
                        <TableCell className="text-xs">{s.cnpj || "—"}</TableCell>
                        <TableCell className="text-xs">{s.phone || "—"}</TableCell>
                        <TableCell className="text-xs">{s.manager_name || "—"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEditStore(s)}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir loja?</AlertDialogTitle>
                                    <AlertDialogDescription>A loja será removida de todas as campanhas.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteStore.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ClientDetail;
