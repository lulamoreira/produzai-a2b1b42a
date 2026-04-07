import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarStateCtx {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const Ctx = createContext<SidebarStateCtx>({ collapsed: false, setCollapsed: () => {} });

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <Ctx.Provider value={{ collapsed, setCollapsed }}>{children}</Ctx.Provider>;
}

export function useSidebarState() {
  return useContext(Ctx);
}
