import { useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useClient, useCampaigns, useAddCampaign, useDeleteCampaign, useUpdateCampaign, useReorderCampaigns,
  useClientStores, useAddClientStore, useImportClientStores, useDeleteClientStore,
  useUpdateClient, useUpdateClientStore, fetchAddressByCep, fetchCnpjData,
  useClientStoreModels, useAddClientStoreModel, useDeleteClientStoreModel,
  type ClientStore, type Campaign,
} from "@/hooks/useMultiClientData";
import { useClientPermission } from "@/hooks/useClientPermission";
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
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, Search, Megaphone, Store, Settings, Edit3, Download, Sparkles, MessageSquare, Tag, RefreshCw, Mail, GripVertical, Palette, ArrowUp, ArrowDown, ArrowUpDown, Users } from "lucide-react";
import StoresMatrixTable from "@/components/StoresMatrixTable";
import StoreFullCardView from "@/components/StoreFullCardView";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import AppLayout from "@/components/AppLayout";
import { exportClientStores, exportCampaigns, parseCampaignsImport } from "@/lib/exportMultiClient";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ComboboxInput from "@/components/ComboboxInput";
import { getStateColor } from "@/lib/stateColors";
import StoreContactsSection from "@/components/StoreContactsSection";
import { getCountryConfig, SUPPORTED_COUNTRIES, type CountryConfig } from "@/lib/countryConfig";
import { useLanguage } from "@/hooks/useLanguage";

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
import { useTranslation } from "react-i18next";
import ChatTabContent from "@/components/ChatTabContent";
import * as XLSX from "xlsx";
import { capitalizeName } from "@/lib/utils";

/** Auto-capitalize text fields of a store form (excludes state, store_model, email, cnpj, codes) */
function capitalizeStoreFields<T extends Record<string, any>>(data: T): T {
  const CAPITALIZE_KEYS = [
    "name", "nickname", "street", "complement", "neighborhood", "city",
    "manager_name", "country", "observations",
    "custom_field_1", "custom_field_2", "custom_field_3", "custom_field_4", "custom_field_5",
  ];
  const result = { ...data };
  for (const key of CAPITALIZE_KEYS) {
    if (key in result && typeof result[key] === "string" && result[key]) {
      (result as any)[key] = capitalizeName(result[key]);
    }
  }
  // Trim state field to avoid duplicate entries (e.g. "SP" vs "SP ")
  if ("state" in result && typeof result["state"] === "string") {
    (result as any)["state"] = result["state"].trim().toUpperCase();
  }
  return result;
}

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
  store_model: "", country: "", store_code: "", email: "",
  custom_field_1: "", custom_field_2: "", custom_field_3: "", custom_field_4: "", custom_field_5: "",
  observations: "", showcase_count: "0",
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
const CAMPAIGN_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#2563eb", "#4f46e5", "#7c3aed",
  "#1e3a5f", "#334155", "#475569", "#78716c",
];

