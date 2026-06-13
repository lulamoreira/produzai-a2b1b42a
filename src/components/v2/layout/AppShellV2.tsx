import React, { useEffect } from "react";
import { SidebarV2 } from "./SidebarV2";
import { HeaderV2 } from "./HeaderV2";
import { BottomNavV2 } from "./BottomNavV2";
import { useLocation } from "react-router-dom";
import { useV2Theme } from "@/hooks/useV2Theme";
import { useColorTheme } from "@/hooks/useColorTheme";

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  useV2Theme();
  useColorTheme();

  useEffect(() => {
    document.body.classList.add("v2-mode");
    return () => document.body.classList.remove("v2-mode");
  }, []);

  return (
    <div 
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: 'var(--v2-bg)' }}
    >
      <div className="hidden md:flex">
        <SidebarV2 />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pb-16 md:pb-0">
        <HeaderV2 />
        <main 
          className="flex-1 overflow-y-auto p-6 [&_.card]:rounded-xl [&_h1]:font-sans [&_h2]:font-sans [&_button]:font-sans"
          style={{ borderColor: 'var(--v2-border)' }}
        >
          <div key={location.pathname} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            {children}
          </div>
        </main>
      </div>
      <BottomNavV2 />
    </div>
  );
}