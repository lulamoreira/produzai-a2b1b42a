import React from "react";
import { SidebarV2 } from "./SidebarV2";
import { HeaderV2 } from "./HeaderV2";
import { BottomNavV2 } from "./BottomNavV2";
import { useLocation } from "react-router-dom";

export function AppShellV2({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div className="flex h-screen bg-stone-50 dark:bg-stone-950 overflow-hidden font-sans">
      <div className="hidden md:flex">
        <SidebarV2 />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden pb-16 md:pb-0">
        <HeaderV2 />
        <main className="flex-1 overflow-y-auto p-6">
          <div key={location.pathname} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            {children}
          </div>
        </main>
      </div>
      <BottomNavV2 />
    </div>
  );
}