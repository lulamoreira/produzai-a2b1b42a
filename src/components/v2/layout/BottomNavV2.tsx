import React, { useMemo } from "react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import { Home, Megaphone, Store, Wrench, Menu, X, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";
import { useUserRole } from "@/hooks/useUserRole";

export function BottomNavV2() {
  const { agencyId, clientId, campaignId } = useParams<{ agencyId: string; clientId: string; campaignId: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const { isAdminOrMaster } = useUserRole();

  const navItems = useMemo(() => {
    const items = [
      { label: t("sidebar.home"), icon: Home, route: "/", exact: true },
    ];

    items.push({
      label: t("sidebar.favorites", "Favoritos"),
      icon: Star,
      route: "/favorites",
      exact: false,
    });

    items.push({ label: t("sidebar.agencies", "Agências"), icon: Store, route: "/agencies", exact: false });
    
    if (isAdminOrMaster) {
      items.push({ label: t("sidebar.approvals", "Aprovações"), icon: Wrench, route: "/approvals", exact: false });
    }

    return items;
  }, [location.pathname, t, campaignId, agencyId, clientId, isAdminOrMaster]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-stone-900 border-t border-stone-700 z-50 flex items-center px-2">
      {navItems.map((item) => (
        <NavLink
          key={item.route}
          to={item.route}
          className={({ isActive }) => cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
            isActive ? "text-brand-400" : "text-stone-400"
          )}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[10px]">
            {item.label}
          </span>
          {location.pathname === item.route && <div className="w-1 h-1 rounded-full bg-brand-400 mt-0.5" />}
        </NavLink>
      ))}

      <Sheet>
        <SheetTrigger asChild>
          <button className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2">
            <Menu className="w-5 h-5 text-stone-400" />
            <span className="text-[10px] text-stone-400">{t("sidebar.menu", "Menu")}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] bg-stone-900 border-t border-stone-800 p-0 rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-stone-600 mx-auto my-4" />
          <div className="px-6 pb-8 space-y-2 overflow-y-auto">
            <SheetTitle className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-2 px-1">
              {t("sidebar.menu", "Menu")}
            </SheetTitle>
            {navItems.map(item => (
              <NavLink 
                key={item.route} 
                to={item.route}
                className={({ isActive }) => cn(
                  "w-full flex items-center justify-between p-4 rounded-xl transition-all",
                  isActive ? "bg-brand-400/10 text-white" : "bg-stone-800 text-stone-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", location.pathname === item.route ? "text-brand-400" : "text-stone-400")} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-500" />
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
