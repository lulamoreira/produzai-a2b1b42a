import { useState, useEffect, useMemo, useCallback } from "react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
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
  CalendarDays, Camera, DollarSign, Home, Database, Globe,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  active?: boolean;
  color?: string;
  children?: NavItem[];
  badge?: number;
}

const CAMPAIGN_MODULE_KEYS = [
  { key: "stores", tKey: "modules.stores", icon: Store, color: "#6B4F2E" },
  { key: "matrix", tKey: "modules.matrix", icon: Grid3X3, color: "#8C6F4E" },
  { key: "pieces", tKey: "modules.pieces", icon: LayoutList, color: "#A07850" },
  { key: "occurrences", tKey: "modules.occurrences", icon: AlertTriangle, color: "#7A3B2E" },
  { key: "scheduling", tKey: "modules.scheduling", icon: CalendarDays, color: "#5C6B3F" },
  { key: "installations", tKey: "modules.installations", icon: Camera, color: "#7B5E3A" },
  { key: "budgets", tKey: "modules.budgets", icon: DollarSign, color: "#4A5568" },
  { key: "chat", tKey: "modules.chat", icon: MessageSquare, color: "#5A4A3A" },
];

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdminOrMaster, isAdmin, isMaster } = useUserRole();
  const displayName = useDisplayName();
  const { collapsed, setCollapsed } = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { currentLanguage, changeLanguage } = useLanguage();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});


  useEffect(() => { setMobileOpen(false); }, [location.pathname, location.search]);

  // Sync body attribute so other components (e.g. back button) can react
  useEffect(() => {
    document.body.setAttribute("data-sidebar-mobile-open", mobileOpen ? "true" : "false");
    return () => { document.body.removeAttribute("data-sidebar-mobile-open"); };
  }, [mobileOpen]);

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

  // Fetch names for context indicator
  const { data: agencyName } = useQuery({
    queryKey: ["sidebar-agency", agencyId],
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId!).maybeSingle();
      return data?.name ?? null;
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clientName } = useQuery({
    queryKey: ["sidebar-client", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("name").eq("id", clientId!).maybeSingle();
      return data?.name ?? null;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: campaignName } = useQuery({
    queryKey: ["sidebar-campaign", campaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("name").eq("id", campaignId!).maybeSingle();
      return data?.name ?? null;
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000,
  });

  const currentSection = new URLSearchParams(location.search).get("section");

  const roleBadge = isAdmin ? "Admin" : isMaster ? "Master" : "Usuário";

  // Home path depends on user type
  const homePath = isAdminOrMaster ? "/" : "/my-campaigns";

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleNavigate = useCallback((href?: string) => {
    if (!href) return;
    setMobileOpen(false);
    navigate(href);
  }, [navigate]);

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
        label: t("sidebar.home"),
        icon: Home,
        href: homePath,
        active: location.pathname === homePath || location.pathname === "/" || location.pathname === "/agency-select",
        color: "#8C6F4E",
      },
    ];

    if (isInsideAgency) {
      items.push({
        label: t("sidebar.clients"),
        icon: Briefcase,
        href: `/agency/${agencyId}`,
        active: location.pathname === `/agency/${agencyId}`,
        color: "#735A3D",
      });
    }

    if (isInsideClient) {
      items.push({
        label: t("modules.stores"),
        icon: Store,
        href: `/agency/${agencyId}/clients/${clientId}?tab=stores`,
        active: location.search.includes("tab=stores"),
        color: "#6B4F2E",
      });
      items.push({
        label: t("sidebar.campaigns"),
        icon: Megaphone,
        href: `/agency/${agencyId}/clients/${clientId}`,
        active: location.pathname === `/agency/${agencyId}/clients/${clientId}` && !location.search.includes("tab=stores"),
        color: "#8C6F4E",
      });
    }

    if (isInsideCampaign) {
      items.push({
        label: campaignName || t("sidebar.campaigns"),
        icon: Grid3X3,
        color: "#8C6F4E",
        active: !!currentSection,
        children: CAMPAIGN_MODULE_KEYS.map((mod) => ({
          label: t(mod.tKey),
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
        label: t("header.admin"),
        icon: Shield,
        color: "#7A3B2E",
        active: location.pathname.startsWith("/admin") || location.pathname === "/approvals",
        children: [
          {
            label: t("header.admin"),
            icon: Shield,
            href: "/admin",
            active: location.pathname === "/admin" && !location.search.includes("tab=backup"),
            color: "#7A3B2E",
          },
          {
            label: t("sidebar.approvals"),
            icon: Users,
            href: "/approvals",
            active: location.pathname === "/approvals",
            color: "#5C6B3F",
          },
        ],
      });
    }

    if (isAdmin) {
      items.push({
        label: "Backup",
        icon: Database,
        color: "#4A5568",
        href: "/admin?tab=backup",
        active: location.pathname === "/admin" && location.search.includes("tab=backup"),
      });
    }

    return items;
  }, [location.pathname, location.search, currentSection, isInsideAgency, isInsideClient, isInsideCampaign, agencyId, clientId, campaignBasePath, isAdminOrMaster, isAdmin, homePath, campaignName, t]);

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const groupKey = item.label.toLowerCase();
      const isExpanded = expandedGroups[groupKey] ?? false;
      const hasActiveChild = item.children.some((c) => c.active);
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleGroup(groupKey)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all"
            style={hasActiveChild
              ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)" }
              : { color: "var(--sidebar-text)" }
            }
            onMouseEnter={e => { if (!hasActiveChild) e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
            onMouseLeave={e => { if (!hasActiveChild) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; } }}
            title={collapsed ? item.label : undefined}
          >
            <AquaIcon icon={item.icon} size="sm" color={item.color} />
            {!collapsed && (
              <>
                <span className="truncate font-medium flex-1 text-left">{item.label}</span>
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                  : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                }
              </>
            )}
          </button>
          {!collapsed && isExpanded && (
            <div className="ml-4 pl-2 mt-0.5 space-y-0.5" style={{ borderLeft: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
              {item.children.map((child) => (
                <button
                  key={child.label}
                  onClick={() => handleNavigate(child.href)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                  style={child.active
                    ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
                    : { color: "var(--sidebar-text)" }
                  }
                  onMouseEnter={e => { if (!child.active) { e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; } }}
                  onMouseLeave={e => { if (!child.active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; } }}
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
        onClick={() => handleNavigate(item.href)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative"
        style={item.active
          ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", borderLeft: "3px solid var(--sidebar-active-bar)", fontWeight: 500 }
          : { color: "var(--sidebar-text)" }
        }
        onMouseEnter={e => { if (!item.active) { e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; } }}
        onMouseLeave={e => { if (!item.active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; } }}
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Logo area */}
      <div className="flex items-center gap-2 px-3 h-14 flex-shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-500, #8C6F4E)" }}>
          <span className="text-sm font-bold text-white">P</span>
        </div>
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight truncate" style={{ color: "var(--sidebar-text-active, #F5EFE6)" }}>ProduzAI</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto transition-colors flex-shrink-0 hidden lg:block"
          style={{ color: "var(--sidebar-text, #A89880)" }}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden" style={{ color: "var(--sidebar-text, #A89880)" }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Greeting */}
      {!collapsed && (
        <div className="px-3 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
          <p className="text-sm font-bold" style={{ color: "var(--sidebar-text-active, #F5EFE6)" }}>{getGreeting()}, {displayName}!</p>
        </div>
      )}

      {/* Context breadcrumb */}
      {!collapsed && isInsideAgency && (
        <div className="px-3 py-2 space-y-0.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
          <div className="text-[11px] truncate" style={{ color: "var(--sidebar-text, #A89880)" }}>
            {agencyName && <span>{agencyName}</span>}
            {clientName && <span> › {clientName}</span>}
            {campaignName && <span> › {campaignName}</span>}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map(renderNavItem)}
      </nav>

      {/* Footer */}
      <div className="shrink-0" style={{ borderTop: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <div className="px-2 pt-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all"
            style={{ color: "var(--sidebar-text, #A89880)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--brand-600, #735A3D)" }}>
              <span className="text-[13px] font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            {!collapsed && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sidebar-text-active, #F5EFE6)" }}>{displayName}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--sidebar-text, #A89880)" }}>{roleBadge}</p>
              </div>
            )}
          </button>
          <button
            onClick={signOut}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[12px] transition-all ${collapsed ? "justify-center" : ""}`}
            style={{ color: "var(--sidebar-text, #A89880)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--s-danger, #DC2626)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--sidebar-text, #A89880)"; }}
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <div className="px-2 pt-2" style={{ borderTop: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
          <div className={`flex ${collapsed ? "flex-col" : ""} items-center gap-1`}>
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
                style={{ color: "var(--sidebar-text, #A89880)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; }}
                title={t("common.language")}
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium">
                    {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.flag || "🇧🇷"}
                  </span>
                )}
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 w-48">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { changeLanguage(lang.code as SupportedLanguage); setLangOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors ${currentLanguage === lang.code ? "bg-accent font-semibold" : ""}`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <InviteButton />
            {/* <WhatsNewButton /> */}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 lg:hidden w-9 h-9 rounded-lg flex items-center justify-center shadow-lg"
        style={{ background: "var(--sidebar-bg, #1C1916)", color: "var(--sidebar-text-active, #F5EFE6)" }}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh flex-col w-[220px] overflow-hidden transition-transform duration-300 lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--sidebar-bg, #1C1916)", borderRight: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden h-dvh max-h-dvh lg:flex flex-col overflow-hidden transition-all duration-300 ${collapsed ? "w-[60px]" : "w-[220px]"}`}
        style={{ background: "var(--sidebar-bg, #1C1916)", borderRight: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}
      >
        {sidebarContent}
      </aside>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
