import { Users, Mail, Tag, MessageSquare, Bell, CheckSquare, Palette, Image, Database, Home, type LucideIcon } from "lucide-react";

export type AdminRole = "all" | "admin-only";

export interface AdminMenuItem {
  key: string;           // valor do tab (ex: "users")
  label: string;         // label exibida no sidebar e na tab
  icon: LucideIcon;
  access: AdminRole;     // "all" = admin+master, "admin-only" = só admin
}

export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { key: "home",         label: "Painel Administrativo", icon: Home,          access: "all" },
  { key: "users",        label: "Usuários",       icon: Users,         access: "all" },
  { key: "invites",      label: "Convites",       icon: Mail,          access: "all" },
  { key: "categories",   label: "Categorias",     icon: Tag,           access: "all" },
  { key: "messages",     label: "Mensagens",      icon: MessageSquare, access: "all" },
  { key: "notificacoes", label: "Notificações",   icon: Bell,          access: "all" },
  { key: "approvals",    label: "Aprovações",     icon: CheckSquare,   access: "all" },
  { key: "appearance",   label: "Aparência",      icon: Palette,       access: "admin-only" },
  { key: "images",       label: "Imagens",        icon: Image,         access: "admin-only" },
  { key: "backup",       label: "Backup",         icon: Database,      access: "admin-only" },
];
