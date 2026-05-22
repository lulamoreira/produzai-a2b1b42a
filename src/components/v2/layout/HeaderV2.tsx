import React from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { ChevronRight, Palette, Sun, Moon, Laptop, Check, Languages } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useV2Theme, V2Theme } from "@/hooks/useV2Theme";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SUPPORTED_LANGUAGES } from "@/i18n";

export function HeaderV2() {
  const { theme, setTheme } = useV2Theme();
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

  const { data: clientData } = useQuery({
    queryKey: ["breadcrumb-client", params.clientId],
    queryFn: async () => {
      if (!params.clientId) return null;
      const { data } = await supabase
        .from("clients")
        .select("name")
        .eq("id", params.clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!params.clientId
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
        crumbs.push({ label: clientData?.name || t("sidebar.clients") });
      }

      if (params.campaignId) {
        crumbs.push({ label: campaignData?.name || t("common.campaign") });
      }

      if (path.includes("/pieces")) {
        crumbs.push({ label: t("pieces.title") });
      }
    }

    if (crumbs.length > 3) {
      return [crumbs[0], { label: "..." }, crumbs[crumbs.length - 1]];
    }

    return crumbs;
  };

  const crumbs = getBreadcrumbs();
  const userInitial = user?.email?.[0]?.toUpperCase() || "U";

  return (
    <header 
      className="h-14 border-b shadow-sm px-6 flex items-center justify-between z-20"
      style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {crumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--v2-text-muted)' }} />}
            {crumb.path ? (
              <button
                onClick={() => navigate(crumb.path!)}
                className="text-xs hover:text-stone-600 cursor-pointer whitespace-nowrap"
                style={{ color: 'var(--v2-text-muted)' }}
              >
                {crumb.label}
              </button>
            ) : (
              <span className={cn(
                "text-xs truncate max-w-[150px]",
                idx === crumbs.length - 1 
                  ? "font-semibold" 
                  : ""
              )}
              style={{ color: idx === crumbs.length - 1 ? 'var(--v2-text-primary)' : 'var(--v2-text-muted)' }}
            >
                {crumb.label}
              </span>
            )}
          </React.Fragment>
        ))}
        <span 
          className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 flex-shrink-0"
          style={{ background: 'var(--v2-accent)' }}
        >
          v2
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <button 
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition-colors"
              style={{ color: 'var(--v2-text-secondary)' }}
            >
              <Languages className="w-5 h-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end" style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}>
            <div className="flex flex-col gap-1">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code as any)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-stone-50",
                    currentLanguage === lang.code ? "font-medium" : ""
                  )}
                  style={{ 
                    color: currentLanguage === lang.code ? 'var(--v2-accent)' : 'var(--v2-text-secondary)' 
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{lang.flag}</span>
                    {lang.label}
                  </div>
                  {currentLanguage === lang.code && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button 
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition-colors"
              style={{ color: 'var(--v2-text-secondary)' }}
            >
              <Palette className="w-5 h-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end" style={{ background: 'var(--v2-surface)', borderColor: 'var(--v2-border)' }}>
            <div className="flex flex-col gap-1">
              {[
                { id: 'light', icon: Sun, label: t("theme.light") },
                { id: 'dark', icon: Moon, label: t("theme.dark") },
                { id: 'system', icon: Laptop, label: t("theme.system") },
                { id: 'multicolor', icon: Palette, label: t("theme.multicolor") },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id as V2Theme)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-stone-50",
                    theme === opt.id ? "font-medium" : ""
                  )}
                  style={{ 
                    color: theme === opt.id ? 'var(--v2-accent)' : 'var(--v2-text-secondary)' 
                  }}
                >
                  <div className="flex items-center gap-3">
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                  </div>
                  {theme === opt.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <NotificationBell />

        <Avatar 
          className="w-8 h-8 rounded-full border-2 shadow-sm"
          style={{ background: 'var(--v2-accent)', borderColor: 'var(--v2-surface)' }}
        >
          <AvatarFallback 
            className="text-white text-xs font-bold"
            style={{ background: 'var(--v2-accent)' }}
          >
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