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
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, Search, Megaphone, Store, Settings, Edit3, Download, Sparkles } from "lucide-react";
import { exportClientStores, exportCampaigns, parseCampaignsImport } from "@/lib/exportMultiClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Helper to parse "Label|type" format from custom field labels
const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Sim/Não" },
] as const;

type FieldType = typeof FIELD_TYPES[number]["value"];

function parseFieldLabel(raw: string | null): { name: string; type: FieldType } {
  if (!raw) return { name: "", type: "text" };
  const parts = raw.split("|");
  const type = (parts[1] as FieldType) || "text";
  return { name: parts[0], type: FIELD_TYPES.some(t => t.value === type) ? type : "text" };
}

function encodeFieldLabel(name: string, type: FieldType): string {
  if (!name.trim()) return "";
  return type === "text" ? name.trim() : `${name.trim()}|${type}`;
}
import { toast } from "sonner";
import * as XLSX from "xlsx";

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
  return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const emptyStoreForm = {
  name: "", nickname: "", cnpj: "", state_registration: "",
  zip_code: "", street: "", number: "", complement: "", neighborhood: "",
  city: "", state: "", phone: "", manager_name: "",
  store_model: "", country: "", store_code: "",
  custom_field_1: "", custom_field_2: "", custom_field_3: "", custom_field_4: "", custom_field_5: "",
  observations: "",
};

