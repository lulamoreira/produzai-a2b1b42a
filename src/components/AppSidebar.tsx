import { useState, useEffect, useMemo, useCallback } from "react";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import EditProfileDialog from "@/components/EditProfileDialog";
import AquaIcon from "@/components/AquaIcon";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SettingsSheet } from "@/components/sidebar/SettingsSheet";
import { InviteUserDialog } from "@/components/sidebar/InviteUserDialog";
import { CampaignNavItem } from "@/components/sidebar/CampaignNavItem";
import { CAMPAIGN_MODULES, MODULE_ICONS, type UserMenuAction } from "@/lib/sidebarRegistry";
import { openGlobalSearch } from "@/lib/globalSearchBus";

// lucide icons imported below with CAMPAIGN_MODULE_KEYS
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";

import {
  Building2, Shield, Users, Star, Home,
  Menu, ChevronDown, ChevronRight,
  Briefcase, Megaphone, Store, Database, Settings,
} from "lucide-react";

// Legacy shape kept so the existing render code below works unchanged.
// Source of truth is sidebarRegistry.CAMPAIGN_MODULES.
const CAMPAIGN_MODULE_KEYS = CAMPAIGN_MODULES.map((m) => ({
  key: m.key,
  tKey: m.labelKey,
  icon: MODULE_ICONS[m.icon],
  color: m.color,
  fallbackLabel: m.label,
  adminOnly: m.requires === "admin_or_master" || m.requires === "admin",
}));

