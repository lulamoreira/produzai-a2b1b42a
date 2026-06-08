import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Truck, ArrowRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";

export default function AgencyDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agencyId } = useParams<{ agencyId: string }>();
  const { isAdminOrMaster } = useUserRole();

  const { data: agencyInfo, isLoading } = useQuery({
    queryKey: ["agency_info", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });

  const cards = [
    {
      id: "clients",
      title: t("sidebar.clients"),
      description: "Gerencie os clientes e campanhas desta agência",
      icon: Briefcase,
      color: "bg-[#735A3D]",
      path: `/agency/${agencyId}/clients`,
      roles: ["admin", "master", "user"],
    },
    {
      id: "suppliers",
      title: "Fornecedores",
      description: "Cadastre e gerencie os fornecedores da agência",
      icon: Truck,
      color: "bg-[#4B5563]",
      path: `/agency/${agencyId}/suppliers`,
      roles: ["admin", "master"],
    },
  ];

  const visibleCards = cards.filter(card => {
    if (card.id === "suppliers") return isAdminOrMaster;
    return true;
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: agencyInfo?.name || "Agência" }
      ]}
    >
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        <header>
          <h1 className="text-3xl font-bold text-stone-800 tracking-tight">
            {agencyInfo?.name || "Agência"}
          </h1>
          <p className="text-stone-500 mt-2">
            Selecione um módulo para começar a trabalhar.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleCards.map((card) => (
            <Card
              key={card.id}
              className="group relative bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 p-8 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-200 transition-all rounded-2xl overflow-hidden"
              onClick={() => navigate(card.path)}
            >
              <div className="flex flex-col h-full">
                <div className={`w-14 h-14 rounded-2xl ${card.color} flex items-center justify-center mb-6 shadow-sm`}>
                  <card.icon className="w-7 h-7 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 group-hover:text-brand-500 transition-colors">
                  {card.title}
                </h3>
                <p className="text-stone-500 dark:text-stone-400 mt-2 flex-grow">
                  {card.description}
                </p>

                <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-brand-500">
                  Acessar módulo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
