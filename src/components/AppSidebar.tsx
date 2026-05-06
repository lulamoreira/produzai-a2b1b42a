import { useState, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
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
import produzaiIcon from "@/assets/produzai-icon.svg";

// lucide icons imported below with CAMPAIGN_MODULE_KEYS
import { useLanguage } from "@/hooks/useLanguage";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";

import {
  Building2, Shield, LogOut, Users, Star, Home,
  PanelLeftClose, PanelLeft, Menu, X, ChevronDown, ChevronRight,
  Briefcase, Megaphone, Store, Grid3X3, LayoutList, AlertTriangle,
  CalendarDays, Camera, DollarSign, Database, Globe, Settings, LayoutGrid, Layers,
  Sun, Moon,
} from "lucide-react";

const CAMPAIGN_MODULE_KEYS = [
  { key: "scheduling", tKey: "modules.scheduling", icon: CalendarDays, color: "#5C6B3F" },
  { key: "installations", tKey: "modules.installations", icon: Camera, color: "#7B5E3A" },
  { key: "loja_a_loja", tKey: "modules.loja_a_loja", icon: LayoutGrid, color: "#5B7B5E" },
  { key: "stores", tKey: "modules.stores", icon: Store, color: "#6B4F2E" },
  { key: "occurrences", tKey: "modules.occurrences", icon: AlertTriangle, color: "#7A3B2E" },
  { key: "budgets", tKey: "modules.budgets", icon: DollarSign, color: "#4A5568" },
  { key: "pieces", tKey: "modules.pieces", icon: LayoutList, color: "#A07850" },
  { key: "matrix", tKey: "modules.matrix", icon: Grid3X3, color: "#8C6F4E" },
  { key: "adjustments", tKey: "modules.adjustments", icon: Layers, color: "#6E5A7A", adminOnly: true },
];

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
  const { displayName, avatarUrl } = useDisplayName();
  const { collapsed, setCollapsed } = useSidebarState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { currentLanguage, changeLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  // Admin menu expansion
  const [adminOpen, setAdminOpen] = useState(() => getStoredBool("produzai_admin_menu_open", false));

  // Campaign expansion states: campaignId -> boolean
  const [campaignExpanded, setCampaignExpanded] = useState<Record<string, boolean>>({});

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

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Logo area */}
      <div className="flex items-center gap-2 px-3 h-14 flex-shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
        <img src={produzaiIcon} alt="ProduzAI" className="w-7 h-7 rounded-lg flex-shrink-0" />
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

      {/* Breadcrumb contextual */}
      {!collapsed && isInsideAgency && (
        <div className="px-3 py-2 space-y-0.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
          {agencyName && (
            <div className="text-[11px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--brand-400, #A88B6A)" }}>
              {agencyName}
            </div>
          )}
          {(clientName || campaignName) && (
            <div className="text-[11px] truncate" style={{ color: "var(--sidebar-text, #A89880)" }}>
              {clientName}{campaignName ? ` › ${campaignName}` : ""}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">

        {/* ── Início (visible for all users) ── */}
        <button
          onClick={() => handleNavigate("/")}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative"
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative"
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
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative"
          style={itemStyle(location.pathname === "/favorites")}
          {...hoverHandlers(location.pathname === "/favorites")}
          title={collapsed ? t("sidebar.favorites", "Favoritos") : undefined}
        >
          <AquaIcon icon={Star} size="sm" color="#eab308" />
          {!collapsed && <span className="truncate font-medium">{t("sidebar.favorites", "Favoritos")}</span>}
        </button>

        {/* ── Admin (fixed, admin/master only) ── */}
        {isAdminOrMaster && (
          <div>
            <button
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
            {!collapsed && adminOpen && (
              <div className="ml-4 pl-2 mt-0.5 space-y-0.5" style={{ borderLeft: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
                <button
                  onClick={() => handleNavigate("/admin")}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                  style={itemStyle(location.pathname === "/admin" && !location.search.includes("tab=backup"))}
                  {...hoverHandlers(location.pathname === "/admin" && !location.search.includes("tab=backup"))}
                >
                  <AquaIcon icon={Users} size="xs" color="#7A3B2E" />
                  <span className="truncate">{t("sidebar.admin_users", "Usuários")}</span>
                </button>
                <button
                  onClick={() => handleNavigate("/approvals")}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                  style={itemStyle(location.pathname === "/approvals")}
                  {...hoverHandlers(location.pathname === "/approvals")}
                >
                  <AquaIcon icon={Shield} size="xs" color="#5C6B3F" />
                  <span className="truncate">{t("sidebar.approvals")}</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleNavigate("/admin?tab=backup")}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                    style={itemStyle(location.pathname === "/admin" && location.search.includes("tab=backup"))}
                    {...hoverHandlers(location.pathname === "/admin" && location.search.includes("tab=backup"))}
                  >
                    <AquaIcon icon={Database} size="xs" color="#4A5568" />
                    <span className="truncate">Backup</span>
                  </button>
                )}
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
                      <div key={camp.campaignId}>
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
                            onClick={() => toggleCampaignExpanded(camp.campaignId)}
                            className="flex-shrink-0 p-1 rounded transition-all"
                            style={{ color: isActiveCampaign ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
                          >
                            <ChevronDown className="w-3 h-3 opacity-40 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="ml-2 pl-2 space-y-0.5" style={{ borderLeft: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
                            {CAMPAIGN_MODULE_KEYS.filter(mod => {
                              if (mod.key === "budgets") return false;
                              if (mod.key === "history") return false;
                              if ((mod as any).adminOnly && !isAdminOrMaster) return false;
                              if (mod.key === "adjustments") return isAdminOrMaster;
                              return camp.modules.includes(mod.key);
                            }).map((mod) => {
                              const modActive = isCampaignModuleActive(camp.campaignId, mod.key);
                              return (
                                <button
                                  key={mod.key}
                                  onClick={() => handleNavigate(`${campBasePath}?section=${mod.key}`)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                                  style={modActive
                                    ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
                                    : { color: "var(--sidebar-text)" }
                                  }
                                  {...hoverHandlers(modActive)}
                                >
                                  <AquaIcon icon={mod.icon} size="xs" color={mod.color} />
                                  <span className="truncate">{t(mod.tKey)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
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
                  <div key={camp.id}>
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
                        onClick={() => toggleCampaignExpanded(camp.id)}
                        className="flex-shrink-0 p-1 rounded transition-all"
                        style={{ color: isActiveCampaign ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
                      >
                        <ChevronDown className="w-3 h-3 opacity-40 transition-transform duration-200" style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="ml-2 pl-2 space-y-0.5" style={{ borderLeft: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}>
                        {CAMPAIGN_MODULE_KEYS.filter(mod => {
                          if (mod.key === "budgets" && !isAdminOrMaster) return false;
                          if (mod.key === "history") return false;
                          return true;
                        }).map((mod) => {
                          const modActive = isCampaignModuleActive(camp.id, mod.key);
                          return (
                            <button
                              key={mod.key}
                              onClick={() => handleNavigate(`${campBasePath}?section=${mod.key}`)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all"
                              style={modActive
                                ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
                                : { color: "var(--sidebar-text)" }
                              }
                              {...hoverHandlers(modActive)}
                            >
                              <AquaIcon icon={mod.icon} size="xs" color={mod.color} />
                              <span className="truncate">{t(mod.tKey)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
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
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: avatarUrl ? "transparent" : "var(--brand-600, #735A3D)" }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-[13px] font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
              )}
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
            {/* Dark mode toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
              style={{ color: "var(--sidebar-text, #A89880)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-item-hover)"; e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; }}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark"
                ? <Sun className="w-3.5 h-3.5 flex-shrink-0" />
                : <Moon className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
            <InviteButton />
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
