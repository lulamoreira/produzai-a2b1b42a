import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type UIVersion = "v1" | "v2";

interface UIVersionContextType {
  version: UIVersion;
  setVersion: (version: UIVersion) => Promise<void>;
  isLoading: boolean;
  canChange: boolean;
}

const UIVersionContext = createContext<UIVersionContextType | undefined>(undefined);

export const UIVersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [version, setVersionState] = useState<UIVersion>("v2");
  const [isLoading, setIsLoading] = useState(true);
  const { isAdminOrMaster } = useUserRole();
  const { t } = useTranslation();

  const fetchVersion = async () => {
    try {
      const { data, error } = await supabase
        .from("app_ui_settings")
        .select("ui_version")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setVersionState(data.ui_version as UIVersion);
      }
    } catch (error) {
      console.error("Error fetching UI version:", error);
      setVersionState("v2"); // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVersion();

    const channel = supabase
      .channel("app_ui_settings_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_ui_settings",
          filter: "id=eq.1",
        },
        (payload) => {
          if (payload.new && (payload.new as any).ui_version) {
            setVersionState((payload.new as any).ui_version as UIVersion);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const setVersion = async (newVersion: UIVersion) => {
    if (!isAdminOrMaster) return;

    try {
      const { error } = await supabase
        .from("app_ui_settings")
        .update({ ui_version: newVersion })
        .eq("id", 1);

      if (error) throw error;

      toast.success(
        newVersion === "v2" 
          ? t("appearance.activatedToast") 
          : t("appearance.deactivatedToast")
      );
    } catch (error) {
      console.error("Error updating UI version:", error);
      toast.error(t("appearance.errorToast"));
    }
  };

  return (
    <UIVersionContext.Provider
      value={{
        version,
        setVersion,
        isLoading,
        canChange: isAdminOrMaster,
      }}
    >
      {children}
    </UIVersionContext.Provider>
  );
};

export const useUIVersion = () => {
  const context = useContext(UIVersionContext);
  if (context === undefined) {
    throw new Error("useUIVersion must be used within a UIVersionProvider");
  }
  return context;
};
