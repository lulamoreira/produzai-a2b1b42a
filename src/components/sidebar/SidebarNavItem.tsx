import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface Props {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  isActive: boolean;
  collapsed: boolean;
  size?: "default" | "sm";
  iconColor?: string;
  className?: string;
}

export function SidebarNavItem({
  icon: Icon, label, onClick, isActive, collapsed,
  size = "default", iconColor, className,
}: Props) {
  const textSize = size === "sm" ? "text-[12px]" : "text-[13px]";
  const padding = size === "sm" ? "py-1.5 px-2" : "py-2 px-2.5";

  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group w-full flex items-center gap-2.5 rounded-lg transition-all relative",
        "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-transparent before:rounded-r-full",
        !isActive && "hover:before:bg-[var(--sidebar-active-bar)]/40",
        textSize, padding, className,
      )}
      style={isActive
        ? { background: "var(--sidebar-item-active)", color: "var(--sidebar-text-active)", fontWeight: 600, borderLeft: "3px solid var(--sidebar-active-bar)" }
        : { color: "var(--sidebar-text)" }
      }
    >
      <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
