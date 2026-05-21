import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, NavLink, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Home, 
  Building2, 
  Star, 
  Users, 
  CheckSquare,
  Database,
  Megaphone,
  Store,
  Mail,
  ChevronDown,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CAMPAIGN_MODULES, MODULE_ICONS } from "@/lib/sidebarRegistry";
import AquaIcon from "@/components/AquaIcon";

export function SidebarV2() {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdminOrMaster, isAdmin, isMaster } = useUserRole();
  const { isLimited, campaigns: limitedCampaigns } = useUserDirectAccess();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-v2-collapsed") === "true";
  });

  // Campaign expansion states
  const [campaignExpanded, setCampaignExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("sidebar_v2_expanded_campaigns");
      const arr: string[] = raw ? JSON.parse(raw) : [];
      return Object.fromEntries(arr.map((id) => [id, true]));
    } catch { return {}; }
  });

  useEffect(() => {
    try {
      const arr = Object.entries(campaignExpanded).filter(([, v]) => v).map(([k]) => k);
      localStorage.setItem("sidebar_v2_expanded_campaigns", JSON.stringify(arr));
    } catch {}
  }, [campaignExpanded]);

  useEffect(() => {
    localStorage.setItem("sidebar-v2-collapsed", String(collapsed));
  }, [collapsed]);

  // Auto-expand the active campaign
  useEffect(() => {
    if (campaignId) {
      setCampaignExpanded(prev => ({ ...prev, [campaignId]: true }));
    }
  }, [campaignId]);

  const toggleSidebar = () => setCollapsed(!collapsed);

  const toggleCampaignExpanded = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCampaignExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Group limitedCampaigns by clientId
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

  // Fetch contextual names
  const { data: agencyData } = useQuery({
    queryKey: ["sidebar-v2-agency", agencyId],
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId!).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });

  const { data: clientData } = useQuery({
    queryKey: ["sidebar-v2-client", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("name").eq("id", clientId!).maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const { data: campaignData } = useQuery({
    queryKey: ["sidebar-v2-campaign", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, color, display_order, client_id")
        .eq("id", campaignId!)
        .maybeSingle();
      
      if (!data) return null;

      // Fetch modules using untyped select to bypass TS errors if needed
      const { data: modData } = await (supabase as any)
        .from("campaign_modules")
        .select("module_key")
        .eq("campaign_id", campaignId!);

      return {
        ...data,
        modules: modData?.map((m: any) => m.module_key) || []
      };
    },
    enabled: !!campaignId,
  });

  const { data: clientCampaigns = [] } = useQuery({
    queryKey: ["sidebar-v2-client-campaigns", clientId],
    queryFn: async () => {
      const { data: camps } = await supabase
        .from("campaigns")
        .select("id, name, color, display_order")
        .eq("client_id", clientId!)
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      
      if (!camps) return [];

      const campIds = camps.map(c => c.id);
      const { data: modData } = await (supabase as any)
        .from("campaign_modules")
        .select("campaign_id, module_key")
        .in("campaign_id", campIds);

      return camps.map(camp => ({
        ...camp,
        modules: modData?.filter((m: any) => m.campaign_id === camp.id).map((m: any) => m.module_key) || []
      }));
    },
    enabled: !!clientId && !isLimited,
  });




  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("sidebar-v2-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (payload) => {
        const row: any = (payload as any).new ?? (payload as any).old ?? {};
        qc.invalidateQueries({ queryKey: ["sidebar-v2-campaign", row.id] });
        if (row.client_id) qc.invalidateQueries({ queryKey: ["sidebar-v2-client-campaigns", row.client_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const mainNavItems = useMemo(() => {
    const items = [
      {
        label: t("sidebar.home"),
        icon: Home,
        route: "/",
        exact: true,
      },
    ];

    if (isAdminOrMaster) {
      items.push({
        label: t("sidebar.agencies"),
        icon: Building2,
        route: "/agencies",
        exact: false,
      });
    }

    items.push({
      label: t("sidebar.favorites"),
      icon: Star,
      route: "/favorites",
      exact: false,
    });

    return items;
  }, [isAdminOrMaster, t]);

  const adminItems = useMemo(() => {
    if (!isAdminOrMaster) return [];
    const items = [
      {
        label: t("sidebar.admin_users", "Usuários"),
        icon: Users,
        route: "/admin",
      },
      {
        label: t("sidebar.approvals"),
        icon: CheckSquare,
        route: "/approvals",
      },
    ];
    if (isAdmin) {
      items.push({
        label: "Backup",
        icon: Database,
        route: "/admin?tab=backup",
      });
    }
    return items;
  }, [isAdminOrMaster, isAdmin, t]);

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

  const NavItem = ({ item, isSubItem = false, activeOverride }: { item: any, isSubItem?: boolean, activeOverride?: boolean }) => {
    const isActive = activeOverride !== undefined ? activeOverride : (item.exact ? location.pathname === item.route : location.pathname.startsWith(item.route));
    
    const content = (
      <NavLink
        to={item.route}
        className={cn(
          "w-full flex items-center gap-3 py-2 px-3 transition-all duration-200 group relative",
          isSubItem ? "pl-9 text-xs" : "text-sm font-medium",
          isActive
            ? "bg-stone-800 text-white border-l-2 border-brand-400 rounded-r-lg"
            : "text-stone-300 hover:bg-stone-800/60 hover:text-white rounded-lg"
        )}
      >
        {item.icon && (
          <item.icon
            className={cn(
              isSubItem ? "w-3.5 h-3.5" : "w-5 h-5",
              "flex-shrink-0 transition-colors",
              isActive ? "text-brand-400" : "text-stone-400 group-hover:text-stone-200"
            )}
            style={isSubItem && item.color ? { color: item.color } : {}}
          />
        )}
        {!collapsed && (
          <span className="truncate">
            {item.label}
          </span>
        )}
      </NavLink>
    );

    if (collapsed && !isSubItem) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  const CampaignItem = ({ camp, agencyId, clientId }: { camp: any, agencyId: string, clientId: string }) => {
    const isExpanded = campaignExpanded[camp.id];
    const campBasePath = `/agency/${agencyId}/clients/${clientId}/campaigns/${camp.id}`;
    const isActiveCampaign = campaignId === camp.id;
    const currentSection = new URLSearchParams(location.search).get("section") || "summary";

    const filteredModules = CAMPAIGN_MODULES.filter(mod => {
      if (mod.requires === "admin_or_master" && !isAdminOrMaster) return false;
      if (mod.hideForLimited && isLimited) return false;
      if (mod.requiresCampaignModule && camp.modules && !camp.modules.includes(mod.requiresCampaignModule)) return false;
      // Note: we can't easily check camp.modules for non-limited users without more fetch, but sidebar v1 filters it
      return true;
    }).map(mod => ({
      key: mod.key,
      label: t(mod.labelKey, mod.label),
      icon: MODULE_ICONS[mod.icon],
      color: mod.color,
      route: `${campBasePath}?section=${mod.key}`,
      active: isActiveCampaign && currentSection === mod.key
    }));

    return (
      <div className="space-y-0.5">
        <div 
          className={cn(
            "group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
            isActiveCampaign ? "bg-stone-800/50" : "hover:bg-stone-800/30"
          )}
          onClick={() => navigate(campBasePath)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: camp.color || "#8C6F4E" }}
            />
            {!collapsed && (
              <span className={cn(
                "text-xs font-semibold uppercase tracking-wider truncate",
                isActiveCampaign ? "text-white" : "text-stone-400 group-hover:text-stone-200"
              )}>
                {camp.name}
              </span>
            )}
          </div>
          {!collapsed && (
            <button 
              className="p-1 text-stone-500 hover:text-stone-300 transition-transform"
              style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
              onClick={(e) => toggleCampaignExpanded(camp.id, e)}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {isExpanded && !collapsed && (
          <div className="space-y-0.5 border-l border-stone-800 ml-3 pl-1">
            {filteredModules.map(mod => (
              <NavItem key={mod.key} item={mod} isSubItem activeOverride={mod.active} />
            ))}
          </div>
        )}
      </div>
    );
  };


  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-stone-900 border-r border-stone-700 transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-16" : "w-[240px]"
      )}
    >
      {/* Logo Area */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-stone-700">
        {!collapsed && (
          <span className="text-white font-semibold text-sm tracking-tight">ProduzAI</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="bg-stone-800 hover:bg-stone-700 rounded-full w-6 h-6 flex items-center justify-center text-stone-400 hover:text-white"
          onClick={toggleSidebar}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto custom-scrollbar">
        <TooltipProvider delayDuration={0}>
          {/* Main Nav */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItem key={item.label} item={item} />
            ))}
          </div>

          {/* Context Hierarchy (Breadcrumb style) */}
          {(agencyId || clientId || campaignId) && !collapsed && (
            <div className="px-3 py-2 border-b border-stone-800 mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Contexto
              </div>
              <div className="flex flex-col gap-0.5 text-xs">
                {agencyData?.name && (
                  <button 
                    onClick={() => navigate(`/agency/${agencyId}`)}
                    className="text-stone-400 hover:text-white text-left truncate"
                  >
                    {agencyData.name}
                  </button>
                )}
                {clientData?.name && (
                  <button 
                    onClick={() => navigate(`/agency/${agencyId}/clients/${clientId}`)}
                    className="text-stone-300 hover:text-white text-left truncate flex items-center gap-1"
                  >
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    {clientData.name}
                  </button>
                )}
                {campaignData?.name && (
                  <div className="text-brand-400 font-medium truncate flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    {campaignData.name}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agency Context: List Clients */}
          {agencyId && !clientId && !isLimited && !collapsed && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                {t("sidebar.clients")}
              </div>
              <NavItem 
                item={{ label: t("sidebar.clients"), icon: Briefcase, route: `/agency/${agencyId}` }} 
                activeOverride={location.pathname === `/agency/${agencyId}`}
              />
            </div>
          )}

          {/* Client Context: Stores, Emails, Campaigns */}
          {clientId && !campaignId && !isLimited && !collapsed && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Menu do Cliente
              </div>
              <NavItem 
                item={{ label: t("sidebar.campaigns"), icon: Megaphone, route: `/agency/${agencyId}/clients/${clientId}` }} 
                activeOverride={location.pathname === `/agency/${agencyId}/clients/${clientId}` && !location.search.includes("tab=")}
              />
              <NavItem 
                item={{ label: t("modules.stores"), icon: Store, route: `/agency/${agencyId}/clients/${clientId}?tab=stores` }} 
                activeOverride={location.search.includes("tab=stores")}
              />
              <NavItem 
                item={{ label: "E-mails", icon: Mail, route: `/agency/${agencyId}/clients/${clientId}?tab=emails` }} 
                activeOverride={location.search.includes("tab=emails")}
              />
              
              <div className="pt-2">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  {t("sidebar.campaigns")}
                </div>
                <div className="space-y-1 mt-1">
                  {clientCampaigns.map(camp => (
                    <CampaignItem key={camp.id} camp={camp} agencyId={agencyId!} clientId={clientId!} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Campaign Context: Modules */}
          {campaignId && !collapsed && campaignData && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Módulos da Campanha
              </div>
              <CampaignItem camp={campaignData} agencyId={agencyId!} clientId={clientId!} />
            </div>
          )}


          {/* Limited User: List allowed clients/campaigns */}
          {isLimited && !collapsed && limitedClientGroups.map(group => (
            <div key={group.clientId} className="pt-2">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-400">
                {group.clientName}
              </div>
              <div className="space-y-1 mt-1">
                {group.campaigns.map(camp => (
                  <CampaignItem key={camp.campaignId} camp={{ ...camp, id: camp.campaignId, name: camp.campaignName }} agencyId={group.agencyId} clientId={group.clientId} />
                ))}
              </div>
            </div>
          ))}

          {/* Admin Section */}
          {isAdminOrMaster && (
            <div className="space-y-1 pt-2">
              {!collapsed && (
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">

                  {t("sidebar.section_admin", "Administração")}
                </div>
              )}
              {adminItems.map((item) => (
                <NavItem key={item.label} item={item} />
              ))}
            </div>
          )}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className="border-t border-stone-700 py-3 px-3">
        <div className={cn(
          "flex items-center gap-3",
          collapsed ? "justify-center" : ""
        )}>
          <Avatar className="w-8 h-8 rounded-full bg-brand-400">
            <AvatarFallback className="bg-brand-400 text-white text-xs font-bold">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.email?.split("@")[0]}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="text-stone-400 hover:text-white hover:bg-stone-800"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-stone-400 hover:text-white hover:bg-stone-800"
              onClick={() => signOut()}
              title={t("auth.logout")}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
