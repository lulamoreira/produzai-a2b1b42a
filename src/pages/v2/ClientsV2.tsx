import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useClients, type Client } from "@/hooks/useMultiClientData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, Search, Users, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/v2/ui/SkeletonCard";
import { EmptyStateV2 } from "@/components/v2/ui/EmptyStateV2";

const TERRACOTTA = "#C2714F";

function getClientAvatarColor(name: string): string {
  const letter = (name?.[0] ?? "A").toUpperCase();
  const colors: Record<string, string> = {
    A: "#8C6F4E", B: "#7B5E3A", C: "#6B4F2E",
    D: "#5C6B3F", E: "#4A5568", F: "#735A3D",
    G: "#7A3B2E", H: "#5A4A3A", I: "#8C6F4E",
    J: "#6B4F2E", K: "#7B5E3A", L: "#5C6B3F",
    M: "#A07850", N: "#7B5E3A", O: "#6B4F2E",
    P: "#8C6F4E", Q: "#5A4A3A", R: "#7A3B2E",
    S: "#735A3D", T: "#5C6B3F", U: "#4A5568",
    V: "#8C6F4E", W: "#7B5E3A", X: "#6B4F2E",
    Y: "#A07850", Z: "#5A4A3A",
  };
  return colors[letter] ?? "#8C6F4E";
}

export default function ClientsV2({ onAddClick }: { onAddClick: () => void }) {
  const { t } = useTranslation();
  const { agencyId } = useParams<{ agencyId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { data: clients = [], isLoading } = useClients(agencyId);
  const [search, setSearch] = useState("");

  const { data: agencyInfo } = useQuery({
    queryKey: ["agency_name", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });

  const { data: campaignCounts = {} } = useQuery({
    queryKey: ["campaign-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("client_id");
      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        counts[c.client_id] = (counts[c.client_id] || 0) + 1;
      });
      return counts;
    },
  });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-white rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            {t("clients.title")}
          </h1>
          <p className="text-sm text-stone-500">
            {t("clients.subtitle")}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={onAddClick}
            className="rounded-lg text-white font-medium shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: TERRACOTTA }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("clients.newClient")}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          placeholder={t("common.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white border-stone-200 rounded-lg shadow-sm focus:ring-terracotta focus:border-terracotta"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 border-dashed">
          <EmptyStateV2
            icon={Users}
            title={t("clients.emptyTitle")}
            description={t("clients.emptyDescription")}
            action={isAdmin ? { label: t("clients.newClient"), onClick: onAddClick } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const avatarColor = getClientAvatarColor(client.name);
            const count = campaignCounts[client.id] || 0;
            
            return (
              <div
                key={client.id}
                onClick={() => navigate(`/agency/${agencyId}/clients/${client.id}`)}
                className="group bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col h-full"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-stone-900 font-semibold truncate group-hover:text-stone-700 transition-colors">
                      {client.name}
                    </h3>
                    <p className="text-xs text-stone-400 truncate">
                      {agencyInfo?.name || "..."}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                    {count} {t("clients.campaigns")}
                  </span>
                  <span
                    className="text-xs font-semibold flex items-center gap-1 transition-all group-hover:gap-1.5"
                    style={{ color: TERRACOTTA }}
                  >
                    {t("clientDashboard.access") || "Acessar"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
