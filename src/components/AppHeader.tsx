import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissionLevel } from "@/hooks/useUserPermissionLevel";
import { supabase } from "@/integrations/supabase/client";
import { capitalizeName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Shield, MessageSquare, ArrowLeft } from "lucide-react";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

interface AppHeaderProps {
  /** Show back button pointing to this path */
  backTo?: string;
  /** Label for the back button */
  backLabel?: string;
  /** Override the greeting line with custom title */
  title?: string;
  /** Subtitle below the title */
  subtitle?: string;
  /** Extra content rendered between title and right-side controls */
  children?: React.ReactNode;
  /** Max width class (default: max-w-5xl) */
  maxWidth?: string;
  /** Show Chat & Admin buttons (default: true) */
  showNav?: boolean;
}

export function useDisplayName() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile_display", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const raw = profile?.display_name || user?.email?.split("@")[0] || "";
  return capitalizeName(raw);
}

export default function AppHeader({
  backTo,
  backLabel,
  title,
  subtitle,
  children,
  maxWidth = "max-w-5xl",
  showNav = true,
}: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { isMasterOrEditor } = useUserPermissionLevel();
  const navigate = useNavigate();
  const displayName = useDisplayName();

  const greeting = `${getGreeting()}, ${displayName}!`;

  return (
    <header className="border-b border-border bg-card sticky top-0 z-10">
      <div className={`${maxWidth} mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {backTo && (
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigate(backTo)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-foreground truncate">
              {title || greeting}
            </h1>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {children}

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {showNav && (
            <>
              <Button size="icon" variant="outline" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1" onClick={() => navigate("/chat")}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Chat</span>
              </Button>
              {(isAdmin || isMasterOrEditor) && (
                <Button size="icon" variant="outline" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1" onClick={() => navigate("/admin")}>
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Admin</span>
                </Button>
              )}
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1.5 rounded-full px-1.5 sm:px-3">
                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="hidden sm:inline text-xs max-w-[120px] truncate">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
              <DropdownMenuItem className="text-xs" disabled>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {isAdmin ? "Admin" : "Usuário"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
