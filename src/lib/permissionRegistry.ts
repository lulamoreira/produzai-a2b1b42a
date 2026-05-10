/**
 * Permission Registry — canonical list of all modules and their available actions.
 *
 * Adding a new module = adding ONE entry here. Used by the Permission Categories v2
 * editor and (eventually) by runtime checks via `permission_grants`.
 *
 * IMPORTANT: This is additive in Phase 1. The legacy boolean columns on
 * `permission_categories` are still the source of truth at runtime.
 */

export type PermissionAction = "view" | "edit" | "delete" | string;

export interface PermissionSpecialAction {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  /** Lucide icon name (string, resolved by the consumer). */
  icon: string;
  category: "campaign" | "admin" | "cross_cutting";
  description?: string;
  actions: PermissionAction[];
  specialActions?: PermissionSpecialAction[];
  subModules?: PermissionModule[];
  /** Categories where this module shouldn't be shown (by name). */
  hideForRoles?: string[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  // ─── Campaign modules ───
  {
    key: "scheduling",
    label: "Cronograma",
    icon: "Calendar",
    category: "campaign",
    description: "Datas e horários de instalação",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "installations",
    label: "Instalações",
    icon: "Wrench",
    category: "campaign",
    description: "Execução e fotos das instalações",
    actions: ["view", "edit", "delete"],
    specialActions: [
      { key: "team_codes", label: "Gerenciar códigos de equipe", description: "Criar e revogar códigos de acesso para equipes de instalação" },
      { key: "photo_checkin", label: "Ver fotos de check-in", description: "Visualizar fotos enviadas no check-in dos instaladores" },
    ],
  },
  {
    key: "loja_a_loja",
    label: "Loja a Loja",
    icon: "Map",
    category: "campaign",
    description: "Estrutura por loja e ocorrências",
    actions: ["view", "edit", "delete"],
    subModules: [
      { key: "loja_a_loja.estrutura", label: "Estrutura", icon: "Layers", category: "campaign", actions: ["view", "edit", "delete"] },
      { key: "loja_a_loja.classificacao", label: "Classificação", icon: "Tag", category: "campaign", actions: ["view", "edit", "delete"] },
      { key: "loja_a_loja.acessos", label: "Acessos", icon: "Key", category: "campaign", actions: ["view", "edit", "delete"] },
      { key: "loja_a_loja.config", label: "Configuração", icon: "Settings", category: "campaign", actions: ["view", "edit", "delete"] },
      { key: "loja_a_loja.ocorrencias", label: "Ocorrências (LaL)", icon: "AlertCircle", category: "campaign", actions: ["view", "edit", "delete"] },
    ],
  },
  {
    key: "stores",
    label: "Lojas (Cadastro)",
    icon: "Store",
    category: "campaign",
    description: "Cadastro mestre de lojas do cliente",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "campaign_stores",
    label: "Lojas da Campanha",
    icon: "StorefrontPlus",
    category: "campaign",
    description: "Lojas vinculadas a uma campanha específica",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "occurrences",
    label: "Ocorrências",
    icon: "AlertTriangle",
    category: "campaign",
    description: "Reportes e tratativas durante a campanha",
    actions: ["view", "edit", "delete"],
    specialActions: [
      { key: "reporter_data", label: "Editar dados do lojista", description: "Alterar nome/telefone do reportante" },
      { key: "lock_cards", label: "Bloquear cards", description: "Travar edição de ocorrências" },
    ],
  },
  {
    key: "budgets",
    label: "Orçamentos",
    icon: "DollarSign",
    category: "campaign",
    description: "Cotações com fornecedores e negociação",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "pieces",
    label: "Peças",
    icon: "Package",
    category: "campaign",
    description: "Catálogo de peças da campanha",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "matrix",
    label: "Rateio",
    icon: "Grid3x3",
    category: "campaign",
    description: "Distribuição de peças por loja",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "mockup",
    label: "Mockup",
    icon: "Palette",
    category: "campaign",
    description: "Aprovação visual de peças e kits",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "adjustments",
    label: "Ajustes",
    icon: "GitMerge",
    category: "campaign",
    description: "Modificações pós-aprovação",
    actions: ["view", "edit", "delete"],
  },

  // ─── Cross-cutting ───
  {
    key: "clients",
    label: "Clientes",
    icon: "Building",
    category: "cross_cutting",
    description: "Gestão de clientes da agência",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "campaigns",
    label: "Campanhas",
    icon: "Briefcase",
    category: "cross_cutting",
    description: "Criação e gestão de campanhas",
    actions: ["view", "edit", "delete"],
  },

  // ─── Admin pages ───
  {
    key: "admin.users",
    label: "Gestão de Usuários",
    icon: "Users",
    category: "admin",
    description: "Convidar, remover e atribuir categorias",
    actions: ["view", "edit"],
  },
  {
    key: "admin.categories",
    label: "Categorias de Permissão",
    icon: "Shield",
    category: "admin",
    description: "Criar e editar categorias",
    actions: ["view", "edit", "delete"],
  },
  {
    key: "admin.approvals",
    label: "Aprovações",
    icon: "CheckSquare",
    category: "admin",
    description: "Aprovar pedidos pendentes",
    actions: ["view", "edit"],
  },
  {
    key: "admin.backup",
    label: "Backup",
    icon: "Database",
    category: "admin",
    description: "Exportar e restaurar dados",
    actions: ["view", "edit"],
  },
  {
    key: "admin.notifications",
    label: "Notificações",
    icon: "Bell",
    category: "admin",
    description: "Configurar alertas globais",
    actions: ["view", "edit"],
  },
  {
    key: "admin.images",
    label: "Imagens",
    icon: "Image",
    category: "admin",
    description: "Gestão de imagens do sistema",
    actions: ["view", "edit", "delete"],
  },
];

// Quick-preset templates for the new editor.
export interface PresetGrant {
  module_key: string;
  action: string;
}

export const PERMISSION_PRESETS: Record<
  string,
  { label: string; description: string; grants: PresetGrant[] }
> = {
  read_only: {
    label: "Apenas Leitura",
    description: "Visualiza tudo, não pode modificar nada",
    grants: PERMISSION_MODULES
      .filter((m) => m.category !== "admin")
      .map((m) => ({ module_key: m.key, action: "view" })),
  },
  editor_default: {
    label: "Editor Padrão",
    description: "Pode visualizar e editar, sem apagar",
    grants: PERMISSION_MODULES
      .filter((m) => m.category !== "admin")
      .flatMap((m) => [
        { module_key: m.key, action: "view" },
        { module_key: m.key, action: "edit" },
      ]),
  },
  editor_advanced: {
    label: "Editor Avançado",
    description: "Edição completa em módulos operacionais",
    grants: [
      "scheduling",
      "installations",
      "loja_a_loja",
      "stores",
      "campaign_stores",
      "occurrences",
      "pieces",
      "matrix",
      "mockup",
    ].flatMap((k) => [
      { module_key: k, action: "view" },
      { module_key: k, action: "edit" },
      { module_key: k, action: "delete" },
    ]),
  },
  operational_store: {
    label: "Operacional Loja",
    description: "Acesso restrito a operações de loja",
    grants: ["stores", "campaign_stores", "scheduling", "installations", "occurrences"]
      .flatMap((k) => [
        { module_key: k, action: "view" },
        { module_key: k, action: "edit" },
      ]),
  },
};

export const CATEGORY_COLORS = [
  { key: "amber", label: "Âmbar", class: "bg-amber-500" },
  { key: "blue", label: "Azul", class: "bg-blue-500" },
  { key: "purple", label: "Roxo", class: "bg-purple-500" },
  { key: "green", label: "Verde", class: "bg-green-500" },
  { key: "orange", label: "Laranja", class: "bg-orange-500" },
  { key: "red", label: "Vermelho", class: "bg-red-500" },
  { key: "gray", label: "Cinza", class: "bg-gray-500" },
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number]["key"];
