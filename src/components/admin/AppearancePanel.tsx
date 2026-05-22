import React from "react";
import { useTranslation } from "react-i18next";
import { useUIVersion } from "@/hooks/useUIVersion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

const AppearancePanel: React.FC = () => {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { version, setVersion, isLoading } = useUIVersion();

  const handleToggle = () => {
    setVersion("v2");
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Versão da Interface</h3>
        <p className="text-sm text-muted-foreground">
          A versão V2 é agora o padrão oficial do sistema.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Interface ProduzAI V2
                <Badge variant="default">Ativa</Badge>
              </CardTitle>
              <CardDescription>
                Todos os usuários estão utilizando a nova interface por padrão.
              </CardDescription>
            </div>
            {version !== "v2" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleToggle}
                disabled={isLoading}
              >
                Resetar para V2
              </Button>
            )}
          </CardHeader>
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
