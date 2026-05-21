import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Megaphone, Store, Wrench, Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";
import { useUserRole } from "@/hooks/useUserRole";

export function BottomNavV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { isAdminOrMaster } = useUserRole();

  const navItems = useMemo(() => [
    { label: t("sidebar.home"), icon: Home, route: "/", active: location.pathname === "/" },
    { label: t("sidebar.campaigns", "Campanhas"), icon: Megaphone, route: "/my-campaigns", active: location.pathname.includes("/campaigns") },
    { label: t("sidebar.stores", "Lojas"), icon: Store, route: "/agencies", active: location.pathname === "/agencies" },
    { label: t("sidebar.installations", "Instalações"), icon: Wrench, route: "/approvals", active: location.pathname === "/approvals" },
  ], [location.pathname, t]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-stone-900 border-t border-stone-700 z-50 flex items-center px-2">
      {navItems.map((item) => (
        <button
          key={item.route}
          onClick={() => navigate(item.route)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
        >
          <item.icon className={cn("w-5 h-5", item.active ? "text-brand-400" : "text-stone-400")} />
          <span className={cn("text-[10px]", item.active ? "text-brand-400 font-medium" : "text-stone-400")}>
            {item.label}
          </span>
          {item.active && <div className="w-1 h-1 rounded-full bg-brand-400 mt-0.5" />}
        </button>
      ))}

      <Sheet>
        <SheetTrigger asChild>
          <button className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2">
            <Menu className="w-5 h-5 text-stone-400" />
            <span className="text-[10px] text-stone-400">{t("sidebar.menu", "Menu")}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] bg-stone-900 border-t border-stone-800 p-0">
          <div className="w-10 h-1 rounded-full bg-stone-600 mx-auto my-4" />
          <div className="px-6 pb-8 space-y-2">
            {navItems.map(item => (
              <button 
                key={item.route} 
                onClick={() => navigate(item.route)}
                className="w-full flex items-center justify-between p-4 bg-stone-800 rounded-xl text-white"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-brand-400" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}