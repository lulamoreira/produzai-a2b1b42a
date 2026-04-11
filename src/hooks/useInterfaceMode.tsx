import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMatch } from "react-router-dom";

type InterfaceMode = "legacy" | "new";

interface InterfaceModeContextValue {
  interfaceMode: InterfaceMode;
  setInterfaceMode: (mode: InterfaceMode) => Promise<void>;
  isLoading: boolean;
}

const InterfaceModeContext = createContext<InterfaceModeContextValue>({
  interfaceMode: "legacy",
  setInterfaceMode: async () => {},
  isLoading: false,
});

export function useInterfaceMode() {
  return useContext(InterfaceModeContext);
}

export function InterfaceModeProvider({ children }: { children: ReactNode }) {
  const agencyMatch = useMatch("/agency/:agencyId/*");
  const agencyRootMatch = useMatch("/agency/:agencyId");
  const agencyId = agencyMatch?.params.agencyId ?? agencyRootMatch?.params.agencyId;
  const queryClient = useQueryClient();

  const { data: mode, isLoading } = useQuery({
    queryKey: ["interface_mode", agencyId],
    queryFn: async () => {
      if (!agencyId) return "legacy" as InterfaceMode;
      const { data, error } = await supabase
        .from("agencies")
        .select("interface_mode")
        .eq("id", agencyId)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.interface_mode as InterfaceMode) || "legacy";
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  });

  const setInterfaceMode = useCallback(async (newMode: InterfaceMode) => {
    if (!agencyId) return;
    const { error } = await supabase
      .from("agencies")
      .update({ interface_mode: newMode } as any)
      .eq("id", agencyId);
    if (error) throw error;
    queryClient.setQueryData(["interface_mode", agencyId], newMode);
    queryClient.invalidateQueries({ queryKey: ["interface_mode", agencyId] });
  }, [agencyId, queryClient]);

  const currentMode = mode ?? "legacy";

  // Sync data attribute on <html> so CSS can react globally
  useEffect(() => {
    document.documentElement.setAttribute("data-interface-mode", currentMode);
    return () => {
      document.documentElement.removeAttribute("data-interface-mode");
    };
  }, [currentMode]);

  return (
    <InterfaceModeContext.Provider
      value={{
        interfaceMode: currentMode,
        setInterfaceMode,
        isLoading,
      }}
    >
      {children}
    </InterfaceModeContext.Provider>
  );
}
