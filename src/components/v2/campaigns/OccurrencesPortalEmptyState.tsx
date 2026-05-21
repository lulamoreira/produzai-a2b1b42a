import React from "react";
import { useTranslation } from "react-i18next";
import { Store, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OccurrencesPortalEmptyStateProps {
  type: "no-stores" | "no-access" | "deadline-passed";
  onGoToStores?: () => void;
  className?: string;
  isV2?: boolean;
}

export const OccurrencesPortalEmptyState: React.FC<OccurrencesPortalEmptyStateProps> = ({
  type,
  onGoToStores,
  className,
  isV2 = false,
}) => {
  const { t } = useTranslation();

  const configs = {
    "no-access": {
      icon: Store,
      iconColor: "text-stone-300",
      title: t("occurrences.portal.noAccessTitle"),
      description: t("occurrences.portal.noAccessDescription"),
      showButton: true,
    },
    "no-stores": {
      icon: AlertTriangle,
      iconColor: "text-amber-400",
      title: t("occurrences.portal.noStoresTitle"),
      description: t("occurrences.portal.noStoresDescription"),
      showButton: true,
    },
    "deadline-passed": {
      icon: Clock,
      iconColor: "text-stone-400",
      title: t("occurrences.portal.deadlinePassedTitle"),
      description: t("occurrences.portal.deadlinePassedDescription"),
      showButton: false,
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto mt-16",
        isV2 ? "bg-white rounded-xl border border-stone-100 shadow-sm" : "bg-card rounded-lg border shadow-sm",
        className
      )}
    >
      <div className={cn("p-4 rounded-full mb-4", isV2 ? "bg-stone-50" : "bg-muted/50")}>
        <Icon className={cn("h-12 w-12", config.iconColor)} />
      </div>
      <h3 className={cn("font-semibold text-lg mb-2", isV2 ? "text-stone-900" : "text-foreground")}>
        {config.title}
      </h3>
      <p className={cn("text-sm leading-relaxed mb-6", isV2 ? "text-stone-500" : "text-muted-foreground")}>
        {config.description}
      </p>
      {config.showButton && onGoToStores && (
        <Button
          onClick={onGoToStores}
          className={cn(
            "text-sm font-medium px-5 py-2.5 rounded-lg transition-colors",
            isV2 ? "bg-[#C2714F] hover:bg-[#b06040] text-white" : ""
          )}
        >
          {t("occurrences.portal.goToStores")}
        </Button>
      )}
    </div>
  );
};
