import { ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AquaIcon from "@/components/AquaIcon";
import { useTranslation } from "react-i18next";
import { getLastVisitedSection } from "@/lib/sidebarLastVisited";
import type { ComponentType } from "react";

export interface ModuleEntry {
  key: string;
  tKey: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  fallbackLabel?: string;
}

interface Props {
  campaignId: string;
  campaignName: string;
  modules: ModuleEntry[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNavigateHome: () => void;
  onNavigateModule: (moduleKey: string) => void;
  isActive: boolean;
  isModuleActive: (moduleKey: string) => boolean;
  collapsed: boolean;
}

export function CampaignNavItem({
  campaignId, campaignName, modules,
  isExpanded, onToggleExpand, onNavigateHome, onNavigateModule,
  isActive, isModuleActive, collapsed,
}: Props) {
  const { t } = useTranslation();

  const handleCampaignClick = () => {
    const last = getLastVisitedSection(campaignId);
    if (last && modules.some((m) => m.key === last)) {
      onNavigateModule(last);
    } else {
      onNavigateHome();
    }
  };

  if (collapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCampaignClick}
            className="w-full flex items-center justify-center px-2 py-1.5 rounded-md transition-all"
            style={isActive
              ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", borderLeft: "3px solid var(--sidebar-active-bar)" }
              : { color: "var(--brand-300, #C4AD92)" }
            }
          >
            <span className="text-[10px] font-bold uppercase truncate max-w-[28px]">
              {campaignName.slice(0, 3)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="font-semibold">{campaignName}</div>
          <div className="text-xs text-muted-foreground">{modules.length} módulos</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={`rounded-md ${isActive ? "bg-muted/30" : ""}`}>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleCampaignClick}
          className="flex-1 truncate text-left px-2 py-1.5 rounded-md text-[12px] font-semibold uppercase tracking-wider transition-all"
          style={{ color: isActive ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--sidebar-text-active)"; }}
          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--brand-300, #C4AD92)"; }}
        >
          {campaignName}
        </button>
        <button
          type="button"
          data-keep-open
          onClick={onToggleExpand}
          className="flex-shrink-0 p-1 rounded transition-all"
          style={{ color: isActive ? "var(--sidebar-text-active, #F5EFE6)" : "var(--brand-300, #C4AD92)" }}
          aria-label={isExpanded ? "Recolher" : "Expandir"}
        >
          <ChevronDown
            className="w-3 h-3 opacity-40 transition-transform duration-200"
            style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </button>
      </div>
      <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="relative ml-2 pl-3 mt-1 mb-1 space-y-0.5">
          <span className="absolute left-0 top-0 bottom-0 w-px bg-border" />
          {modules.map((mod) => {
            const modActive = isModuleActive(mod.key);
            return (
              <button
                key={mod.key}
                type="button"
                onClick={() => onNavigateModule(mod.key)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-all relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:bg-transparent before:rounded-r-full hover:before:bg-[var(--sidebar-active-bar)]/40"
                style={modActive
                  ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
                  : { color: "var(--sidebar-text)" }
                }
              >
                <AquaIcon icon={mod.icon} size="xs" color={mod.color} />
                <span className="truncate">
                  {mod.fallbackLabel ? t(mod.tKey, { defaultValue: mod.fallbackLabel }) : t(mod.tKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
