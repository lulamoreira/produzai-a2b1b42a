import React from "react";
import { SidebarV2 } from "./SidebarV2";
import { HeaderV2 } from "./HeaderV2";

export function AppShellV2({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-stone-50 dark:bg-stone-950 overflow-hidden font-sans">
      <SidebarV2 />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <HeaderV2 />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
