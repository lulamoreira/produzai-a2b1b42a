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
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, Search, Megaphone, Store, Settings, Edit3, Download, Sparkles, MessageSquare, Tag, RefreshCw, Mail, GripVertical, Palette, ArrowUp, ArrowDown, ArrowUpDown, Users, Star, Building2, Pencil } from "lucide-react";
import { useClientSuppliers, useAddClientSupplier, useUpdateClientSupplier, useDeleteClientSupplier, type ClientSupplier } from "@/hooks/useClientSuppliers";
import { Textarea } from "@/components/ui/textarea";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useCampaignFavorites";
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
import ImportWizardDialog from "@/components/ImportWizardDialog";
import CustomExportDialog, { type ExportFieldDef } from "@/components/CustomExportDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ComboboxInput from "@/components/ComboboxInput";
import { getStateColor } from "@/lib/stateColors";
import DeleteStoreDialog from "@/components/DeleteStoreDialog";
import DeleteAllStoresDialog from "@/components/DeleteAllStoresDialog";
import { useUserRole } from "@/hooks/useUserRole";
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

import * as XLSX from "xlsx";
import { capitalizeName } from "@/lib/utils";

/** Auto-capitalize text fields of a store form (excludes state, store_model, email, cnpj, codes) */
function capitalizeStoreFields<T extends Record<string, any>>(data: T): T {
  const CAPITALIZE_KEYS = [
    "name", "nickname", "street", "complement", "neighborhood", "city",
    "manager_name", "country", "observations",
    "custom_field_1", "custom_field_2", "custom_field_3", "custom_field_4", "custom_field_5",
    "custom_field_6", "custom_field_7", "custom_field_8", "custom_field_9", "custom_field_10",
    "custom_field_11", "custom_field_12", "custom_field_13", "custom_field_14", "custom_field_15",
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
  custom_field_6: "", custom_field_7: "", custom_field_8: "", custom_field_9: "", custom_field_10: "",
  custom_field_11: "", custom_field_12: "", custom_field_13: "", custom_field_14: "", custom_field_15: "",
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
  campaign, canDelete, canEdit, onNavigate, onDelete, onColorChange, isFavorited, onToggleFavorite, showFavorite,
}: {
  campaign: Campaign; canDelete: boolean; canEdit: boolean;
  onNavigate: () => void; onDelete: () => void; onColorChange: (c: string) => void;
  isFavorited: boolean; onToggleFavorite: () => void; showFavorite: boolean;
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
  const initial = (campaign.name || "C").charAt(0).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group card-base cursor-pointer hover:shadow-md transition-shadow duration-150 relative w-full max-w-full overflow-hidden"
      onClick={onNavigate}
    >
      {/* Left color accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-card)]" style={{ backgroundColor: color }} />

      <div className="flex items-start gap-2 sm:gap-3 min-w-0">
        {canEdit && (
          <button
            className="cursor-grab active:cursor-grabbing touch-none p-0.5 mt-1 hidden sm:block"
            style={{ color: 'var(--text-muted)' }}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          <span className="text-white font-semibold text-base">{initial}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate min-w-0" style={{ color: 'var(--text-primary)' }}>
              {campaign.name}
            </h3>
            <span className="badge-base badge-success flex-shrink-0">● {t("clientDashboard.active") || "Ativa"}</span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {t("clientDashboard.createdAt") || "Criada em"} {new Date(campaign.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {showFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorited ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
            </Button>
          )}
          {canEdit && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
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
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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

      {/* Footer */}
      <div className="flex items-center justify-end mt-3">
        <span className="text-[13px] font-medium text-primary flex items-center gap-1">
          {t("clientDashboard.access")} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </span>
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
  const { data: favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

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

  // Suppliers
  const { data: suppliers = [] } = useClientSuppliers(clientId);
  const addSupplier = useAddClientSupplier();
  const updateSupplier = useUpdateClientSupplier();
  const deleteSupplier = useDeleteClientSupplier();
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    company_name: "", contact_name: "", phone: "", email: "", observations: "",
  });
  const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

  const openSupplierForCreate = () => {
    setEditingSupplierId(null);
    setSupplierForm({ company_name: "", contact_name: "", phone: "", email: "", observations: "" });
    setSupplierDialogOpen(true);
  };

  const openSupplierForEdit = (s: ClientSupplier) => {
    setEditingSupplierId(s.id);
    setSupplierForm({
      company_name: s.company_name || "",
      contact_name: s.contact_name || "",
      phone: s.phone || "",
      email: s.email || "",
      observations: s.observations || "",
    });
    setSupplierDialogOpen(true);
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    if (!supplierForm.company_name.trim() || !supplierForm.email.trim()) {
      toast.error("Empresa e e-mail são obrigatórios.");
      return;
    }
    if (editingSupplierId) {
      await updateSupplier.mutateAsync({
        id: editingSupplierId,
        client_id: clientId,
        company_name: supplierForm.company_name.trim(),
        contact_name: supplierForm.contact_name.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim(),
        observations: supplierForm.observations.trim() || null,
      } as any);
    } else {
      await addSupplier.mutateAsync({
        client_id: clientId,
        company_name: supplierForm.company_name.trim(),
        contact_name: supplierForm.contact_name.trim() || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim(),
        observations: supplierForm.observations.trim() || null,
      });
    }
    setSupplierDialogOpen(false);
    setEditingSupplierId(null);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.company_name.toLowerCase().includes(q) ||
      (s.contact_name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q)
    );
  });

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
  const [customExportOpen, setCustomExportOpen] = useState(false);
  const [displayOrderStores, setDisplayOrderStores] = useState<ClientStore[]>([]);

  // Store form
  const [storeForm, setStoreForm] = useState({ ...emptyStoreForm });
  const nicknameTouchedRef = useRef(false);

  // Edit store
  const [editStoreDialogOpen, setEditStoreDialogOpen] = useState(false);
  const [editStoreForm, setEditStoreForm] = useState({ ...emptyStoreForm });
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [deleteStoreDialogOpen, setDeleteStoreDialogOpen] = useState(false);
  const [deleteAllStoresOpen, setDeleteAllStoresOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0 });
  const { isAdminOrMaster } = useUserRole();

  // Custom field labels
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({
    custom_field_1_label: client?.custom_field_1_label || "",
    custom_field_2_label: client?.custom_field_2_label || "",
    custom_field_3_label: client?.custom_field_3_label || "",
    custom_field_4_label: client?.custom_field_4_label || "",
    custom_field_5_label: client?.custom_field_5_label || "",
    custom_field_6_label: client?.custom_field_6_label || "",
    custom_field_7_label: client?.custom_field_7_label || "",
    custom_field_8_label: client?.custom_field_8_label || "",
    custom_field_9_label: client?.custom_field_9_label || "",
    custom_field_10_label: client?.custom_field_10_label || "",
    custom_field_11_label: (client as any)?.custom_field_11_label || "",
    custom_field_12_label: (client as any)?.custom_field_12_label || "",
    custom_field_13_label: (client as any)?.custom_field_13_label || "",
    custom_field_14_label: (client as any)?.custom_field_14_label || "",
    custom_field_15_label: (client as any)?.custom_field_15_label || "",
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
      custom_field_6: (store as any).custom_field_6 || "",
      custom_field_7: (store as any).custom_field_7 || "",
      custom_field_8: (store as any).custom_field_8 || "",
      custom_field_9: (store as any).custom_field_9 || "",
      custom_field_10: (store as any).custom_field_10 || "",
      custom_field_11: (store as any).custom_field_11 || "",
      custom_field_12: (store as any).custom_field_12 || "",
      custom_field_13: (store as any).custom_field_13 || "",
      custom_field_14: (store as any).custom_field_14 || "",
      custom_field_15: (store as any).custom_field_15 || "",
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

  const handleDeleteAllStores = async () => {
    if (stores.length === 0) return;
    setBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: stores.length });
    let failed = 0;
    for (let i = 0; i < stores.length; i++) {
      try {
        await deleteStore.mutateAsync(stores[i].id);
      } catch {
        failed++;
      }
      setBulkDeleteProgress({ current: i + 1, total: stores.length });
    }
    setBulkDeleting(false);
    setDeleteAllStoresOpen(false);
    if (failed === 0) {
      toast.success(`${stores.length} loja(s) excluída(s) com sucesso.`);
    } else {
      toast.warning(`${stores.length - failed} excluída(s), ${failed} falharam.`);
    }
  };

  const [storeImportOpen, setStoreImportOpen] = useState(false);

  const handleStoresImport = async (
    rows: Record<string, string>[],
    { updateExisting }: { updateExisting: boolean },
  ) => {
    if (!clientId) return;
    const existingByName = new Map(stores.map(s => [s.name.trim().toLowerCase(), s]));
    let added = 0;
    let updated = 0;
    for (const row of rows) {
      const showcaseRaw = row.showcase_count ?? "";
      const item = capitalizeStoreFields({
        client_id: clientId,
        name: row.name ?? "",
        nickname: row.nickname || null,
        city: row.city || null,
        state: row.state || null,
        cnpj: row.cnpj || null,
        state_registration: row.state_registration || null,
        zip_code: row.zip_code || null,
        street: row.street || null,
        number: row.number || null,
        complement: row.complement || null,
        neighborhood: row.neighborhood || null,
        phone: row.phone || null,
        manager_name: row.manager_name || null,
        country: row.country || null,
        store_model: row.store_model || null,
        store_code: row.store_code || null,
        email: row.email || null,
        observations: row.observations || null,
        showcase_count: parseInt(showcaseRaw, 10) || 0,
      });
      const existing = existingByName.get(item.name.trim().toLowerCase());
      if (existing && updateExisting) {
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
    if (parts.length > 0) toast.success(parts.join(", ") + "!");
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
    client?.custom_field_6_label,
    client?.custom_field_7_label,
    client?.custom_field_8_label,
    client?.custom_field_9_label,
    client?.custom_field_10_label,
    (client as any)?.custom_field_11_label,
    (client as any)?.custom_field_12_label,
    (client as any)?.custom_field_13_label,
    (client as any)?.custom_field_14_label,
    (client as any)?.custom_field_15_label,
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="card-kpi p-3 sm:p-4 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}`)}>
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                  <Megaphone className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{campaigns.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t("clientDashboard.campaignCount")}</p>
                </div>
              </div>
              <div className="card-kpi p-3 sm:p-4 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}?tab=stores`)}>
                <div className="w-10 h-10 rounded-lg bg-primary/80 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{stores.length}</p>
                  <p className="text-[11px] text-muted-foreground">{t("clientDashboard.storeCount")}</p>
                </div>
              </div>
              <div className="card-kpi p-3 sm:p-4 flex items-center gap-3 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all" onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}?tab=suppliers`)}>
                <div className="w-10 h-10 rounded-lg bg-primary/60 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{suppliers.length}</p>
                  <p className="text-[11px] text-muted-foreground">Fornecedores</p>
                </div>
              </div>
              {canEditCampaigns && (
                <div className="card-kpi p-3 sm:p-4 col-span-2 sm:col-span-2 md:col-span-1 flex items-center justify-center">
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
                        isFavorited={favoriteIds?.has(c.id) ?? false}
                        onToggleFavorite={() => toggleFavorite.mutate({ campaignId: c.id, isFavorited: favoriteIds?.has(c.id) ?? false })}
                        showFavorite={true}
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
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setCustomExportOpen(true)}>
                  <Download className="w-3 h-3" /> <span className="hidden sm:inline">Export.</span> Pers.
                </Button>
                {canEditStores && (
                  <>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setStoreImportOpen(true)}>
                      <Upload className="w-3 h-3" /> Importar
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleReviewStoreCodes}>
                      <Sparkles className="w-3 h-3" /> Códigos
                    </Button>
                     <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleEnrichStores} disabled={enriching}>
                       <RefreshCw className={`w-3 h-3 ${enriching ? "animate-spin" : ""}`} /> {enriching ? "..." : "Enriquecer"}
                     </Button>
                     {isAdminOrMaster && stores.length > 0 && (
                       <Button
                         size="sm"
                         variant="destructive"
                         className="text-xs h-7 gap-1"
                         onClick={() => setDeleteAllStoresOpen(true)}
                         disabled={bulkDeleting}
                       >
                         <Trash2 className="w-3 h-3" /> Apagar todas
                       </Button>
                     )}
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

            {bulkDeleting && (
              <div className="mb-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-destructive">
                  <span>Excluindo lojas... ({bulkDeleteProgress.current}/{bulkDeleteProgress.total})</span>
                  <span>{bulkDeleteProgress.total > 0 ? Math.round((bulkDeleteProgress.current / bulkDeleteProgress.total) * 100) : 0}%</span>
                </div>
                <Progress value={bulkDeleteProgress.total > 0 ? (bulkDeleteProgress.current / bulkDeleteProgress.total) * 100 : 0} className="h-2" />
              </div>
            )}

            <DeleteAllStoresDialog
              open={deleteAllStoresOpen}
              onOpenChange={setDeleteAllStoresOpen}
              clientName={client.name}
              storeCount={stores.length}
              isDeleting={bulkDeleting}
              progress={bulkDeleteProgress}
              onConfirm={handleDeleteAllStores}
            />


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
                        custom_field_6_label: client.custom_field_6_label || "",
                        custom_field_7_label: client.custom_field_7_label || "",
                        custom_field_8_label: client.custom_field_8_label || "",
                        custom_field_9_label: client.custom_field_9_label || "",
                        custom_field_10_label: client.custom_field_10_label || "",
                        custom_field_11_label: (client as any).custom_field_11_label || "",
                        custom_field_12_label: (client as any).custom_field_12_label || "",
                        custom_field_13_label: (client as any).custom_field_13_label || "",
                        custom_field_14_label: (client as any).custom_field_14_label || "",
                        custom_field_15_label: (client as any).custom_field_15_label || "",
                      });
                      setCountryCode(client.country_code || "BR");
                      setCurrencyCode(client.currency_code || "BRL");
                    }}>
                      <Settings className="w-3.5 h-3.5" /> Configurações
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto">
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
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => {
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
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-2">
                        {isAdminOrMaster && editStoreId ? (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setDeleteStoreDialogOpen(true)}
                            disabled={updateStore.isPending || deleteStore.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir loja
                          </Button>
                        ) : <span />}
                        <Button type="submit" disabled={updateStore.isPending} className="sm:flex-1 sm:max-w-xs">
                          Salvar Alterações
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <DeleteStoreDialog
                  open={deleteStoreDialogOpen}
                  onOpenChange={setDeleteStoreDialogOpen}
                  storeId={editStoreId}
                  storeName={editStoreForm.nickname || editStoreForm.name}
                  isDeleting={deleteStore.isPending}
                  onConfirm={async () => {
                    if (!editStoreId) return;
                    await deleteStore.mutateAsync(editStoreId);
                    setDeleteStoreDialogOpen(false);
                    setEditStoreDialogOpen(false);
                    setEditStoreId(null);
                  }}
                />

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

            <CustomExportDialog
              open={customExportOpen}
              onOpenChange={setCustomExportOpen}
              title="Exportação Personalizada — Lojas"
              fileName={`Lojas_${client.name}`}
              agencyName={agencyInfo?.name}
              clientName={client.name}
              sheetName="Lojas"
              data={displayOrderStores.length > 0 ? displayOrderStores : stores}
              fields={(() => {
                const base: ExportFieldDef[] = [
                  { key: "name", label: "Nome", getValue: (s: ClientStore) => s.name || "" },
                  { key: "nickname", label: "Apelido", getValue: (s: ClientStore) => s.nickname || "" },
                  { key: "store_code", label: "Código", getValue: (s: ClientStore) => s.store_code || "" },
                  { key: "cnpj", label: "CNPJ", getValue: (s: ClientStore) => s.cnpj || "" },
                  { key: "state_registration", label: "Inscrição Estadual", getValue: (s: ClientStore) => s.state_registration || "" },
                  { key: "zip_code", label: "CEP", getValue: (s: ClientStore) => s.zip_code || "" },
                  { key: "street", label: "Rua", getValue: (s: ClientStore) => s.street || "" },
                  { key: "number", label: "Nº", getValue: (s: ClientStore) => s.number || "" },
                  { key: "complement", label: "Complemento", getValue: (s: ClientStore) => s.complement || "" },
                  { key: "neighborhood", label: "Bairro", getValue: (s: ClientStore) => s.neighborhood || "" },
                  { key: "city", label: "Cidade", getValue: (s: ClientStore) => s.city || "" },
                  { key: "state", label: "UF", getValue: (s: ClientStore) => s.state || "" },
                  { key: "country", label: "País", getValue: (s: ClientStore) => s.country || "" },
                  { key: "store_model", label: "Modelo", getValue: (s: ClientStore) => s.store_model || "" },
                  { key: "phone", label: "Telefone", getValue: (s: ClientStore) => s.phone || "" },
                  { key: "email", label: "E-mail", getValue: (s: ClientStore) => s.email || "" },
                  { key: "manager_name", label: "Contato", getValue: (s: ClientStore) => s.manager_name || "" },
                  { key: "showcase_count", label: "Qtd. Vitrines", getValue: (s: ClientStore) => String((s as any).showcase_count ?? 0) },
                  { key: "observations", label: "Observações", getValue: (s: ClientStore) => (s as any).observations || "" },
                ];
                customFieldsParsed.forEach((cf, i) => {
                  if (cf.name) {
                    const fieldKey = `custom_field_${i + 1}`;
                    base.push({
                      key: fieldKey,
                      label: cf.name,
                      getValue: (s: ClientStore) => (s as any)[fieldKey] || "",
                    });
                  }
                });
                return base;
              })()}
            />
          </>
        )}

        {/* ─── Suppliers View ─── */}
        {new URLSearchParams(location.search).get("tab") === "suppliers" && (
          <>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{suppliers.length} fornecedor(es)</span>
              <div className="flex-1 min-w-[160px] max-w-xs">
                <Input
                  placeholder="Buscar fornecedor..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {canEditClients && (
                <Button size="sm" className="gap-1 h-8" onClick={openSupplierForCreate}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar Fornecedor
                </Button>
              )}
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {supplierSearch ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}
                </p>
              </div>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Empresa</TableHead>
                      <TableHead className="text-xs">Contato</TableHead>
                      <TableHead className="text-xs">Telefone</TableHead>
                      <TableHead className="text-xs">E-mail</TableHead>
                      <TableHead className="text-xs">Observações</TableHead>
                      <TableHead className="text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">{s.company_name}</TableCell>
                        <TableCell className="text-sm">{s.contact_name || "—"}</TableCell>
                        <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                        <TableCell className="text-sm">{s.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {s.observations || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditClients && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => openSupplierForEdit(s)}
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => setDeleteSupplierId(s.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Supplier Add/Edit Dialog ─── */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSupplierId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitSupplier} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Empresa *</label>
              <Input
                value={supplierForm.company_name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, company_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contato</label>
              <Input
                value={supplierForm.contact_name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                <Input
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+5511999999999"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail *</label>
                <Input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
              <Textarea
                value={supplierForm.observations}
                onChange={(e) => setSupplierForm((f) => ({ ...f, observations: e.target.value }))}
                placeholder="Notas internas sobre o fornecedor..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addSupplier.isPending || updateSupplier.isPending}>
                {editingSupplierId ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSupplierId} onOpenChange={(o) => !o && setDeleteSupplierId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o cadastro deste fornecedor. Cotações já criadas em campanhas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteSupplierId) {
                  deleteSupplier.mutate(deleteSupplierId, {
                    onSuccess: () => setDeleteSupplierId(null),
                  });
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <ImportWizardDialog
        open={storeImportOpen}
        onOpenChange={setStoreImportOpen}
        mode="stores"
        existingItems={stores.map(s => ({ name: s.name, id: s.id }))}
        onImport={handleStoresImport}
      />
    </AppLayout>
  );
};

export default ClientDetail;
