import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFirstLogin } from "@/hooks/useFirstLogin";
import { useUserRole } from "@/hooks/useUserRole";
import { Shield, Info, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import produzaiIcon from "@/assets/produzai-icon.svg";
import { cn } from "@/lib/utils";

const WelcomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const { markFirstLoginDone } = useFirstLogin();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: campaignAccesses, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['my-campaign-accesses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_campaign_access')
        .select(`
          suspended,
          campaign:campaigns(
            id,
            name,
            client:clients(name, agency:agencies(name))
          )
        `)
        .eq('user_id', user?.id)
        .eq('suspended', false);
      
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const handleStart = async (campaignId?: string) => {
    await markFirstLoginDone();
    if (campaignId) {
      navigate(`/agency/default/clients/default/campaigns/${campaignId}`);
    } else {
      navigate("/");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'master':
        return "bg-[#C2714F] hover:bg-[#C2714F] text-white";
      case 'manager':
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-stone-100 text-stone-600";
    }
  };

  const name = profile?.display_name || user?.email?.split("@")[0] || "";

  return (
    <div className="bg-stone-50 min-h-screen flex items-center justify-center p-6 sm:p-10">
      <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center text-center">
          <img src={produzaiIcon} alt="ProduzAI" className="w-16 h-16 mb-6 shadow-sm rounded-xl" />
          <h1 className="text-3xl font-bold text-stone-900">
            {t("welcome.hello", { name })}
          </h1>
          <p className="text-stone-500 text-base mt-2 max-w-md">
            {t("welcome.subtitle")}
          </p>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 mt-8 flex items-center gap-4 border border-stone-100">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <Shield className="w-5 h-5 text-[#C2714F]" />
          </div>
          <div>
            <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">
              {t("welcome.yourRole")}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={cn("border-none", getRoleBadgeColor(role || ''))}>
                {(role || t("common.user")).toUpperCase()}
              </Badge>
              <span className="text-xs text-stone-500">
                {t(`welcome.roleDescriptions.${role?.toLowerCase() || 'viewer'}`)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-stone-700 font-semibold mb-4 flex items-center gap-2">
            {t("welcome.yourCampaigns")}
            {campaignAccesses && campaignAccesses.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-stone-50 text-stone-500 border-none">
                {campaignAccesses.length}
              </Badge>
            )}
          </h2>

          {loadingCampaigns ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
            </div>
          ) : campaignAccesses && campaignAccesses.length > 0 ? (
            <div className="grid gap-3">
              {campaignAccesses.slice(0, 5).map((access: any) => {
                const campaign = access.campaign;
                const initials = (campaign?.name || "C").charAt(0).toUpperCase();
                return (
                  <div 
                    key={campaign?.id}
                    onClick={() => handleStart(campaign?.id)}
                    className="flex items-center gap-4 p-4 bg-white border border-stone-100 rounded-xl hover:border-stone-200 hover:shadow-sm transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold group-hover:bg-[#C2714F]/10 group-hover:text-[#C2714F] transition-colors">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-900 truncate">{campaign?.name}</h3>
                      <p className="text-xs text-stone-400 truncate">
                        {campaign?.client?.name} {campaign?.client?.agency?.name ? `· ${campaign?.client?.agency?.name}` : ''}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-[#C2714F] group-hover:translate-x-1 transition-all" />
                  </div>
                );
              })}
              {campaignAccesses.length > 5 && (
                <p className="text-xs text-stone-400 text-center mt-2 italic">
                  {t("welcome.moreCampaigns", { count: campaignAccesses.length - 5 })}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800">
                {t("welcome.noCampaigns")}
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 pt-6 border-t border-stone-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-stone-500 hover:text-stone-800"
            onClick={() => handleStart()}
          >
            {t("welcome.goToHome")}
          </Button>
          <Button 
            className="bg-[#C2714F] hover:bg-[#b06040] text-white px-8 rounded-xl h-12 font-semibold"
            onClick={() => handleStart()}
          >
            {t("welcome.letsGo")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
