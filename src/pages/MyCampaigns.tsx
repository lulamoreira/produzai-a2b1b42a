import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Store, Grid3X3, LayoutList, AlertTriangle, CalendarDays, DollarSign, LogOut, Package } from "lucide-react";
import AppHeader from "@/components/AppHeader";

const MODULE_META: Record<string, { label: string; icon: React.ElementType }> = {
  stores: { label: "Lojas", icon: Store },
  matrix: { label: "Matriz", icon: Grid3X3 },
  pieces: { label: "Peças", icon: LayoutList },
  occurrences: { label: "Ocorrências", icon: AlertTriangle },
  scheduling: { label: "Agendamento", icon: CalendarDays },
  budgets: { label: "Orçamentos", icon: DollarSign },
};

const MyCampaigns = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { campaigns, isLimited, isLoading } = useUserDirectAccess();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If not limited, redirect to normal flow
  if (!isLimited) {
    return <Navigate to="/" replace />;
  }

  // If only one campaign with one module, go directly
  if (campaigns.length === 1 && campaigns[0].modules.length > 0) {
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
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Minhas Campanhas" />

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">Minhas Campanhas</h2>
          <p className="text-muted-foreground text-sm">Selecione um módulo para acessar.</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Você não tem acesso a nenhuma campanha.</p>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <div
                key={c.campaignId}
                className="border border-border rounded-xl p-5 bg-card hover:shadow-md transition-shadow"
              >
                <div className="mb-3">
                  <h3 className="font-bold text-foreground text-lg">{c.campaignName}</h3>
                  <p className="text-xs text-muted-foreground">{c.clientName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.modules.map((mod) => {
                    const meta = MODULE_META[mod];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={mod}
                        onClick={() => handleNavigate(c, mod)}
                        className="bg-primary/5 border border-primary/20 hover:bg-primary/10 rounded-lg px-4 py-3 flex items-center gap-2 transition-all hover:shadow-md cursor-pointer"
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="text-center pt-6">
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyCampaigns;