// localStorage helpers for expansion state
const getStoredBool = (key: string, fallback: boolean) => {
  try { const v = localStorage.getItem(key); return v !== null ? v === "true" : fallback; }
  catch { return fallback; }
};
const setStoredBool = (key: string, val: boolean) => {
  try { localStorage.setItem(key, String(val)); } catch {}
};

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdminOrMaster, isAdmin, isMaster } = useUserRole();
  const { isLimited, campaigns: limitedCampaigns } = useUserDirectAccess();

  // Group limitedCampaigns by clientId for multi-client sidebar rendering
  const limitedClientGroups = useMemo(() => {
    if (!isLimited || limitedCampaigns.length === 0) return [];
    const map = new Map<string, { clientName: string; clientId: string; agencyId: string; campaigns: typeof limitedCampaigns }>();
    for (const lc of limitedCampaigns) {
      if (!map.has(lc.clientId)) {
        map.set(lc.clientId, { clientName: lc.clientName, clientId: lc.clientId, agencyId: lc.agencyId, campaigns: [] });
      }
      map.get(lc.clientId)!.campaigns.push(lc);
    }
    return Array.from(map.values());
  }, [isLimited, limitedCampaigns]);
  const { collapsed, setCollapsed } = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Admin menu expansion
  const [adminOpen, setAdminOpen] = useState(() => getStoredBool("produzai_admin_menu_open", false));

  // Campaign expansion states (persisted across reloads as an id list).
  const [campaignExpanded, setCampaignExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("sidebar_expanded_campaigns");
      const arr: string[] = raw ? JSON.parse(raw) : [];
      return Object.fromEntries(arr.map((id) => [id, true]));
    } catch { return {}; }
  });
  useEffect(() => {
    try {
      const arr = Object.entries(campaignExpanded).filter(([, v]) => v).map(([k]) => k);
      localStorage.setItem("sidebar_expanded_campaigns", JSON.stringify(arr));
    } catch {}
  }, [campaignExpanded]);

  const handleUserAction = useCallback((action: UserMenuAction) => {
    switch (action) {
      case "open_profile":  setProfileOpen(true); break;
      case "open_invite":   setInviteOpen(true); break;
      case "open_settings": setSettingsOpen(true); break;
      case "open_search":   openGlobalSearch(); break;
      case "sign_out":      void signOut(); break;
    }
  }, [signOut]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname, location.search]);

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

  const currentSection = new URLSearchParams(location.search).get("section");

  // Fetch names for breadcrumb
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

  // Fetch ALL campaigns for the selected client
  const { data: clientCampaigns = [] } = useQuery({
    queryKey: ["sidebar-client-campaigns", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, color, display_order")
        .eq("client_id", clientId!)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  });

  // Auto-expand the active campaign and collapse all others.
  // Manual toggles via toggleCampaignExpanded still override this until campaignId changes again.
  useEffect(() => {
    if (campaignId) {
      setCampaignExpanded({ [campaignId]: true });
      try { setStoredBool(`produzai_campanha_${campaignId}_open`, true); } catch {}
    }
  }, [campaignId]);

  // Auto-expand admin if on admin page
  useEffect(() => {
    if (location.pathname.startsWith("/admin") || location.pathname === "/approvals") {
      setAdminOpen(true);
    }
  }, [location.pathname]);

  const toggleCampaignExpanded = useCallback((id: string) => {
    setCampaignExpanded(prev => {
      const next = !prev[id];
      setStoredBool(`produzai_campanha_${id}_open`, next);
      return { ...prev, [id]: next };
    });
  }, []);

  const toggleAdmin = useCallback(() => {
    setAdminOpen(prev => {
      setStoredBool("produzai_admin_menu_open", !prev);
      return !prev;
    });
  }, []);

  const handleNavigate = useCallback((href?: string) => {
    if (!href) return;
    setMobileOpen(false);
    navigate(href);
  }, [navigate]);

  const handleCampaignHomeNavigate = useCallback((href: string) => {
    setMobileOpen(false);
    navigate(href, { replace: href === `${location.pathname}${location.search}` });
  }, [location.pathname, location.search, navigate]);

  const roleBadge = isAdmin ? "Admin" : isMaster ? "Master" : "Usuário";
  const homePath = isAdminOrMaster ? "/agencies" : "/my-campaigns";

  // Helper: is a campaign module active?
  const isCampaignModuleActive = (cId: string, modKey: string) => {
    return campaignId === cId && currentSection === modKey;
  };

  // Style helpers
  const itemStyle = (active: boolean) => active
    ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", borderLeft: "3px solid var(--sidebar-active-bar)", fontWeight: 500 as const }
    : { color: "var(--sidebar-text)" };

  const hoverHandlers = (active: boolean) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) { e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; }
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; }
    },
  });

  // Auto-close drawer on mobile when any non-opt-out element inside is clicked.
  // Items that should keep the drawer open (toggles, expanders, theme/lang pickers)
  // mark themselves with `data-keep-open`.
  const handleSidebarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mobileOpen) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const actionable = target.closest("button, a, [role='menuitem']");
    if (!actionable) return;
    if ((actionable as HTMLElement).closest("[data-keep-open]")) return;
    setMobileOpen(false);
  }, [mobileOpen]);

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" onClick={handleSidebarClick}>
      <SidebarHeader
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onCloseMobile={() => setMobileOpen(false)}
        onUserAction={handleUserAction}
        agencyName={agencyName}
        clientName={clientName}
        campaignName={campaignName}
      />

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">

        {/* Section label: Geral */}
        {!collapsed && (
          <div className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1 mt-1 opacity-50">
            {t("sidebar.section_general", "Geral")}
          </div>
        )}

        {/* ── Início (visible for all users) ── */}
        <button
          onClick={() => handleNavigate("/")}
          className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
          style={itemStyle(location.pathname === "/" || location.pathname === "/favorites" || location.pathname === "/agencies" || location.pathname === "/my-campaigns")}
          {...hoverHandlers(location.pathname === "/" || location.pathname === "/favorites" || location.pathname === "/agencies" || location.pathname === "/my-campaigns")}
          title={collapsed ? t("sidebar.home", "Início") : undefined}
        >
          <AquaIcon icon={Home} size="sm" color="#8C6F4E" />
          {!collapsed && <span className="truncate font-medium">{t("sidebar.home", "Início")}</span>}
        </button>


        {/* ── Agências (admin/master only) ── */}
        {isAdminOrMaster && (
          <button
            onClick={() => handleNavigate("/agencies")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
            style={itemStyle(location.pathname === "/agencies")}
            {...hoverHandlers(location.pathname === "/agencies")}
            title={collapsed ? t("sidebar.agencies", "Agências") : undefined}
          >
            <AquaIcon icon={Building2} size="sm" color="#8C6F4E" />
            {!collapsed && <span className="truncate font-medium">{t("sidebar.agencies", "Agências")}</span>}
          </button>
        )}

        {/* ── Favoritos (all authenticated users) ── */}
        <button
          onClick={() => handleNavigate("/favorites")}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
          style={itemStyle(location.pathname === "/favorites")}
          {...hoverHandlers(location.pathname === "/favorites")}
          title={collapsed ? t("sidebar.favorites", "Favoritos") : undefined}
        >
          <AquaIcon icon={Star} size="sm" color="#eab308" />
          {!collapsed && <span className="truncate font-medium">{t("sidebar.favorites", "Favoritos")}</span>}
        </button>

        {/* Section label: Administração */}
        {!collapsed && isAdminOrMaster && (
          <div className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1 mt-3 opacity-50">
            {t("sidebar.section_admin", "Administração")}
          </div>
        )}

        {/* ── Admin (fixed, admin/master only) ── */}
        {isAdminOrMaster && (
          <div>
            <button
              data-keep-open
              onClick={toggleAdmin}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all"
              style={itemStyle(location.pathname.startsWith("/admin") || location.pathname === "/approvals")}
              {...hoverHandlers(location.pathname.startsWith("/admin") || location.pathname === "/approvals")}
              title={collapsed ? t("header.admin") : undefined}
            >
              <AquaIcon icon={Settings} size="sm" color="#7A3B2E" />
              {!collapsed && (
                <>
                  <span className="truncate font-medium flex-1 text-left">{t("header.admin")}</span>
                  {adminOpen
                    ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                    : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                  }
                </>
              )}
            </button>
            {!collapsed && (
              <div className={`overflow-hidden transition-all duration-200 ease-out ${adminOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="relative ml-4 pl-3 mt-1 mb-1 space-y-0.5">
                  <span className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                  <button
                    onClick={() => handleNavigate("/admin")}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
                    style={itemStyle(location.pathname === "/admin" && !location.search.includes("tab=backup"))}
                    {...hoverHandlers(location.pathname === "/admin" && !location.search.includes("tab=backup"))}
                  >
                    <AquaIcon icon={Users} size="xs" color="#7A3B2E" />
                    <span className="truncate">{t("sidebar.admin_users", "Usuários")}</span>
                  </button>
                  <button
                    onClick={() => handleNavigate("/approvals")}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
                    style={itemStyle(location.pathname === "/approvals")}
                    {...hoverHandlers(location.pathname === "/approvals")}
                  >
                    <AquaIcon icon={Shield} size="xs" color="#5C6B3F" />
                    <span className="truncate">{t("sidebar.approvals")}</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => handleNavigate("/admin?tab=backup")}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
                      style={itemStyle(location.pathname === "/admin" && location.search.includes("tab=backup"))}
                      {...hoverHandlers(location.pathname === "/admin" && location.search.includes("tab=backup"))}
                    >
                      <AquaIcon icon={Database} size="xs" color="#4A5568" />
                      <span className="truncate">Backup</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Separator */}
        {isInsideAgency && (
          <div className="my-2" style={{ borderTop: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }} />
        )}

        {/* ── Clientes (when inside agency, hidden for limited users) ── */}
        {isInsideAgency && !isLimited && (
          <button
            onClick={() => handleNavigate(`/agency/${agencyId}`)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative"
            style={itemStyle(location.pathname === `/agency/${agencyId}` && !isInsideClient)}
            {...hoverHandlers(location.pathname === `/agency/${agencyId}` && !isInsideClient)}
            title={collapsed ? t("sidebar.clients") : undefined}
          >
            <AquaIcon icon={Briefcase} size="sm" color="#735A3D" />
            {!collapsed && <span className="truncate font-medium">{t("sidebar.clients")}</span>}
          </button>
        )}

        {/* ── Limited user: render ALL permitted clients & campaigns ── */}
        {isLimited && !collapsed && limitedClientGroups.length > 0 && (
          <>
            {limitedClientGroups.map((group) => (
              <div key={group.clientId}>
                <div className="px-2.5 pt-3 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--brand-300, #C4AD92)" }}>
                    {group.clientName}
                  </span>
                </div>
                <div className="ml-6 space-y-0.5 mt-0.5">
                  {group.campaigns.map((camp) => {
                    const isExpanded = campaignExpanded[camp.campaignId] ?? (camp.campaignId === campaignId);
                    const isActiveCampaign = campaignId === camp.campaignId;
                    const campBasePath = `/agency/${group.agencyId}/clients/${group.clientId}/campaigns/${camp.campaignId}`;
                    return (
                      <div key={camp.campaignId} className={`rounded-md ${isActiveCampaign ? "bg-muted/30" : ""}`}>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleCampaignHomeNavigate(campBasePath)}
                            className="flex-1 truncate text-left px-2 py-1.5 rounded-md text-[12px] font-semibold uppercase tracking-wider transition-all"
                            style={{ color: isActiveCampaign ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
                            onMouseLeave={e => { if (!isActiveCampaign) e.currentTarget.style.color = "var(--brand-300, #C4AD92)"; }}
                          >
                            {camp.campaignName}
                          </button>
                          <button
                            data-keep-open
                            onClick={() => toggleCampaignExpanded(camp.campaignId)}
                            className="flex-shrink-0 p-1 rounded transition-all"
                            style={{ color: isActiveCampaign ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
                          >
                            <ChevronDown className="w-3 h-3 opacity-40 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                          </button>
                        </div>
                        <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
                          <div className="relative ml-2 pl-3 mt-1 mb-1 space-y-0.5">
                            <span className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                            {CAMPAIGN_MODULE_KEYS.filter(mod => {
                              if (mod.key === "budgets") return false;
                              if (mod.key === "history") return false;
                              if ((mod as any).adminOnly && !isAdminOrMaster) return false;
                              if (mod.key === "adjustments") return isAdminOrMaster;
                              if (mod.key === "mockup") return camp.modules.includes("pieces");
                              return camp.modules.includes(mod.key);
                            }).map((mod) => {
                              const modActive = isCampaignModuleActive(camp.campaignId, mod.key);
                              return (
                                <button
                                  key={mod.key}
                                  onClick={() => handleNavigate(`${campBasePath}?section=${mod.key}`)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-all relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
                                  style={modActive
                                    ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
                                    : { color: "var(--sidebar-text)" }
                                  }
                                  {...hoverHandlers(modActive)}
                                >
                                  <AquaIcon icon={mod.icon} size="xs" color={mod.color} />
                                  <span className="truncate">{(mod as any).fallbackLabel ? t(mod.tKey, { defaultValue: (mod as any).fallbackLabel }) : t(mod.tKey)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Client context: Lojas + Campanhas (non-limited users only) ── */}
        {!isLimited && isInsideClient && !collapsed && (
          <>
            <div className="px-2.5 pt-3 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--brand-300, #C4AD92)" }}>
                {clientName || t("sidebar.clients")}
              </span>
            </div>
            <button
              onClick={() => handleNavigate(`/agency/${agencyId}/clients/${clientId}?tab=stores`)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-all ml-2"
              style={itemStyle(location.search.includes("tab=stores") && !isInsideCampaign)}
              {...hoverHandlers(location.search.includes("tab=stores") && !isInsideCampaign)}
            >
              <AquaIcon icon={Store} size="xs" color="#6B4F2E" />
              <span className="truncate">{t("modules.stores")}</span>
            </button>
            <button
              onClick={() => handleNavigate(`/agency/${agencyId}/clients/${clientId}`)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-all ml-2"
              style={itemStyle(location.pathname === `/agency/${agencyId}/clients/${clientId}` && !location.search.includes("tab=stores") && !isInsideCampaign)}
              {...hoverHandlers(location.pathname === `/agency/${agencyId}/clients/${clientId}` && !location.search.includes("tab=stores") && !isInsideCampaign)}
            >
              <AquaIcon icon={Megaphone} size="xs" color="#8C6F4E" />
              <span className="truncate">{t("sidebar.campaigns")}</span>
            </button>
            <div className="ml-6 space-y-0.5 mt-0.5">
              {clientCampaigns.map((camp) => {
                const isExpanded = campaignExpanded[camp.id] ?? (camp.id === campaignId);
                const isActiveCampaign = campaignId === camp.id;
                const campBasePath = `/agency/${agencyId}/clients/${clientId}/campaigns/${camp.id}`;
                return (
                  <div key={camp.id} className={`rounded-md ${isActiveCampaign ? "bg-muted/30" : ""}`}>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleCampaignHomeNavigate(campBasePath)}
                        className="flex-1 truncate text-left px-2 py-1.5 rounded-md text-[12px] font-semibold uppercase tracking-wider transition-all"
                        style={{ color: isActiveCampaign ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
                        onMouseLeave={e => { if (!isActiveCampaign) e.currentTarget.style.color = "var(--brand-300, #C4AD92)"; }}
                      >
                        {camp.name}
                      </button>
                      <button
                        data-keep-open
                        onClick={() => toggleCampaignExpanded(camp.id)}
                        className="flex-shrink-0 p-1 rounded transition-all"
                        style={{ color: isActiveCampaign ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
                      >
                        <ChevronDown className="w-3 h-3 opacity-40 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                      </button>
                    </div>
                    <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
                      <div className="relative ml-2 pl-3 mt-1 mb-1 space-y-0.5">
                        <span className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                        {CAMPAIGN_MODULE_KEYS.filter(mod => {
                          if (mod.key === "budgets" && !isAdminOrMaster) return false;
                          if (mod.key === "history") return false;
                          if ((mod as any).adminOnly && !isAdminOrMaster) return false;
                          return true;
                        }).map((mod) => {
                          const modActive = isCampaignModuleActive(camp.id, mod.key);
                          return (
                            <button
                              key={mod.key}
                              onClick={() => handleNavigate(`${campBasePath}?section=${mod.key}`)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-all relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
                              style={modActive
                                ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
                                : { color: "var(--sidebar-text)" }
                              }
                              {...hoverHandlers(modActive)}
                            >
                              <AquaIcon icon={mod.icon} size="xs" color={mod.color} />
                              <span className="truncate">{(mod as any).fallbackLabel ? t(mod.tKey, { defaultValue: (mod as any).fallbackLabel }) : t(mod.tKey)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer — single Settings entry; identity & sign-out live in the header user menu */}
      <div
        className="shrink-0"
        style={{
          borderTop: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="px-2 pt-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-[13px] transition-all ${collapsed ? "justify-center" : ""}`}
            style={{ color: "var(--sidebar-text, #A89880)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--sidebar-item-hover)";
              e.currentTarget.style.color = "var(--sidebar-text-active)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--sidebar-text)";
            }}
            title={collapsed ? t("settings.title", "Configurações") : undefined}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <span className="truncate font-medium">{t("settings.title", "Configurações")}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-40 md:hidden w-9 h-9 rounded-lg flex items-center justify-center shadow-lg"
        style={{ background: "var(--sidebar-bg, #1C1916)", color: "var(--sidebar-text-active, #F5EFE6)" }}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh flex-col w-[280px] overflow-hidden transition-transform duration-300 md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--sidebar-bg, #1C1916)", borderRight: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden h-dvh max-h-dvh md:flex flex-col overflow-hidden transition-all duration-300 ${collapsed ? "w-[60px]" : "w-[220px]"}`}
        style={{ background: "var(--sidebar-bg, #1C1916)", borderRight: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}
      >
        {sidebarContent}
      </aside>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
