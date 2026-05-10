import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, PanelLeft, PanelLeftClose, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useDisplayName, getGreeting } from "@/components/AppHeader";
import { UserMenu } from "@/components/sidebar/UserMenu";
import { SidebarBreadcrumb } from "@/components/sidebar/SidebarBreadcrumb";
import type { UserMenuAction } from "@/lib/sidebarRegistry";
import produzaiIcon from "@/assets/produzai-icon.svg";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onUserAction: (action: UserMenuAction) => void;
  agencyName?: string | null;
  clientName?: string | null;
  campaignName?: string | null;
}

export function SidebarHeader({
  collapsed, onToggleCollapsed, onCloseMobile, onUserAction, agencyName, clientName,
}: Props) {
  const { t } = useTranslation();
  const { displayName, avatarUrl } = useDisplayName();
  const { isAdmin, isMaster } = useUserRole();
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName = (displayName || "").split(" ")[0] || "usuário";
  const initials = (displayName || "U").slice(0, 1).toUpperCase();
  const roleLabel = isAdmin ? "Admin" : isMaster ? "Master" : "Usuário";
  const scope = clientName || agencyName || null;

  const trigger = (
    <button
      type="button"
      data-keep-open
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all text-left"
      style={{ color: "var(--sidebar-text, #A89880)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--sidebar-item-hover)";
        e.currentTarget.style.color = "var(--sidebar-text-active)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--sidebar-text)";
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-white/10"
        style={{ background: avatarUrl ? "transparent" : "var(--brand-600, #735A3D)" }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
        ) : (
          <span className="text-[14px] font-bold text-white">{initials}</span>
        )}
      </div>
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <p
              className="text-[12px] truncate"
              style={{ color: "var(--sidebar-text, #A89880)" }}
            >
              {getGreeting(t)}
            </p>
            <p
              className="text-[13px] font-semibold truncate"
              style={{ color: "var(--sidebar-text-active, #F5EFE6)" }}
            >
              {firstName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--brand-700, #5A4630)",
                  color: "var(--sidebar-text-active, #F5EFE6)",
                }}
              >
                {roleLabel}
              </span>
              {scope && (
                <span
                  className="text-[10px] truncate"
                  style={{ color: "var(--sidebar-text, #A89880)" }}
                  title={scope}
                >
                  · {scope}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
        </>
      )}
    </button>
  );

  return (
    <div
      className="flex-shrink-0"
      style={{ borderBottom: "1px solid var(--sidebar-border-raw, rgba(255,255,255,0.06))" }}
    >
      {/* Logo row */}
      <div className="flex items-center gap-2 px-3 h-14">
        <img
          src={produzaiIcon}
          alt="ProduzAI"
          className="w-7 h-7 rounded-lg flex-shrink-0"
        />
        {!collapsed && (
          <span
            className="text-[15px] font-semibold tracking-tight truncate"
            style={{ color: "var(--sidebar-text-active, #F5EFE6)" }}
          >
            ProduzAI
          </span>
        )}
        <button
          data-keep-open
          onClick={onToggleCollapsed}
          className="ml-auto transition-colors flex-shrink-0 hidden md:block"
          style={{ color: "var(--sidebar-text, #A89880)" }}
          aria-label={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
        <button
          onClick={onCloseMobile}
          className="ml-auto md:hidden"
          style={{ color: "var(--sidebar-text, #A89880)" }}
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Identity zone */}
      <div className="px-2 py-2">
        <UserMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onAction={onUserAction}
          trigger={trigger}
        />
      </div>
    </div>
  );
}
