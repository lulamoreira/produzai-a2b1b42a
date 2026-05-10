import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label?: string;
  collapsed: boolean;
  children: ReactNode;
  marginTop?: "sm" | "md" | "lg";
}

export function SidebarSection({ label, collapsed, children, marginTop = "md" }: Props) {
  const mt = marginTop === "sm" ? "mt-1" : marginTop === "lg" ? "mt-4" : "mt-3";
  return (
    <div className={cn("flex flex-col gap-0.5", mt)}>
      {!collapsed && label && (
        <div className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1 opacity-50">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
