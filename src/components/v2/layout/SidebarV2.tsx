import React, { useState, useEffect, useMemo } from "react";
import { useLocation, NavLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { useQuery } from "@tanstack/react-query";
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
  ChevronDown
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

export function SidebarV2() {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdminOrMaster, isAdmin } = useUserRole();
  const { isLimited } = useUserDirectAccess();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-v2-collapsed") === "true";
  });

  const [expandedCampaign, setExpandedCampaign] = useState(true);
  const [expandedClient, setExpandedClient] = useState(true);

  useEffect(() => {
    localStorage.setItem("sidebar-v2-collapsed", String(collapsed));
  }, [collapsed]);

  const toggleSidebar = () => setCollapsed(!collapsed);

  // Fetch names for context
  const { data: campaignData } = useQuery({
    queryKey: ["sidebar-v2-campaign", campaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("name").eq("id", campaignId!).maybeSingle();
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: clientData } = useQuery({
    queryKey: ["sidebar-v2-client", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("name").eq("id", clientId!).maybeSingle();
      return data;
    },
    enabled: !!clientId && !campaignId,
  });

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

  const campaignModules = useMemo(() => {
    if (!campaignId || !agencyId || !clientId) return [];
    
    // Define the sub-navigation items based on sidebar v1 logic
    // Scheduling, Installations, Loja a Loja, Lojas, Occurrences, Budgets, Pieces, Matrix, Mockup, Adjustments
    const currentSection = new URLSearchParams(location.search).get("section") || "summary";
    
    return CAMPAIGN_MODULES.filter(mod => {
      if (mod.requires === "admin_or_master" && !isAdminOrMaster) return false;
      if (mod.hideForLimited && isLimited) return false;
      return true;
    }).map(mod => ({
      key: mod.key,
      label: t(mod.labelKey, mod.label),
      icon: MODULE_ICONS[mod.icon],
      route: `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}?section=${mod.key}`,
      active: currentSection === mod.key
    }));
  }, [campaignId, agencyId, clientId, isAdminOrMaster, isLimited, t, location.search]);

  const clientModules = useMemo(() => {
    if (!clientId || !agencyId || campaignId) return [];
    return [
      {
        label: t("sidebar.campaigns", "Campanhas"),
        icon: Megaphone,
        route: `/agency/${agencyId}/clients/${clientId}`,
        active: !location.search.includes("tab=")
      },
      {
        label: t("sidebar.stores", "Lojas"),
        icon: Store,
        route: `/agency/${agencyId}/clients/${clientId}?tab=stores`,
        active: location.search.includes("tab=stores")
      },
      {
        label: t("sidebar.emails", "E-mails"),
        icon: Mail,
        route: `/agency/${agencyId}/clients/${clientId}?tab=emails`,
        active: location.search.includes("tab=emails")
      }
    ];
  }, [clientId, agencyId, campaignId, t, location.search]);

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

  const NavItem = ({ item, isSubItem = false }: { item: any, isSubItem?: boolean }) => {
    const isActive = item.active !== undefined ? item.active : (item.exact ? location.pathname === item.route : location.pathname.startsWith(item.route));
    
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

          {/* Context Section (Campaign or Client) */}
          {(campaignId || clientId) && !collapsed && (
            <div className="space-y-1 pt-2">
              <div 
                className="px-3 py-1 flex items-center justify-between cursor-pointer group"
                onClick={() => campaignId ? setExpandedCampaign(!expandedCampaign) : setExpandedClient(!expandedClient)}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 group-hover:text-stone-300">
                  {campaignId ? t("sidebar.campaign", "Campanha") : t("sidebar.client", "Cliente")}
                </span>
                <ChevronDown className={cn("w-3 h-3 text-stone-500 transition-transform", (campaignId ? expandedCampaign : expandedClient) ? "" : "-rotate-90")} />
              </div>
              
              {campaignId && expandedCampaign && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-xs font-medium text-stone-300 truncate mb-1">
                    {campaignData?.name || "..."}
                  </div>
                  {campaignModules.map((mod) => (
                    <NavItem key={mod.key} item={mod} isSubItem />
                  ))}
                </div>
              )}

              {clientId && !campaignId && expandedClient && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-xs font-medium text-stone-300 truncate mb-1">
                    {clientData?.name || "..."}
                  </div>
                  {clientModules.map((mod) => (
                    <NavItem key={mod.label} item={mod} isSubItem />
                  ))}
                </div>
              )}
            </div>
          )}

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