function SortableCampaignCard({
  campaign, canDelete, canEdit, onNavigate, onDelete, onColorChange,
}: {
  campaign: Campaign; canDelete: boolean; canEdit: boolean;
  onNavigate: () => void; onDelete: () => void; onColorChange: (c: string) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campaign.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as any,
  };
  const color = campaign.color || "#6366f1";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: color }}
      className="group aqua-card-colored p-4 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-white shadow-lg hover:shadow-xl"
      onClick={onNavigate}
    >
      <div className="absolute inset-0 rounded-xl" style={{ backgroundColor: color }} />
      <div className="relative z-10">
        <div className="flex items-start gap-3">
          {canEdit && (
            <button
              className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-white/70 hover:text-white transition-colors mt-1"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 aqua-icon flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.25), rgba(255,255,255,0.1))' }}>
            <Megaphone className="w-4 h-4 text-white relative z-10 drop-shadow-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm truncate">{campaign.name}</h3>
            <p className="text-[11px] text-white/70 mt-0.5">
              {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            {canEdit && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-white/70 hover:text-white hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
                    <Palette className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("clientDashboard.campaignColorLabel")}</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {CAMPAIGN_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        onClick={(e) => { e.stopPropagation(); onColorChange(c); }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0 text-white/70 hover:text-white hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("clientDashboard.deleteCampaignTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("clientDashboard.deleteCampaignDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.yes").toUpperCase()}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 text-xs text-white/70">
          <span>{t("clientDashboard.access")}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}

const ClientDetail = () => {
  const { agencyId, clientId } = useParams<{ agencyId: string; clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Permission checks replace isAdmin for granular access control
  const { hasPermission: canEditCampaigns } = useClientPermission(clientId, "can_edit_campaigns");
  const { hasPermission: canDeleteCampaigns } = useClientPermission(clientId, "can_delete_campaigns");
  const { hasPermission: canEditStores } = useClientPermission(clientId, "can_edit_stores");
  const { hasPermission: canDeleteStores } = useClientPermission(clientId, "can_delete_stores");
  const { hasPermission: canEditClients } = useClientPermission(clientId, "can_edit_clients");
  const { data: client, isLoading: loadingClient } = useClient(clientId);
  useLanguage((client as any)?.language);
  const { t } = useTranslation();
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns(clientId);

  const { data: agencyInfo } = useQuery({
    queryKey: ["agency_name", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });
  const { data: stores = [], isLoading: loadingStores } = useClientStores(clientId);
  const addCampaign = useAddCampaign();
  const deleteCampaign = useDeleteCampaign();
  const updateCampaign = useUpdateCampaign();
  const reorderCampaigns = useReorderCampaigns();
  const addStore = useAddClientStore();
  const importStores = useImportClientStores();
  const deleteStore = useDeleteClientStore();
  const updateClient = useUpdateClient();
  const updateStore = useUpdateClientStore();
  const { data: storeModels = [] } = useClientStoreModels(clientId);
  const addStoreModel = useAddClientStoreModel();
  const deleteStoreModel = useDeleteClientStoreModel();

  const [campaignName, setCampaignName] = useState("");
  const [campaignColor, setCampaignColor] = useState(CAMPAIGN_COLORS[0]);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeStateFilter, setStoreStateFilter] = useState("");
  const [storesViewMode, setStoresViewMode] = useState<"table" | "cards">("table");
  const [storeModelDialogOpen, setStoreModelDialogOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  
  const [displayOrderStores, setDisplayOrderStores] = useState<ClientStore[]>([]);

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

  // Country / currency / language
  const [countryCode, setCountryCode] = useState(client?.country_code || "BR");
  const [currencyCode, setCurrencyCode] = useState(client?.currency_code || "BRL");
  const [clientLanguage, setClientLanguage] = useState((client as any)?.language || "pt-BR");
  const countryConfig = getCountryConfig(client?.country_code);

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
  const campaignSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleCampaignDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = campaigns.findIndex((c) => c.id === active.id);
    const newIndex = campaigns.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(campaigns, oldIndex, newIndex);
    reorderCampaigns.mutate(reordered.map((c, i) => ({ id: c.id, display_order: i })));
  }, [campaigns, reorderCampaigns]);

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !campaignName.trim()) return;
    await addCampaign.mutateAsync({ client_id: clientId, name: campaignName.trim() });
    // Set color
    const { data } = await supabase.from("campaigns").select("id").eq("name", campaignName.trim()).eq("client_id", clientId).order("created_at", { ascending: false }).limit(1);
    if (data?.[0]) {
      await updateCampaign.mutateAsync({ id: data[0].id, color: campaignColor });
    }
    setCampaignName("");
    setCampaignColor(CAMPAIGN_COLORS[0]);
    setCampaignDialogOpen(false);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    const formData = capitalizeStoreFields({ ...storeForm });
    if (!formData.store_code && client) {
      formData.store_code = generateStoreCode(client.name, formData.country, stores);
    }
    // Set boolean custom fields to "false" if empty
    customFieldsParsed.forEach((cf, i) => {
      const key = `custom_field_${i + 1}` as keyof typeof formData;
      if (cf.type === "boolean" && !formData[key]) {
        (formData as any)[key] = "false";
      }
    });
    const { showcase_count: sc, ...rest } = formData as any;
    await addStore.mutateAsync({ client_id: clientId, ...rest, showcase_count: parseInt(sc, 10) || 0 });
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
      email: (store as any).email || "",
      custom_field_1: store.custom_field_1 || "",
      custom_field_2: store.custom_field_2 || "",
      custom_field_3: store.custom_field_3 || "",
      custom_field_4: store.custom_field_4 || "",
      custom_field_5: store.custom_field_5 || "",
      observations: (store as any).observations || "",
      showcase_count: String((store as any).showcase_count ?? 0),
    });
    setEditStoreDialogOpen(true);
  };

  const handleEditStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStoreId) return;
    const formData = capitalizeStoreFields({ ...editStoreForm });
    if (!formData.store_code && client) {
      formData.store_code = generateStoreCode(client.name, formData.country, stores);
    }
    const { showcase_count: sc2, ...rest2 } = formData as any;
    await updateStore.mutateAsync({ id: editStoreId, ...rest2, showcase_count: parseInt(sc2, 10) || 0 });
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

  const handleEnrichStores = async () => {
    if (enriching || stores.length === 0) return;
    setEnriching(true);
    const total = stores.length;
    setEnrichProgress({ current: 0, total });
    let updatedCount = 0;

    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      setEnrichProgress({ current: i + 1, total });
      const updates: Record<string, string> = {};

      // 1. CNPJ lookup for Inscrição Estadual
      if (store.cnpj && !store.state_registration) {
        try {
          const cnpjData = await fetchCnpjData(store.cnpj);
          if (cnpjData) {
            const ieList = cnpjData.inscricoes_estaduais || [];
            const activeIE = ieList.find((ie) => ie.ativo) || ieList[0];
            if (activeIE?.inscricao_estadual) {
              updates.state_registration = activeIE.inscricao_estadual;
            }
          }
        } catch { /* skip */ }
      }

      // 2. CEP lookup for address fields
      if (store.zip_code && (!store.street || !store.city || !store.state || !store.neighborhood)) {
        try {
          const address = await fetchAddressByCep(store.zip_code);
          if (address) {
            if (!store.street && address.street) updates.street = address.street;
            if (!store.neighborhood && address.neighborhood) updates.neighborhood = address.neighborhood;
            if (!store.city && address.city) updates.city = address.city;
            if (!store.state && address.state) updates.state = address.state;
          }
        } catch { /* skip */ }
      }

      if (Object.keys(updates).length > 0) {
        try {
          const capitalizedUpdates = capitalizeStoreFields(updates);
          await updateStore.mutateAsync({ id: store.id, ...capitalizedUpdates } as any);
          updatedCount++;
        } catch { /* skip */ }
      }

      // Small delay to avoid rate limiting
      if (i < stores.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setEnriching(false);
    if (updatedCount > 0) {
      toast.success(`${updatedCount} loja(s) atualizada(s) com dados de CNPJ/CEP!`);
    } else {
      toast.info("Nenhuma loja precisou de atualização (dados já preenchidos ou não encontrados).");
    }
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
          email: r["email"] || r["Email"] || r["E-mail"] || r["e-mail"] || null,
          showcase_count: parseInt(r["quantidade de vitrines"] || r["Quantidade de Vitrines"] || r["vitrines"] || r["Vitrines"] || r["showcase_count"] || "0", 10) || 0,
        })).filter((s) => s.name);
        if (mapped.length === 0) {
          toast.error("Nenhuma loja encontrada na planilha.");
          return;
        }
        const existingByName = new Map(stores.map(s => [s.name.toLowerCase(), s]));
        let added = 0;
        let updated = 0;
        for (const rawItem of mapped) {
          const item = capitalizeStoreFields(rawItem);
          const existing = existingByName.get(item.name.toLowerCase());
          if (existing) {
            await updateStore.mutateAsync({ id: existing.id, ...item });
            updated++;
          } else {
            await addStore.mutateAsync(item);
            added++;
          }
        }
        const parts: string[] = [];
        if (added > 0) parts.push(`${added} adicionada(s)`);
        if (updated > 0) parts.push(`${updated} atualizada(s)`);
        toast.success(`${parts.join(", ")}!`);
      } catch {
        toast.error("Erro ao ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleSaveSettings = async () => {
    if (!clientId) return;
    await updateClient.mutateAsync({ id: clientId, ...customLabels, country_code: countryCode, currency_code: currencyCode, language: clientLanguage } as any);
    setSettingsOpen(false);
  };

  const storeStates = Array.from(new Set(stores.map((s) => s.state?.trim()).filter(Boolean) as string[])).sort();

  // filteredStores is now handled by StoresMatrixTable, but we still need the count
  const filteredStoresCount = stores
    .filter((s) => {
      if (storeStateFilter && storeStateFilter !== "all" && s.state?.trim() !== storeStateFilter) return false;
      const q = storeSearch.toLowerCase();
      return !q || s.name.toLowerCase().includes(q) ||
        s.nickname?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q);
    }).length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome *</label>
          <Input value={form.name} onChange={(e) => options?.nameChangeHandler ? options.nameChangeHandler(e.target.value) : setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Apelido</label>
          <Input value={form.nickname} onChange={(e) => options?.nicknameChangeHandler ? options.nicknameChangeHandler(e.target.value) : setForm((f) => ({ ...f, nickname: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{countryConfig.taxIdLabel}</label>
          <Input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{countryConfig.stateRegistrationLabel}</label>
          <Input value={form.state_registration} onChange={(e) => setForm((f) => ({ ...f, state_registration: e.target.value }))} />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{countryConfig.zipLabel}</label>
            <Input value={countryConfig.hasAutoCepLookup ? formatCep(form.zip_code) : form.zip_code} onChange={(e) => setForm((f) => ({ ...f, zip_code: countryConfig.hasAutoCepLookup ? formatCep(e.target.value) : e.target.value }))} placeholder={countryConfig.zipPlaceholder} maxLength={countryConfig.zipMaxLength} />
          </div>
          {countryConfig.hasAutoCepLookup && (
            <Button type="button" variant="outline" size="sm" onClick={() => handleCepLookup(form, setForm)}>Buscar</Button>
          )}
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
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{countryConfig.stateLabel}</label>
          <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">País</label>
          <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Ex: Brasil" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
          <div className="flex gap-1">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className="flex-1" />
            {form.email && (
              <Button type="button" size="icon" variant="outline" className="shrink-0" asChild>
                <a href={`mailto:${form.email}`}><Mail className="w-4 h-4" /></a>
              </Button>
            )}
          </div>
        </div>
         <div>
           <label className="text-xs font-medium text-muted-foreground mb-1 block">Modelo de Loja</label>
           <Select value={form.store_model || ""} onValueChange={(val) => setForm((f) => ({ ...f, store_model: val === "__none__" ? "" : val }))}>
             <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="__none__">Nenhum</SelectItem>
               {storeModels.map((m) => (
                 <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
               ))}
             </SelectContent>
           </Select>
         </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Código da Loja</label>
          <Input value={form.store_code} onChange={(e) => setForm((f) => ({ ...f, store_code: e.target.value }))} placeholder="Gerado automaticamente" />
         </div>
         <div>
           <label className="text-xs font-medium text-muted-foreground mb-1 block">Qtd. Vitrines</label>
           <Input type="number" min="0" value={form.showcase_count} onChange={(e) => setForm((f) => ({ ...f, showcase_count: e.target.value }))} placeholder="0" />
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
          {customFieldsParsed.map((field, i) => {
            if (!field.name) return null;
            const fieldKey = `custom_field_${i + 1}` as keyof typeof form;
            const currentValue = (form as any)[fieldKey] || "";
            const suggestions = [...new Set(
              stores
                .map((s) => (s as any)[fieldKey])
                .filter((v: any) => typeof v === "string" && v.trim() !== "")
            )].sort() as string[];
            return (
              <div key={i}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.name}</label>
                {field.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={currentValue === "true"}
                      onCheckedChange={(checked) => setForm((f) => ({ ...f, [fieldKey]: checked ? "true" : "false" }))}
                    />
                    <span className="text-sm text-muted-foreground">{currentValue === "true" ? "Sim" : "Não"}</span>
                  </div>
                ) : field.type === "number" || field.type === "date" ? (
                  <Input
                    type={field.type}
                    value={currentValue}
                    onChange={(e) => setForm((f) => ({ ...f, [fieldKey]: e.target.value }))}
                  />
                ) : (
                  <ComboboxInput
                    value={currentValue}
                    onChange={(v) => setForm((f) => ({ ...f, [fieldKey]: v }))}
                    suggestions={suggestions}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

   return (
    <AppLayout
      breadcrumbs={[
        { label: agencyInfo?.name || "Agência", href: "/" },
        { label: client.name },
      ]}
    >
      <div className="max-w-6xl mx-auto">
        {/* ─── Campaigns View (default) ─── */}
        {!new URLSearchParams(location.search).has("tab") && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="card-kpi flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}`)}>
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{campaigns.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t("clientDashboard.campaignCount")}</p>
                </div>
              </div>
              <div className="card-kpi flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}?tab=stores`)}>
                <div className="w-10 h-10 rounded-lg bg-primary/80 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stores.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t("clientDashboard.storeCount")}</p>
                </div>
              </div>
              {canEditCampaigns && (
                <div className="card-kpi col-span-2 sm:col-span-1 flex items-center justify-center">
                  <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-bold text-sm px-6">
                        <Plus className="w-5 h-5" /> {t("clientDashboard.addCampaign")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{t("clientDashboard.newCampaign")}</DialogTitle></DialogHeader>
                      <form onSubmit={handleAddCampaign} className="space-y-4">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("clientDashboard.campaignNameLabel")} *</label>
                          <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">{t("clientDashboard.campaignColorLabel")}</label>
                          <div className="grid grid-cols-8 gap-1.5">
                            {CAMPAIGN_COLORS.map((c) => (
                              <button
                                type="button"
                                key={c}
                                className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${campaignColor === c ? "border-foreground scale-110 ring-2 ring-primary/30" : "border-transparent"}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setCampaignColor(c)}
                              />
                            ))}
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={addCampaign.isPending}>{t("clientDashboard.create")}</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {loadingCampaigns ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
                  <Megaphone className="w-8 h-8 text-white" />
                </div>
                <p className="text-muted-foreground text-sm">{t("clientDashboard.noCampaigns")}</p>
              </div>
            ) : (
              <DndContext sensors={campaignSensors} collisionDetection={closestCenter} onDragEnd={handleCampaignDragEnd}>
                <SortableContext items={campaigns.map((c) => c.id)} strategy={rectSortingStrategy}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {campaigns.map((c) => (
                      <SortableCampaignCard
                        key={c.id}
                        campaign={c}
                        canDelete={canDeleteCampaigns}
                        canEdit={canEditCampaigns}
                        onNavigate={() => navigate(`/agency/${agencyId}/clients/${clientId}/campaigns/${c.id}`)}
                        onDelete={() => deleteCampaign.mutate(c.id)}
                        onColorChange={(color) => updateCampaign.mutate({ id: c.id, color })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}

        {/* ─── Stores View ─── */}
        {new URLSearchParams(location.search).get("tab") === "stores" && (
          <>
            {/* Stats + Actions */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{stores.length} {t("clientDashboard.storeCount").toLowerCase()}</span>
                <div className="flex-1 min-w-[80px] max-w-xs">
                  <Input placeholder={t("clientDashboard.searchStore")} value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="h-8 text-xs" />
                </div>
                <Select value={storeStateFilter} onValueChange={setStoreStateFilter}>
                  <SelectTrigger className="h-8 text-xs w-[80px] sm:w-[100px]">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {storeStates.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => exportClientStores(stores, client.name, agencyInfo?.name)}>
                  <Download className="w-3 h-3" /> Exportar
                </Button>
                {canEditStores && (
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
                     <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleEnrichStores} disabled={enriching}>
                       <RefreshCw className={`w-3 h-3 ${enriching ? "animate-spin" : ""}`} /> {enriching ? "..." : "Enriquecer"}
                     </Button>
                     <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setStoreModelDialogOpen(true)}>
                       <Tag className="w-3 h-3" /> Modelos
                     </Button>
                  </>
                )}
              </div>
            </div>

            {enriching && (
              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Enriquecendo lojas... ({enrichProgress.current}/{enrichProgress.total})</span>
                  <span>{Math.round((enrichProgress.current / enrichProgress.total) * 100)}%</span>
                </div>
                <Progress value={(enrichProgress.current / enrichProgress.total) * 100} className="h-2" />
              </div>
            )}

            {canEditClients && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                      setCustomLabels({
                        custom_field_1_label: client.custom_field_1_label || "",
                        custom_field_2_label: client.custom_field_2_label || "",
                        custom_field_3_label: client.custom_field_3_label || "",
                        custom_field_4_label: client.custom_field_4_label || "",
                        custom_field_5_label: client.custom_field_5_label || "",
                      });
                      setCountryCode(client.country_code || "BR");
                      setCurrencyCode(client.currency_code || "BRL");
                    }}>
                      <Settings className="w-3.5 h-3.5" /> Configurações
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Configurações do Cliente</DialogTitle></DialogHeader>

                    {/* Country / Currency */}
                    <div className="space-y-3 pb-3 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">País e Moeda</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">País</label>
                          <Select value={countryCode} onValueChange={(val) => {
                            setCountryCode(val);
                            const cfg = getCountryConfig(val);
                            setCurrencyCode(cfg.currency);
                          }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SUPPORTED_COUNTRIES.map(c => (
                                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Moeda</label>
                          <Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} placeholder="BRL" maxLength={3} />
                        </div>
                      </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-3 pb-3 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Idioma do Sistema</p>
                      <Select value={clientLanguage} onValueChange={setClientLanguage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">🇧🇷 Português (Brasil)</SelectItem>
                          <SelectItem value="en">🇺🇸 English</SelectItem>
                          <SelectItem value="es">🇪🇸 Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground uppercase pt-1">Campos Personalizáveis</p>
                    <p className="text-xs text-muted-foreground mb-2">Defina os nomes dos campos extras para as lojas deste cliente.</p>
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
                      <StoreContactsSection storeId={editStoreId || undefined} clientId={clientId} canEdit={canEditStores} storeName={editStoreForm.nickname || editStoreForm.name} countryCode={client?.country_code} />
                      <Button type="submit" className="w-full" disabled={updateStore.isPending}>Salvar Alterações</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex items-center gap-2 mb-3">
              <Button
                size="sm"
                variant={storesViewMode === "table" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setStoresViewMode("table")}
              >
                <Store className="w-3.5 h-3.5 mr-1" /> Tabela
              </Button>
              <Button
                size="sm"
                variant={storesViewMode === "cards" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setStoresViewMode("cards")}
              >
                <Users className="w-3.5 h-3.5 mr-1" /> Cards / Contatos
              </Button>
            </div>

            {storesViewMode === "cards" ? (
              <StoreFullCardView
                clientId={clientId!}
                stores={stores}
                agencyName={agencyInfo?.name || ""}
                clientName={client.name}
                customFields={customFieldsParsed
                  .map((cf, i) => ({ label: cf.name, index: i + 1 }))
                  .filter((cf) => cf.label)}
                canEdit={canEditStores}
                onEditStore={handleOpenEditStore}
                countryCode={client.country_code}
              />
            ) : (
            <>
            {loadingStores ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" /></div>
            ) : filteredStoresCount === 0 ? (
              <div className="text-center py-16">
                <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma loja cadastrada.</p>
              </div>
            ) : (
              <StoresMatrixTable
                stores={stores}
                clientId={clientId!}
                customFieldLabels={customFieldsParsed
                  .map((cf, i) => ({ label: cf.name, index: i + 1, type: cf.type }))
                  .filter((cf) => cf.label)}
                canEdit={canEditStores}
                onUpdateStore={async (data) => { await updateStore.mutateAsync(data); }}
                onOpenEditStore={handleOpenEditStore}
                storeSearch={storeSearch}
                storeStateFilter={storeStateFilter}
                onDisplayOrderChange={setDisplayOrderStores}
               />
            )}
            </>
            )}

          </>
        )}
      </div>

      {/* ─── Store Models Management Dialog ─── */}
      <Dialog open={storeModelDialogOpen} onOpenChange={setStoreModelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Modelos de Loja</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!clientId || !newModelName.trim()) return;
            await addStoreModel.mutateAsync({ client_id: clientId, name: newModelName.trim() });
            setNewModelName("");
          }} className="flex gap-2">
            <Input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Nome do modelo" className="flex-1" />
            <Button type="submit" size="sm" disabled={addStoreModel.isPending || !newModelName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </form>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {storeModels.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum modelo cadastrado.</p>}
            {storeModels.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <span className="text-sm">{m.name}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                      <AlertDialogDescription>O modelo "{m.name}" será removido. Lojas que usam este modelo não serão alteradas.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteStoreModel.mutate(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ClientDetail;
