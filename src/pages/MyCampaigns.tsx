import { useTranslation } from "react-i18next";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Store, Grid3X3, LayoutList, AlertTriangle, CalendarDays, LogOut, Package, Camera, Building2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ModuleGrid from "@/components/ModuleGrid";

const MyCampaigns = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { campaigns, isLimited, isLoading } = useUserDirectAccess();

  const MODULE_META: Record<string, { label: string; icon: React.ElementType }> = {
    stores: { label: t("modules.stores"), icon: Store },
    matrix: { label: t("modules.matrix"), icon: Grid3X3 },
    pieces: { label: t("modules.pieces"), icon: LayoutList },
    occurrences: { label: t("modules.occurrences"), icon: AlertTriangle },
    scheduling: { label: t("modules.scheduling"), icon: CalendarDays },
    installations: { label: t("modules.installations"), icon: Camera },
    loja_a_loja: { label: "Loja a Loja", icon: Building2 },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isLimited) {
    return <Navigate to="/" replace />;
  }

  if (campaigns.length === 1 && campaigns[0].modules.length === 1) {
    const c = campaigns[0];
    return (
      <Navigate
        to={`/agency/${c.agencyId}/clients/${c.clientId}/campaigns/${c.campaignId}`}
        state={{ initialSection: c.modules[0], limitedMode: true }}
        replace
      />
    );
  }

  const handleNavigate = (campaign: typeof campaigns[0], module: string) => {
    navigate(
      `/agency/${campaign.agencyId}/clients/${campaign.clientId}/campaigns/${campaign.campaignId}`,
      { state: { initialSection: module, limitedMode: true } }
    );
  };

  return (
    <AppLayout title={t("myCampaigns.title")}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">{t("myCampaigns.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("myCampaigns.selectModule")}</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">{t("myCampaigns.noAccess")}</p>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> {t("auth.logout")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((c) => (
              <div
                key={`${c.campaignId}-${c.modules.join(",")}`}
                className="aqua-card border border-border p-6 bg-card hover:shadow-md transition-shadow"
              >
                <div className="mb-5">
                  <h3 className="font-bold text-foreground text-lg">{c.campaignName}</h3>
                  <p className="text-xs text-muted-foreground">{c.clientName}</p>
                </div>
                <ModuleGrid
                  items={c.modules.map((mod) => {
                    const meta = MODULE_META[mod];
                    return meta ? { key: mod, label: meta.label, icon: meta.icon } : null;
                  }).filter(Boolean) as any}
                  onSelect={(mod) => handleNavigate(c, mod)}
                />
              </div>
            ))}

            <div className="text-center pt-6">
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> {t("auth.logout")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MyCampaigns;
