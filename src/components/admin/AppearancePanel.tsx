import React from "react";
import { useTranslation } from "react-i18next";
import { useUIVersion } from "@/hooks/useUIVersion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const AppearancePanel: React.FC = () => {
  const { t } = useTranslation();
  const { version, setVersion, canChange, isLoading } = useUIVersion();

  const handleToggle = (checked: boolean) => {
    setVersion(checked ? "v2" : "v1");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("appearance.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appearance.description")}
        </p>
      </div>

      <div className="grid gap-6">
        <Card className={cn(version === "v2" && "border-primary/50 bg-primary/5")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("appearance.v2Label")}
                <Badge variant={version === "v2" ? "default" : "secondary"}>
                  {version === "v2" ? t("appearance.active") : t("appearance.inactive")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t("appearance.v2Description")}
              </CardDescription>
            </div>
            <Switch
              checked={version === "v2"}
              onCheckedChange={handleToggle}
              disabled={!canChange || isLoading}
            />
          </CardHeader>
          <CardContent>
            {version === "v2" && (
              <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/50">
                <AlertTriangle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
                <AlertTitle>{t("common.wait")}</AlertTitle>
                <AlertDescription>
                  {t("appearance.activeWarning")}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("appearance.whatChangesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{t(`appearance.change${i}`)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppearancePanel;
