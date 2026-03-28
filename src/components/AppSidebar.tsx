import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDisplayName, getGreeting } from "@/components/AppHeader";
import { WhatsNewButton } from "@/components/WhatsNewSheet";
import { InviteButton } from "@/components/InviteButton";
import EditProfileDialog from "@/components/EditProfileDialog";
import AquaIcon from "@/components/AquaIcon";

import {
  Building2, MessageSquare, Shield, LogOut, Users,
  PanelLeftClose, PanelLeft, Menu, X, ChevronDown, ChevronRight,
  Briefcase, Megaphone, Store, Grid3X3, LayoutList, AlertTriangle,
  CalendarDays, Camera, DollarSign, Home,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  active?: boolean;
  color?: string;
  children?: NavItem[];
  badge?: number;
}

const CAMPAIGN_MODULES = [
  { key: "stores", label: "Lojas", icon: Store, color: "#6366f1" },
  { key: "matrix", label: "Matriz", icon: Grid3X3, color: "#8b5cf6" },
  { key: "pieces", label: "Peças", icon: LayoutList, color: "#3b82f6" },
  { key: "occurrences", label: "Ocorrências", icon: AlertTriangle, color: "#ef4444" },
  { key: "scheduling", label: "Agendamento", icon: CalendarDays, color: "#22c55e" },
  { key: "installations", label: "Instalações", icon: Camera, color: "#f97316" },
  { key: "budgets", label: "Orçamentos", icon: DollarSign, color: "#14b8a6" },
  { key: "chat", label: "Chat", icon: MessageSquare, color: "#06b6d4" },
];

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdminOrMaster, isAdmin, isMaster } = useUserRole();
  const displayName = useDisplayName();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});


  useEffect(() => { setMobileOpen(false); }, [location.pathname, location.search]);

  // Extract context from URL
  const pathParts = location.pathname.split("/");
  const agencyIdx = pathParts.indexOf("agency");
  const agencyId = agencyIdx !== -1 ? pathParts[agencyIdx + 1] : undefined;
  const clientsIdx = pathParts.indexOf("clients");
  const clientId = clientsIdx !== -1 ? pathParts[clientsIdx + 1] : undefined;
  const campaignsIdx = pathParts.indexOf("campaigns");
  const campaignId = campaignsIdx !== -1 ? pathParts[campaignsIdx + 1] : undefined;

  const isInsideAgency = !!agencyId;
  const isInsideClient = !!clientId;
  const isInsideCampaign = !!campaignId;

  const currentSection = new URLSearchParams(location.search).get("section");

  const roleBadge = isAdmin ? "Admin" : isMaster ? "Master" : "Usuário";

  // Home path depends on user type
  const homePath = isAdminOrMaster ? "/" : "/my-campaigns";

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith("/admin") || location.pathname === "/approvals") {
      setExpandedGroups((prev) => ({ ...prev, admin: true }));
    }
    if (isInsideCampaign) {
      setExpandedGroups((prev) => ({ ...prev, módulos: true }));
    }
  }, [location.pathname, isInsideCampaign]);

  const campaignBasePath = isInsideCampaign
    ? `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}`
    : "";

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      {
        label: "Início",
        icon: Home,
        href: homePath,
        active: location.pathname === homePath || location.pathname === "/" || location.pathname === "/agency-select",
        color: "#6366f1",
      },
    ];

    if (isInsideAgency) {
      items.push({
        label: "Clientes",
        icon: Briefcase,
        href: `/agency/${agencyId}`,
        active: location.pathname === `/agency/${agencyId}`,
        color: "#8b5cf6",
      });
    }

    if (isInsideClient) {
      items.push({
        label: "Campanhas",
        icon: Megaphone,
        href: `/agency/${agencyId}/clients/${clientId}`,
        active: location.pathname === `/agency/${agencyId}/clients/${clientId}` && !location.search.includes("tab=stores"),
        color: "#3b82f6",
      });
      items.push({
        label: "Lojas",
        icon: Store,
        href: `/agency/${agencyId}/clients/${clientId}?tab=stores`,
        active: location.search.includes("tab=stores"),
        color: "#6366f1",
      });
    }

    if (isInsideCampaign) {
      items.push({
        label: "Módulos",
        icon: Grid3X3,
        color: "#8b5cf6",
        active: !!currentSection,
        children: CAMPAIGN_MODULES.map((mod) => ({
          label: mod.label,
          icon: mod.icon,
          color: mod.color,
          href: `${campaignBasePath}?section=${mod.key}`,
          active: currentSection === mod.key,
        })),
      });
    }

    // Chat is now campaign-scoped, no standalone nav item

    if (isAdminOrMaster) {
      items.push({
        label: "Admin",
        icon: Shield,
        color: "#f97316",
        active: location.pathname.startsWith("/admin") || location.pathname === "/approvals",
        children: [
          {
            label: "Painel Admin",
            icon: Shield,
            href: "/admin",
            active: location.pathname === "/admin",
            color: "#f97316",
          },
          {
            label: "Aprovações",
            icon: Users,
            href: "/approvals",
            active: location.pathname === "/approvals",
            color: "#22c55e",
          },
        ],
      });
    }

    return items;
  }, [location.pathname, currentSection, isInsideAgency, isInsideClient, isInsideCampaign, agencyId, clientId, campaignBasePath, isAdminOrMaster, homePath]);

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const groupKey = item.label.toLowerCase();
      const isExpanded = expandedGroups[groupKey] ?? false;
      const hasActiveChild = item.children.some((c) => c.active);
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleGroup(groupKey)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all ${
              hasActiveChild
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <AquaIcon icon={item.icon} size="sm" color={item.color} />
            {!collapsed && (
              <>
                <span className="truncate font-medium flex-1 text-left">{item.label}</span>
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0" />
                }
              </>
            )}
          </button>
          {!collapsed && isExpanded && (
            <div className="ml-4 pl-2 border-l border-sidebar-border/50 mt-0.5 space-y-0.5">
              {item.children.map((child) => (
                <button
                  key={child.label}
                  onClick={() => child.href && navigate(child.href)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                    child.active
                      ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                  }`}
                >
                  <AquaIcon icon={child.icon} size="xs" color={child.color} />
                  <span className="truncate">{child.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.label}
        onClick={() => item.href && navigate(item.href)}
        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all relative ${
          item.active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
        title={collapsed ? item.label : undefined}
      >
        <div className="relative flex-shrink-0">
          <AquaIcon icon={item.icon} size="sm" color={item.color} />
          {item.badge && item.badge > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </div>
        {!collapsed && (
          <>
            <span className="truncate font-medium">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-sidebar-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-black text-white">P</span>
        </div>
        {!collapsed && <span className="text-sm font-bold text-sidebar-foreground tracking-tight truncate">ProduzAI</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0 hidden lg:block"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="ml-auto text-sidebar-foreground/50 lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Greeting */}
      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-sidebar-border">
          <p className="text-sm font-bold text-sidebar-foreground">{getGreeting()}, {displayName}!</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map(renderNavItem)}
      </nav>

      {/* Utility */}
      <div className="px-2 pb-2 border-t border-sidebar-border pt-2">
        <div className={`flex ${collapsed ? "flex-col" : ""} items-center gap-1`}>
          <InviteButton />
          <WhatsNewButton />
        </div>
      </div>

      {/* User area */}
      <div className="px-2 pb-3 border-t border-sidebar-border pt-2">
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-primary">{displayName.charAt(0).toUpperCase()}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold truncate text-sidebar-foreground">{displayName}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{roleBadge}</p>
            </div>
          )}
        </button>
        <button
          onClick={signOut}
          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all ${collapsed ? "justify-center" : ""}`}
          title="Sair"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 lg:hidden w-9 h-9 rounded-lg bg-sidebar flex items-center justify-center text-sidebar-foreground shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed top-0 left-0 h-screen z-50 flex flex-col bg-sidebar border-r border-sidebar-border w-[220px] transition-transform duration-300 lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`fixed top-0 left-0 h-screen z-30 hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${collapsed ? "w-[60px]" : "w-[220px]"}`}>
        {sidebarContent}
      </aside>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
