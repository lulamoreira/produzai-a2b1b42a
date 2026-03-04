import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissionLevel } from "@/hooks/useUserPermissionLevel";
import { useDisplayName } from "@/components/AppHeader";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Building2, MessageSquare, Shield, LogOut, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPP from "@/assets/logo-pp.png";

const navItems = [
  { title: "Agências", url: "/", icon: Building2, end: true },
  { title: "Chat", url: "/chat", icon: MessageSquare },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { isMasterOrEditor } = useUserPermissionLevel();
  const displayName = useDisplayName();
  const navigate = useNavigate();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0"
      style={{
        "--sidebar-background": "220 25% 10%",
        "--sidebar-foreground": "220 20% 85%",
        "--sidebar-accent": "220 22% 16%",
        "--sidebar-accent-foreground": "220 20% 92%",
        "--sidebar-border": "220 18% 16%",
        "--sidebar-primary": "250 80% 65%",
        "--sidebar-primary-foreground": "0 0% 100%",
      } as React.CSSProperties}
    >
      {/* Header with logo */}
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 min-h-[36px]">
          <img src={logoPP} alt="ProduzAI" className="w-8 h-8 rounded-lg flex-shrink-0" />
          {!collapsed && (
            <span className="text-base font-bold text-white tracking-tight truncate">
              ProduzAI
            </span>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent"
              onClick={toggleSidebar}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white transition-colors"
                      activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold"
                    >
                      <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Admin - conditional */}
              {(isAdmin || isMasterOrEditor) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Admin">
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white transition-colors"
                      activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold"
                    >
                      <Shield className="w-4.5 h-4.5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm">Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user info */}
      <SidebarFooter className="px-2 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
              onClick={signOut}
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
