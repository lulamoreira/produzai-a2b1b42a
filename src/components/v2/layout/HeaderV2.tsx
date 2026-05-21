import React from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function HeaderV2() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLanguage, changeLanguage } = useLanguage();
  const params = useParams();

  const { data: campaignData } = useQuery({
    queryKey: ["breadcrumb-campaign", params.campaignId],
    queryFn: async () => {
      if (!params.campaignId) return null;
      const { data } = await supabase
        .from("campaigns")
        .select("name")
        .eq("id", params.campaignId)
        .maybeSingle();
      return data;
    },
    enabled: !!params.campaignId
  });

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs: { label: string; path?: string }[] = [];

    if (path === "/") {
      crumbs.push({ label: t("sidebar.home") });
    } else if (path === "/agencies") {
      crumbs.push({ label: t("sidebar.agencies") });
    } else if (path === "/favorites") {
      crumbs.push({ label: t("sidebar.favorites") });
    } else if (path === "/admin") {
      crumbs.push({ label: t("header.admin") });
    } else if (path === "/approvals") {
      crumbs.push({ label: t("sidebar.approvals") });
    } else if (path === "/my-campaigns") {
      crumbs.push({ label: t("sidebar.myCampaigns") });
    } else if (path.includes("/agency/")) {
      crumbs.push({ label: t("sidebar.agencies"), path: "/agencies" });
      
      if (params.clientId) {
        // Here we could fetch client name too if needed, but for now just label
        crumbs.push({ label: t("sidebar.clients") });
      }

      if (params.campaignId) {
        crumbs.push({ label: campaignData?.name || "Campanha" });
      }

      if (path.includes("/pieces")) {
        crumbs.push({ label: "Peças" });
      }
    }

    // Truncate if more than 3
    if (crumbs.length > 3) {
      return [crumbs[0], { label: "..." }, crumbs[crumbs.length - 1]];
    }

    return crumbs;
  };

  const crumbs = getBreadcrumbs();
  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-14 bg-white dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 shadow-sm px-6 flex items-center justify-between z-20">
      <div className="flex items-center gap-2 overflow-hidden">
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3 h-3 text-stone-400 flex-shrink-0" />}
            {crumb.path ? (
              <button
                onClick={() => navigate(crumb.path!)}
                className="text-xs text-stone-400 hover:text-stone-600 cursor-pointer whitespace-nowrap"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={cn(
                "text-xs truncate max-w-[150px]",
                idx === crumbs.length - 1 
                  ? "font-semibold text-stone-700 dark:text-stone-200" 
                  : "text-stone-400"
              )}>
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        ))}
        <span className="bg-brand-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
          v2
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <select 
          value={currentLanguage} 
          onChange={(e) => changeLanguage(e.target.value as any)}
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}