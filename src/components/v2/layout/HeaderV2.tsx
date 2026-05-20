import React from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/hooks/useLanguage";

export function HeaderV2() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/") return t("sidebar.home");
    if (path === "/agencies") return t("sidebar.agencies");
    if (path === "/favorites") return t("sidebar.favorites");
    if (path === "/admin") return t("header.admin");
    if (path === "/approvals") return t("sidebar.approvals");
    if (path === "/my-campaigns") return t("sidebar.myCampaigns");
    if (path.includes("/agency/")) return t("sidebar.clients");
    return "";
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-14 bg-white dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 shadow-sm px-6 flex items-center justify-between z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
          {getPageTitle()}
        </h1>
        <span className="bg-brand-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          v2
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Language Selector - re-using existing logic */}
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value as any)}
          className="text-xs bg-transparent border-none focus:ring-0 cursor-pointer text-stone-600 dark:text-stone-400"
        >
          <option value="pt-BR">PT</option>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>

        <NotificationBell />

        <Avatar className="w-8 h-8 rounded-full bg-brand-400 border-2 border-white dark:border-stone-900 shadow-sm">
          <AvatarFallback className="bg-brand-400 text-white text-xs font-bold">
            {userInitial}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