function generateStoreCode(clientName: string, country: string, existingStores: { store_code: string | null }[]): string {
  const clientPart = (clientName || "XXX").replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
  const countryPart = (country || "BRA").replace(/[^a-zA-Z0-9]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
  const prefix = `${clientPart}${countryPart}`;
  // Collect all existing sequential numbers for this prefix
  const usedNumbers = new Set<number>();
  existingStores.forEach((s) => {
    if (s.store_code && s.store_code.startsWith(prefix)) {
      const numPart = parseInt(s.store_code.substring(prefix.length));
      if (!isNaN(numPart)) usedNumbers.add(numPart);
    }
  });
  // Find the lowest available number starting from 1
  let seq = 1;
  while (usedNumbers.has(seq)) seq++;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

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
    const formData = { ...storeForm };
    if (!formData.store_code && client) {
      formData.store_code = generateStoreCode(client.name, formData.country, stores);
    }
    await addStore.mutateAsync({ client_id: clientId, ...formData });
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
      store_model: store.store_model || "",
      country: store.country || "",
      store_code: store.store_code || "",
      custom_field_1: store.custom_field_1 || "",
      custom_field_2: store.custom_field_2 || "",
      custom_field_3: store.custom_field_3 || "",
      custom_field_4: store.custom_field_4 || "",
      custom_field_5: store.custom_field_5 || "",
      observations: (store as any).observations || "",
    });
    setEditStoreDialogOpen(true);
  };

  const handleEditStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreId) return;
    const formData = { ...editStoreForm };
    if (!formData.store_code && client) {
      formData.store_code = generateStoreCode(client.name, formData.country, stores);
    }
    await updateStore.mutateAsync({ id: editStoreId, ...formData });
    setEditStoreDialogOpen(false);
    setEditStoreId(null);
  };

  const handleReviewStoreCodes = async () => {
    if (!client) return;
    const storesWithoutCode = stores.filter((s) => !s.store_code);
    if (storesWithoutCode.length === 0) {
      toast.info("Todas as lojas já possuem código.");
      return;
    }
    // Build a running list of all codes (existing + newly assigned)
    const allStores = [...stores];
    let count = 0;
    for (const store of storesWithoutCode) {
      const code = generateStoreCode(client.name, store.country || "", allStores);
      await updateStore.mutateAsync({ id: store.id, store_code: code });
      // Update allStores so next iteration sees this code
      const idx = allStores.findIndex((s) => s.id === store.id);
      if (idx >= 0) allStores[idx] = { ...allStores[idx], store_code: code };
      count++;
    }
    toast.success(`${count} loja(s) receberam código automaticamente.`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
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
          state_registration: r["inscricao_estadual"] || r["Inscricao Estadual"] || r["IE"] || r["Inscrição Estadual"] || null,
          zip_code: r["cep"] || r["CEP"] || null,
          street: r["rua"] || r["Rua"] || r["logradouro"] || r["Logradouro"] || null,
          number: r["numero"] || r["Numero"] || r["Número"] || null,
          complement: r["complemento"] || r["Complemento"] || null,
          neighborhood: r["bairro"] || r["Bairro"] || null,
          phone: r["telefone"] || r["Telefone"] || r["phone"] || null,
          manager_name: r["gerente"] || r["Gerente"] || r["responsavel"] || r["Responsavel"] || null,
          country: r["país"] || r["País"] || r["pais"] || r["country"] || null,
          store_model: r["modelo de loja"] || r["Modelo de Loja"] || r["store_model"] || null,
          store_code: r["código da loja"] || r["Código da Loja"] || r["store_code"] || null,
        })).filter((s) => s.name);
        if (mapped.length === 0) {
          toast.error("Nenhuma loja encontrada na planilha.");
          return;
        }
        let added = 0, updated = 0;
        for (const item of mapped) {
          const existing = stores.find(s => s.name.toLowerCase() === item.name.toLowerCase());
          if (existing) {
            await updateStore.mutateAsync({ id: existing.id, ...item });
            updated++;
          } else {
            await addStore.mutateAsync(item);
            added++;
          }
        }
        toast.success(`${added} adicionada(s), ${updated} atualizada(s)!`);
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

  const customFieldLabelsRaw = [
    client?.custom_field_1_label,
    client?.custom_field_2_label,
    client?.custom_field_3_label,
    client?.custom_field_4_label,
    client?.custom_field_5_label,
  ];
  const customFieldsParsed = customFieldLabelsRaw.map(parseFieldLabel);

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
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
          <Input value={form.name} onChange={(e) => options?.nameChangeHandler ? options.nameChangeHandler(e.target.value) : setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Apelido</label>
          <Input value={form.nickname} onChange={(e) => options?.nicknameChangeHandler ? options.nicknameChangeHandler(e.target.value) : setForm((f) => ({ ...f, nickname: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
          <Input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Inscrição Estadual</label>
          <Input value={form.state_registration} onChange={(e) => setForm((f) => ({ ...f, state_registration: e.target.value }))} />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">CEP</label>
            <Input value={formatCep(form.zip_code)} onChange={(e) => setForm((f) => ({ ...f, zip_code: formatCep(e.target.value) }))} placeholder="00000-000" maxLength={9} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => handleCepLookup(form, setForm)}>Buscar</Button>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Rua</label>
          <Input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Número</label>
          <Input value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Complemento</label>
          <Input value={form.complement} onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bairro</label>
          <Input value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cidade</label>
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Estado</label>
          <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
          <Input value={formatPhone(form.phone)} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="(00)00000-0000" maxLength={14} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Gerente Responsável</label>
          <Input value={form.manager_name} onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">País</label>
          <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Ex: Brasil" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo de Loja</label>
          <Input value={form.store_model} onChange={(e) => setForm((f) => ({ ...f, store_model: e.target.value }))} placeholder="Ex: Premium" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Código da Loja</label>
          <Input value={form.store_code} onChange={(e) => setForm((f) => ({ ...f, store_code: e.target.value }))} placeholder="Gerado automaticamente" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={form.observations}
            onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
            placeholder="Observações sobre a loja..."
          />
        </div>
      </div>

      {customFieldsParsed.some(f => f.name) && (
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-medium text-foreground">Campos Personalizados</p>
          {customFieldsParsed.map((field, i) =>
            field.name ? (
              <div key={i}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.name}</label>
                {field.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(form as any)[`custom_field_${i + 1}`] === "true"}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, [`custom_field_${i + 1}`]: checked ? "true" : "false" }))}
                    />
                    <span className="text-sm text-muted-foreground">{(form as any)[`custom_field_${i + 1}`] === "true" ? "Sim" : "Não"}</span>
                  </div>
                ) : (
                  <Input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={(form as any)[`custom_field_${i + 1}`]}
                    onChange={(e) => setForm((f) => ({ ...f, [`custom_field_${i + 1}`]: e.target.value }))}
                  />
                )}
              </div>
            ) : null
          )}
        </div>
      )}
    </>
  );

   return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary flex-shrink-0">
            <span className="text-white font-bold text-lg">{client.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{client.name}</h1>
            <p className="text-xs text-muted-foreground">{campaigns.length} campanha(s) · {stores.length} loja(s)</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6 bg-card border border-border">
            <TabsTrigger value="campaigns" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><Megaphone className="w-4 h-4" /> Campanhas</TabsTrigger>
            <TabsTrigger value="stores" className="gap-1.5 data-[state=active]:bg-secondary/10 data-[state=active]:text-secondary"><Store className="w-4 h-4" /> Lojas</TabsTrigger>
          </TabsList>

          {/* ─── Campaigns Tab ─── */}
          <TabsContent value="campaigns">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{campaigns.length}</p>
                  <p className="text-[11px] text-muted-foreground">Campanhas</p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-secondary flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stores.length}</p>
                  <p className="text-[11px] text-muted-foreground">Lojas</p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-4 col-span-2 sm:col-span-1">
                <p className="text-xs font-semibold text-foreground mb-2">Ações</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => exportCampaigns(campaigns, client.name)}>
                    <Download className="w-3 h-3" /> Exportar
                  </Button>
                  {isAdmin && (
                    <>
                      <label className="cursor-pointer">
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !clientId) return;
                          try {
                            const items = await parseCampaignsImport(file);
                            if (items.length === 0) { toast.error("Nenhuma campanha encontrada."); return; }
                            let added = 0, updated = 0;
                            for (const item of items) {
                              const existing = campaigns.find(c => c.name.toLowerCase() === item.name.toLowerCase());
                              if (existing) { updated++; } else {
                                await addCampaign.mutateAsync({ client_id: clientId, name: item.name });
                                added++;
                              }
                            }
                            toast.success(`${added} adicionada(s), ${updated} já existente(s)!`);
                          } catch { toast.error("Erro ao importar."); }
                          e.target.value = "";
                        }} />
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" asChild>
                          <span><Upload className="w-3 h-3" /> Importar</span>
                        </Button>
                      </label>
                      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="text-xs h-7 gap-1 gradient-primary text-white border-0">
                            <Plus className="w-3 h-3" /> Nova
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
                          <form onSubmit={handleAddCampaign} className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da campanha *</label>
                              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
                            </div>
                            <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={addCampaign.isPending}>Criar</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </div>
            </div>

            {loadingCampaigns ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow-primary">
                  <Megaphone className="w-8 h-8 text-white" />
                </div>
                <p className="text-muted-foreground text-sm">Nenhuma campanha cadastrada.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c, i) => {
                  const CAMP_COLORS = [
                    "from-primary/10 to-primary/5 border-primary/20",
                    "from-secondary/10 to-secondary/5 border-secondary/20",
                    "from-accent/10 to-accent/5 border-accent/20",
                    "from-info/10 to-info/5 border-info/20",
                  ];
                  const CAMP_ICONS = ["gradient-primary", "gradient-secondary", "gradient-accent", "bg-info"];
                  const cidx = i % CAMP_COLORS.length;
                  return (
                    <div
                      key={c.id}
                      className={`group bg-gradient-to-br ${CAMP_COLORS[cidx]} border rounded-xl p-4 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden`}
                      onClick={() => navigate(`/clients/${clientId}/campaigns/${c.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg ${CAMP_ICONS[cidx]} flex items-center justify-center shadow-md flex-shrink-0`}>
                          <Megaphone className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors truncate">{c.name}</h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Tem certeza que deseja excluir esta campanha?</AlertDialogTitle>
                                <AlertDialogDescription>Todos os dados associados a esta campanha serão apagados permanentemente, incluindo peças, quantidades por loja e configurações. Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteCampaign.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">SIM</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        <span>Acessar</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Stores Tab ─── */}
          <TabsContent value="stores">
            {/* Stats + Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-secondary flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stores.length}</p>
                  <p className="text-[11px] text-muted-foreground">Lojas</p>
                </div>
              </div>
              <div className="bg-gradient-to-br from-info/10 to-info/5 border border-info/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <Input placeholder="Buscar loja..." value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-4 col-span-2 sm:col-span-1">
                <p className="text-xs font-semibold text-foreground mb-2">Ações</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => exportClientStores(stores, client.name)}>
                    <Download className="w-3 h-3" /> Exportar
                  </Button>
                  {isAdmin && (
                    <>
                      <label className="cursor-pointer">
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" asChild>
                          <span><Upload className="w-3 h-3" /> Importar</span>
                        </Button>
                      </label>
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleReviewStoreCodes}>
                        <Sparkles className="w-3 h-3" /> Códigos
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setCustomLabels({
                      custom_field_1_label: client.custom_field_1_label || "",
                      custom_field_2_label: client.custom_field_2_label || "",
                      custom_field_3_label: client.custom_field_3_label || "",
                      custom_field_4_label: client.custom_field_4_label || "",
                      custom_field_5_label: client.custom_field_5_label || "",
                    })}>
                      <Settings className="w-3.5 h-3.5" /> Campos
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Campos Personalizáveis</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground mb-4">Defina os nomes dos campos extras para as lojas deste cliente. Campos sem nome não serão exibidos.</p>
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const parsed = parseFieldLabel((customLabels as any)[`custom_field_${i}_label`]);
                        return (
                          <div key={i} className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground block">Campo {i}</label>
                            <div className="flex gap-2">
                              <Input
                                className="flex-1"
                                placeholder={`Ex: Tipo de Piso`}
                                value={parsed.name}
                                onChange={(e) => setCustomLabels((l) => ({ ...l, [`custom_field_${i}_label`]: encodeFieldLabel(e.target.value, parsed.type) }))}
                              />
                              <Select
                                value={parsed.type}
                                onValueChange={(val) => setCustomLabels((l) => ({ ...l, [`custom_field_${i}_label`]: encodeFieldLabel(parsed.name, val as FieldType) }))}
                              >
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_TYPES.map(ft => (
                                    <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button onClick={handleSaveSettings} className="w-full mt-4" disabled={updateClient.isPending}>Salvar</Button>
                  </DialogContent>
                </Dialog>

                <Dialog open={storeDialogOpen} onOpenChange={(open) => {
                  setStoreDialogOpen(open);
                  if (!open) {
                    setStoreForm({ ...emptyStoreForm });
                    nicknameTouchedRef.current = false;
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1 text-xs gradient-secondary text-white border-0">
                      <Plus className="w-3.5 h-3.5" /> Nova Loja
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nova Loja</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddStore} className="space-y-4">
                      {renderStoreFormFields(storeForm, setStoreForm, {
                        nameChangeHandler: handleNameChange,
                        nicknameChangeHandler: handleNicknameChange,
                      })}
                      <Button type="submit" className="w-full gradient-secondary text-white border-0" disabled={addStore.isPending}>Adicionar Loja</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={editStoreDialogOpen} onOpenChange={setEditStoreDialogOpen}>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Editar Loja</DialogTitle></DialogHeader>
                    <form onSubmit={handleEditStore} className="space-y-4">
                      {renderStoreFormFields(editStoreForm, setEditStoreForm)}
                      <Button type="submit" className="w-full" disabled={updateStore.isPending}>Salvar Alterações</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

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
                       <TableHead>Código</TableHead>
                       <TableHead>Cidade</TableHead>
                       <TableHead>UF</TableHead>
                       <TableHead>Modelo</TableHead>
                       <TableHead>Telefone</TableHead>
                      <TableHead>Gerente</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                            onClick={() => handleOpenEditStore(s)}
                          >
                            {s.name}
                          </button>
                        </TableCell>
                        <TableCell>{s.nickname || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{s.store_code || "—"}</TableCell>
                        <TableCell>{s.city || "—"}</TableCell>
                        <TableCell>{s.state || "—"}</TableCell>
                        <TableCell className="text-xs">{s.store_model || "—"}</TableCell>
                        <TableCell className="text-xs">{s.phone ? formatPhone(s.phone) : "—"}</TableCell>
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
