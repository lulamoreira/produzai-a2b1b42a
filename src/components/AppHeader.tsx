import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { capitalizeName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Shield, MessageSquare, ArrowLeft, UserCog, ChevronRight } from "lucide-react";
import { WhatsNewButton } from "@/components/WhatsNewSheet";
import { InviteButton } from "@/components/InviteButton";
import EditProfileDialog from "@/components/EditProfileDialog";

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  backTo?: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
  maxWidth?: string;
  showNav?: boolean;
  bgStyle?: React.CSSProperties;
  bgClass?: string;
}

export function useDisplayName() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile_display", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, nickname")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const raw = (profile as any)?.nickname || profile?.display_name || user?.email?.split("@")[0] || "";
  return capitalizeName(raw);
}

export default function AppHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  breadcrumbs,
  children,
  maxWidth = "max-w-5xl",
  showNav = true,
  bgStyle,
  bgClass,
}: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, isMaster, isAdminOrMaster, role } = useUserRole();
  const navigate = useNavigate();
  const displayName = useDisplayName();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const greeting = `${getGreeting()}, ${displayName}!`;

  const roleBadge = isAdmin ? "Admin" : isMaster ? "Master" : "Usuário";
  const roleBadgeClass = isAdmin
    ? "bg-primary/15 text-primary"
    : isMaster
    ? "bg-orange-500/15 text-orange-700"
    : "bg-muted text-muted-foreground";

  return (
    <header className={`border-b border-white/10 sticky top-0 z-10 ${bgClass || "bg-gradient-to-r from-[#1e3a5f] to-[#5b3f8f]"} text-white`} style={bgStyle}>
      <div className={`${maxWidth} mx-auto px-3 sm:px-4 py-2 sm:py-3`}>
        {/* Row 1: breadcrumb trail + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {backTo && (
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(backTo, { replace: true })}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {breadcrumbs && breadcrumbs.length > 1 ? (
              <div className="min-w-0 flex flex-wrap items-center gap-1 text-[10px] sm:text-xs opacity-70">
                {breadcrumbs.slice(0, -1).map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1 min-w-0">
                    {i > 0 && <ChevronRight className="w-3 h-3 opacity-40 flex-shrink-0" />}
                    {crumb.href ? (
                      <button onClick={() => navigate(crumb.href!)} className="hover:opacity-100 transition-opacity truncate max-w-[100px] sm:max-w-[180px] text-left">
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="truncate max-w-[100px] sm:max-w-[180px] text-left">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : !breadcrumbs ? (
              <h1 className="text-sm sm:text-lg font-bold truncate">{title || greeting}</h1>
            ) : null}
          </div>

          {children}

          <div className="hidden sm:flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {showNav && (
            <>
              <InviteButton />
              <WhatsNewButton />
              <Button size="icon" variant="outline" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1 bg-white text-[#1e3a5f] border-white/80 shadow-lg shadow-black/20 hover:bg-white/90 hover:text-[#1e3a5f]" onClick={() => navigate("/chat")}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs font-semibold">Chat</span>
              </Button>
              {isAdminOrMaster && (
                <Button size="icon" variant="outline" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1 bg-white text-[#1e3a5f] border-white/80 shadow-lg shadow-black/20 hover:bg-white/90 hover:text-[#1e3a5f]" onClick={() => navigate("/admin")}>
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs font-semibold">Admin</span>
                </Button>
              )}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1.5 rounded-full px-1.5 sm:px-3 text-white hover:bg-white/10 hover:text-white">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="hidden sm:inline text-xs max-w-[120px] truncate">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
              <DropdownMenuItem className="text-xs" disabled>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${roleBadgeClass}`}>
                  {roleBadge}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                <UserCog className="w-4 h-4 mr-2" /> Editar Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EditProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
          </div>
        </div>
      </div>
    </header>
  );
}
