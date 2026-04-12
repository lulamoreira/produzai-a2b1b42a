import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SidebarStateProvider } from "@/hooks/useSidebarState";
import { useUserApprovalStatus } from "@/hooks/useUserApproval";
import { useUserRole } from "@/hooks/useUserRole";
import { useProcessInvite } from "@/hooks/useProcessInvite";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { supabase } from "@/integrations/supabase/client";
import { PendingUsersAlert } from "@/components/PendingUsersAlert";
import { NameConfirmDialog } from "@/components/NameConfirmDialog";
import AgencySelect from "./pages/AgencySelect";
import Dashboard from "./pages/Dashboard";
import ClientDetail from "./pages/ClientDetail";
import CampaignDetail from "./pages/CampaignDetail";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import UserApprovals from "./pages/UserApprovals";
import PublicOccurrence from "./pages/PublicOccurrence";
import PublicOccurrenceDetail from "./pages/PublicOccurrenceDetail";

import MyCampaigns from "./pages/MyCampaigns";
import Favorites from "./pages/Favorites";
import PhotoCheckin from "./pages/PhotoCheckin";
import InstallerPortal from "./pages/InstallerPortal";
import Unsubscribe from "./pages/Unsubscribe";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // 30s — avoid refetching on every mount
      gcTime: 5 * 60 * 1000,      // 5min — keep cache alive longer
      refetchOnWindowFocus: false, // only refetch when explicitly invalidated
      retry: 1,
    },
  },
});

const PendingApprovalScreen = () => {
  const { signOut } = useAuth();
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md text-center px-6 py-8 w-full">
        <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">{t("auth.pendingApproval")}</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {t("auth.pendingApprovalMessage")}
        </p>
        <Button variant="outline" onClick={signOut}>{t("auth.logout")}</Button>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { data: approvalStatus, isLoading: loadingApproval } = useUserApprovalStatus();
  const { isAdminOrMaster } = useUserRole();
  const { isProcessing } = useProcessInvite();

  if (loading || loadingApproval || isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdminOrMaster && approvalStatus !== "approved") {
    return <PendingApprovalScreen />;
  }

  return (
    <>
      <PendingUsersAlert />
      <NameConfirmDialog />
      {children}
    </>
  );
};

const HomeRedirect = () => {
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const { isLimited } = useUserDirectAccess();
  const { data: hasFavorites, isLoading } = useQuery({
    queryKey: ["has_favorites", user?.id],
    enabled: !!user && isAdminOrMaster,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_campaign_favorites")
        .select("id")
        .eq("user_id", user!.id)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  if (isLimited) return <Navigate to="/my-campaigns" replace />;

  if (isAdminOrMaster && isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAdminOrMaster && hasFavorites) {
    return <Navigate to="/favorites" replace />;
  }

  return <AgencySelect />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="produzai-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SidebarStateProvider>
            <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
              <Route path="/agencies" element={<ProtectedRoute><AgencySelect /></ProtectedRoute>} />
              <Route path="/agency/:agencyId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/agency/:agencyId/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
              <Route path="/agency/:agencyId/clients/:clientId/campaigns/:campaignId" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
              <Route path="/checkin/:campaignId/:storeId" element={<ProtectedRoute><PhotoCheckin /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute><UserApprovals /></ProtectedRoute>} />
              
              <Route path="/my-campaigns" element={<ProtectedRoute><MyCampaigns /></ProtectedRoute>} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/installer" element={<InstallerPortal />} />
              <Route path="/instalador" element={<InstallerPortal />} />
              <Route path="/ocorrencias/:campaignId" element={<PublicOccurrence />} />
              <Route path="/ocorrencia/:occurrenceId" element={<PublicOccurrenceDetail />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/clients/:clientId" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SidebarStateProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
