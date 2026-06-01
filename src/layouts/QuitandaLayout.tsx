import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  DollarSign, 
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  isCollapsed?: boolean;
}

const NavItem = ({ to, icon: Icon, label, badge, isCollapsed }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== "/quitanda" && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative group",
        isActive 
          ? "bg-primary text-white shadow-sm" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className={cn(
        "font-medium text-sm transition-all duration-300",
        isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
      )}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full",
          isActive ? "bg-white text-primary" : "bg-primary text-white",
          isCollapsed && "right-1 top-1"
        )}>
          {badge}
        </span>
      )}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </Link>
  );
};

export const QuitandaLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  // Fetch pending pieces count for badge
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["q3d_pending_pieces_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("q3d_pieces")
        .select("*", { count: 'exact', head: true })
        .eq("status", "pendente");
      if (error) throw error;
      return count || 0;
    }
  });

  const navItems = [
    { to: "/quitanda", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/quitanda/drops", icon: Package, label: "Drops", badge: pendingCount },
    { to: "/quitanda/historico", icon: ClipboardList, label: "Histórico" },
    { to: "/quitanda/financeiro", icon: DollarSign, label: "Financeiro" },
    { to: "/quitanda/configuracoes", icon: Settings, label: "Configurações" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col md:flex-row">
      {/* Sidebar Desktop/Tablet */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-[#E5E7EB] bg-white sticky top-0 h-screen transition-all duration-300 z-40",
        "lg:w-[240px] md:w-[80px]"
      )}>
        <div className={cn(
          "p-6 flex items-center gap-3",
          "lg:justify-start md:justify-center"
        )}>
          <span className="text-primary font-display font-bold text-2xl shrink-0">Q3D</span>
          <span className="font-display font-semibold text-lg lg:block md:hidden truncate">Quitanda3dSHOP</span>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <div key={item.to} className="lg:block hidden">
              <NavItem {...item} isCollapsed={false} />
            </div>
          ))}
          {navItems.map((item) => (
            <div key={item.to + "-collapsed"} className="lg:hidden block">
              <NavItem {...item} isCollapsed={true} />
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto pb-20 md:pb-0">
        <div className="max-w-[1600px] mx-auto min-h-screen">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E5E7EB] flex items-center justify-around px-2 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== "/quitanda" && location.pathname.startsWith(item.to));
          return (
            <Link 
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-[16px] text-[8px] font-bold rounded-full bg-primary text-white border-2 border-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
