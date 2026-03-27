import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDisplayName } from "@/components/AppHeader";
import { WhatsNewButton } from "@/components/WhatsNewSheet";
import { InviteButton } from "@/components/InviteButton";
import EditProfileDialog from "@/components/EditProfileDialog";
import {
  Building2, Users, MessageSquare, Shield, LogOut, UserCog,
  PanelLeftClose, PanelLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AquaIcon from "@/components/AquaIcon";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  color?: string;
}

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdminOrMaster, isAdmin, isMaster } = useUserRole();
  const displayName = useDisplayName();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const roleBadge = isAdmin ? "Admin" : isMaster ? "Master" : "Usuário";

  const navItems: NavItem[] = [
    {
      label: "Agências",
      icon: Building2,
      href: "/",
      active: location.pathname === "/",
      color: "#6366f1",
    },
    {
      label: "Chat",
      icon: MessageSquare,
      href: "/chat",
      active: location.pathname === "/chat",
      color: "#06b6d4",
    },
  ];

  if (isAdminOrMaster) {
    navItems.push({
      label: "Admin",
      icon: Shield,
      href: "/admin",
      active: location.pathname === "/admin",
      color: "#f97316",
    });
    navItems.push({
      label: "Aprovações",
      icon: Users,
      href: "/approvals",
      active: location.pathname === "/approvals",
      color: "#22c55e",
    });
  }

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-screen z-30 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          collapsed ? "w-[60px]" : "w-[220px]"
        }`}
      >
        {/* Logo area */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-sidebar-border flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-black text-white">P</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight truncate">
              ProduzAI
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors flex-shrink-0"
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => item.href ? navigate(item.href) : item.onClick?.()}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all group ${
                item.active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <AquaIcon icon={item.icon} size="sm" color={item.color} />
              {!collapsed && (
                <span className="truncate font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Utility buttons */}
        <div className="px-2 pb-2 space-y-1 border-t border-sidebar-border pt-2">
          <div className={`flex ${collapsed ? "flex-col" : ""} items-center gap-1`}>
            <InviteButton />
            <WhatsNewButton />
          </div>
        </div>

        {/* User area */}
        <div className="px-2 pb-3 border-t border-sidebar-border pt-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-sidebar-primary">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold truncate text-sidebar-foreground">{displayName}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{roleBadge}</p>
              </div>
            )}
          </button>
          <button
            onClick={signOut}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all ${
              collapsed ? "justify-center" : ""
            }`}
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
