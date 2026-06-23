import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/formatters";
import { toast } from "sonner";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Loader2,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import produzaiIcon from "@/assets/produzai-icon.svg";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const JoinPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const formatters = useFormatters();
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: invite, isLoading, error: queryError } = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const { data, error } = await (supabase.rpc as any)('get_invite_by_token', { p_token: token });
      if (error) throw error;
      return data as any;
    },
    enabled: !!token,
    retry: false
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invite) return;

    if (password.length < 8) {
      toast.error(t("invite.invalidPassword"));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("invite.passwordsDoNotMatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            display_name: name || invite.name
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("User creation failed");

      // 2. Call edge function to confirm invite (email confirm)
      const { error: invokeError } = await supabase.functions.invoke('confirm-invite', {
        body: { userId: authData.user.id, token }
      });
      
      if (invokeError) console.error("Error invoking confirm-invite:", invokeError);

      // 2b. Sign in to establish a session so RLS-protected inserts below work
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });
      if (signInError) throw signInError;


      const { error: profileError } = await (supabase.from('profiles') as any).insert({
        user_id: authData.user.id,
        display_name: name || invite.name,
        agency_id: invite.agency_id,
        approval_status: 'approved' // Invites bypass standard approval
      });
      if (profileError) throw profileError;

      // 3b. Insert role
      const { error: roleError } = await (supabase.from('user_roles') as any).insert({
        user_id: authData.user.id,
        role: invite.role
      });
      if (roleError) throw roleError;

      // 3c. Apply campaign permissions
      const campaignPermissions = invite.permissions as any[];
      if (campaignPermissions && Array.isArray(campaignPermissions) && campaignPermissions.length > 0) {
        const { error: campaignError } = await supabase.from('user_campaign_access').insert(
          campaignPermissions.map(p => ({
            user_id: authData.user.id,
            campaign_id: p.campaign_id,
            category_id: p.category_id,
            suspended: p.suspended ?? false
          }))
        );
        if (campaignError) console.error("Error applying campaign permissions:", campaignError);
      }

      // 4. Mark invite used (via SECURITY DEFINER RPC; token-scoped)
      const { error: updateError } = await (supabase.rpc as any)('mark_invite_used', { p_token: token });
      if (updateError) throw updateError;

      toast.success(t("invite.accountCreated"));
      navigate('/auth');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
      case 'master':
        return <Badge className="bg-[#C2714F] hover:bg-[#C2714F] text-white border-none">{role.toUpperCase()}</Badge>;
      case 'manager':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">{role.toUpperCase()}</Badge>;
      default:
        return <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-none">{role.toUpperCase()}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-stone-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 max-w-md w-full space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const isExpired = invite && new Date(invite.expires_at) < new Date();
  const isUsed = false; // Multi-use invite: do not block after first use
  const isInvalid = !invite || isExpired || queryError;

  if (isInvalid) {
    return (
      <div className="bg-stone-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 max-w-md w-full text-center">
          <img src={produzaiIcon} alt="ProduzAI" className="w-16 h-16 mx-auto mb-6 shadow-sm rounded-xl" />
          
          {isUsed ? (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-stone-900 mb-2">{t("invite.alreadyUsed")}</h2>
            </>
          ) : isExpired ? (
            <>
              <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-stone-900 mb-2">{t("invite.expired", { date: formatters.date(invite.expires_at) })}</h2>
            </>
          ) : (
            <>
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-stone-900 mb-2">{t("invite.notFound")}</h2>
            </>
          )}
          
          <Link to="/auth" className="inline-flex items-center text-[#C2714F] hover:underline font-medium mt-6">
            {t("auth.backToPasswordLogin")} <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 max-w-md w-full">
        <div className="text-center mb-6">
          <img src={produzaiIcon} alt="ProduzAI" className="w-16 h-16 mx-auto mb-4 shadow-sm rounded-xl" />
          <h1 className="text-2xl font-bold text-stone-900">{t("invite.welcomeTitle")}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {t("invite.invitedBy", { name: invite.invited_by_name || "um administrador" })}
          </p>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">Acesso concedido</span>
            {getRoleBadge(invite.role)}
          </div>
          {invite.agencies?.name && (
            <div className="text-stone-600 text-sm font-medium">
              Agência: {invite.agencies.name}
            </div>
          )}
          {invite.personal_message && (
            <div className="italic text-stone-600 text-sm border-l-4 border-[#C2714F] pl-3 mt-3">
              "{invite.personal_message}"
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">{t("common.email")}</label>
            <Input 
              value={invite.email} 
              disabled 
              className="bg-stone-100 text-stone-500 border-none cursor-not-allowed" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">{t("common.name")}</label>
            <Input 
              placeholder={invite.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-stone-200 focus:ring-[#C2714F] focus:border-[#C2714F]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">{t("auth.password")}</label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10 border-stone-200 focus:ring-[#C2714F] focus:border-[#C2714F]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-stone-700">{t("auth.confirmPassword")}</label>
            <Input 
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="border-stone-200 focus:ring-[#C2714F] focus:border-[#C2714F]"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#C2714F] hover:bg-[#b06040] text-white rounded-xl py-6 font-semibold transition mt-2 h-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t("invite.createAccount")
            )}
          </Button>
        </form>

        <p className="text-xs text-stone-400 text-center mt-6">
          {t("invite.expiresOn", { date: formatters.date(invite.expires_at) })}
        </p>
      </div>
    </div>
  );
};

export default JoinPage;