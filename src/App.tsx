import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserApprovalStatus } from "@/hooks/useUserApproval";
import { useUserRole } from "@/hooks/useUserRole";
import { PendingUsersAlert } from "@/components/PendingUsersAlert";
import Dashboard from "./pages/Dashboard";
import ClientDetail from "./pages/ClientDetail";
import CampaignDetail from "./pages/CampaignDetail";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import UserApprovals from "./pages/UserApprovals";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

const PendingApprovalScreen = () => {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md text-center p-8">
        <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Aguardando Aprovação</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Sua conta foi criada com sucesso, mas precisa ser aprovada por um administrador antes que você possa acessar o sistema.
        </p>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { data: approvalStatus, isLoading: loadingApproval } = useUserApprovalStatus();
  const { isAdmin } = useUserRole();

  if (loading || loadingApproval) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admins always pass; non-admins need approval
  if (!isAdmin && approvalStatus !== "approved") {
    return <PendingApprovalScreen />;
  }

  return (
    <>
      <PendingUsersAlert />
      {children}
    </>
  );
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/clients/:clientId/campaigns/:campaignId" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/approvals" element={<ProtectedRoute><UserApprovals /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
