import { Outlet } from "react-router-dom";
import { InterfaceModeProvider } from "@/hooks/useInterfaceMode";

/**
 * Wraps all routes that include :agencyId with the InterfaceModeProvider.
 */
export default function AgencyRouteWrapper() {
  return (
    <InterfaceModeProvider>
      <Outlet />
    </InterfaceModeProvider>
  );
}
