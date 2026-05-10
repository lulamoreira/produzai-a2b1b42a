/**
 * Central sidebar / navigation registry.
 * Single source of truth for top-level navigation, campaign module list,
 * and user-menu actions. Adding a new module = one entry here.
 */
import {
  Home, Building2, Star, Users, CheckSquare, Database,
  CalendarDays, Camera, MapPin, Store, AlertTriangle, DollarSign,
  LayoutList, Grid3X3, Palette, Layers,
  User, UserPlus, LogOut, Settings, Search, Globe, Sun,
  type LucideIcon,
} from "lucide-react";

export type Permission =
  | "always"
  | "admin"
  | "admin_or_master"
  | "campaign_access"
  | "limited_user_blocked";

export const MODULE_ICONS = {
  CalendarDays, Camera, MapPin, Store, AlertTriangle, DollarSign,
  LayoutList, Grid3X3, Palette, Layers,
} satisfies Record<string, LucideIcon>;

export const NAV_ICONS = {
  Home, Building2, Star, Users, CheckSquare, Database,
} satisfies Record<string, LucideIcon>;

export const USER_ICONS = {
  User, UserPlus, LogOut, Settings, Search, Globe, Sun,
} satisfies Record<string, LucideIcon>;

export interface ModuleEntry {
  key: string;
  labelKey: string;
  label: string;
  icon: keyof typeof MODULE_ICONS;
  color: string;
  requires: Permission;
  /** Hidden completely for limited (campaign-scoped) users. */
  hideForLimited?: boolean;
  /** Requires the campaign to expose this module via campaign.modules array. */
  requiresCampaignModule?: string;
}

export interface NavItem {
  key: string;
  label: string;
  labelKey?: string;
  route: string;
  icon: keyof typeof NAV_ICONS;
  requires: Permission;
}

export interface NavSection {
  key: string;
  label?: string;
  requires?: Permission;
  items: NavItem[];
}

export type UserMenuAction =
  | "open_profile"
  | "open_invite"
  | "open_settings"
  | "open_search"
  | "sign_out";

export interface UserMenuItem {
  key: string;
  label: string;
  icon: keyof typeof USER_ICONS;
  action: UserMenuAction;
  requires: Permission;
  shortcut?: string;
  variant?: "default" | "destructive";
}

// Canonical campaign module list — order is render order.
// hideForLimited / requiresCampaignModule encode the legacy filters.
export const CAMPAIGN_MODULES: ModuleEntry[] = [
  { key: "scheduling",    labelKey: "modules.scheduling",    label: "Cronograma",   icon: "CalendarDays",   color: "#5C6B3F", requires: "campaign_access" },
  { key: "installations", labelKey: "modules.installations", label: "Instalações",  icon: "Camera",         color: "#7B5E3A", requires: "campaign_access" },
  { key: "loja_a_loja",   labelKey: "modules.loja_a_loja",   label: "Loja a Loja",  icon: "MapPin",         color: "#5B7B5E", requires: "campaign_access" },
  { key: "stores",        labelKey: "modules.stores",        label: "Lojas",        icon: "Store",          color: "#6B4F2E", requires: "campaign_access" },
  { key: "occurrences",   labelKey: "modules.occurrences",   label: "Ocorrências",  icon: "AlertTriangle",  color: "#7A3B2E", requires: "campaign_access" },
  { key: "budgets",       labelKey: "modules.budgets",       label: "Orçamentos",   icon: "DollarSign",     color: "#4A5568", requires: "admin_or_master", hideForLimited: true },
  { key: "pieces",        labelKey: "modules.pieces",        label: "Peças",        icon: "LayoutList",     color: "#A07850", requires: "campaign_access" },
  { key: "matrix",        labelKey: "modules.matrix",        label: "Rateio",       icon: "Grid3X3",        color: "#8C6F4E", requires: "campaign_access" },
  { key: "mockup",        labelKey: "modules.mockup",        label: "Mockup",       icon: "Palette",        color: "#7A6A8C", requires: "campaign_access", requiresCampaignModule: "pieces" },
  { key: "adjustments",   labelKey: "modules.adjustments",   label: "Ajustes",      icon: "Layers",         color: "#6E5A7A", requires: "admin_or_master", hideForLimited: true },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "main",
    items: [
      { key: "home",      label: "Início",    labelKey: "sidebar.home",      route: "/",          icon: "Home",       requires: "always" },
      { key: "agencies",  label: "Agências",  labelKey: "sidebar.agencies",  route: "/agencies",  icon: "Building2",  requires: "admin_or_master" },
      { key: "favorites", label: "Favoritos", labelKey: "sidebar.favorites", route: "/favorites", icon: "Star",       requires: "always" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    requires: "admin_or_master",
    items: [
      { key: "users",     label: "Usuários",   labelKey: "sidebar.admin_users", route: "/admin",            icon: "Users",      requires: "admin_or_master" },
      { key: "approvals", label: "Aprovações", labelKey: "sidebar.approvals",   route: "/approvals",        icon: "CheckSquare", requires: "admin_or_master" },
      { key: "backup",    label: "Backup",     route: "/admin?tab=backup", icon: "Database",   requires: "admin" },
    ],
  },
];

export const USER_MENU_ITEMS: UserMenuItem[] = [
  { key: "profile",  label: "Editar perfil",     icon: "User",     action: "open_profile",  requires: "always" },
  { key: "invite",   label: "Convidar usuário",  icon: "UserPlus", action: "open_invite",   requires: "admin_or_master" },
  { key: "search",   label: "Buscar",            icon: "Search",   action: "open_search",   requires: "always", shortcut: "⌘K" },
  { key: "settings", label: "Configurações",     icon: "Settings", action: "open_settings", requires: "always" },
  { key: "sign_out", label: "Sair",              icon: "LogOut",   action: "sign_out",      requires: "always", variant: "destructive" },
];

export interface PermissionContext {
  isAdmin: boolean;
  isMaster: boolean;
  isLimited: boolean;
  hasCampaignAccess: boolean;
}

export function checkPermission(p: Permission, ctx: PermissionContext): boolean {
  switch (p) {
    case "always": return true;
    case "admin": return ctx.isAdmin;
    case "admin_or_master": return ctx.isAdmin || ctx.isMaster;
    case "campaign_access": return ctx.hasCampaignAccess;
    case "limited_user_blocked": return !ctx.isLimited;
    default: return false;
  }
}

export function filterByPermission<T extends { requires: Permission }>(
  items: T[],
  ctx: PermissionContext,
): T[] {
  return items.filter((i) => checkPermission(i.requires, ctx));
}
