import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Home, 
  Building2, 
  Star, 
  Settings, 
  Users, 
  CheckSquare,
  Database,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isAdminOrMaster, isAdmin } = useUserRole();
  const { isLimited } = useUserDirectAccess();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-v2-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-v2-collapsed", String(collapsed));
  }, [collapsed]);

  const toggleSidebar = () => setCollapsed(!collapsed);

  const navItems = useMemo(() => {
    const items = [
      {
        label: t("sidebar.home"),
        icon: Home,
        route: "/",
        active: location.pathname === "/" || location.pathname === "/agencies" || location.pathname === "/my-campaigns",
      },
    ];

    if (isAdminOrMaster) {
      items.push({
        label: t("sidebar.agencies"),
        icon: Building2,
        route: "/agencies",
        active: location.pathname === "/agencies",
      });
    }

    items.push({
      label: t("sidebar.favorites"),
      icon: Star,
      route: "/favorites",
      active: location.pathname === "/favorites",
    });

    if (isAdminOrMaster) {
      items.push({
        label: t("sidebar.admin_users", "Usuários"),
        icon: Users,
        route: "/admin",
        active: location.pathname === "/admin",
      });
      items.push({
        label: t("sidebar.approvals"),
        icon: CheckSquare,
        route: "/approvals",
        active: location.pathname === "/approvals",
      });
      if (isAdmin) {
        items.push({
          label: "Backup",
          icon: Database,
          route: "/admin?tab=backup",
          active: location.search.includes("tab=backup"),
        });
      }
    }

    return items;
  }, [location, isAdminOrMaster, isAdmin, t]);

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

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
          <span className="text-white font-semibold text-sm">ProduzAI</span>
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
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => (
            <Tooltip key={item.label} disableHoverableContent={!collapsed}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(item.route)}
                  className={cn(
                    "w-full flex items-center gap-3 py-2 px-3 transition-all duration-200 group",
                    item.active
                      ? "bg-stone-800 border-l-2 border-brand-400 rounded-r-lg"
                      : "hover:bg-stone-800/60 rounded-lg"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 flex-shrink-0 transition-colors",
                      item.active ? "text-brand-400" : "text-stone-400 group-hover:text-stone-200"
                    )}
                  />
                  {!collapsed && (
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors",
                        item.active ? "text-white" : "text-stone-300 group-hover:text-white"
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
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
