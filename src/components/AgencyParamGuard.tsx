import { useParams, Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guard que valida o parâmetro :agencyId presente na URL.
 * Se vier algo que não seja UUID (ex.: "suppliers", "clients"), redireciona para "/"
 * para impedir que sub-rotas quebrem com IDs inválidos.
 */
export default function AgencyParamGuard({ children }: { children: React.ReactNode }) {
  const { agencyId } = useParams<{ agencyId: string }>();
  const warned = useRef(false);

  const isValid = !!agencyId && UUID_REGEX.test(agencyId);

  useEffect(() => {
    if (agencyId && !isValid && !warned.current) {
      warned.current = true;
      toast.error(`Link inválido: "${agencyId}" não é uma agência válida. Redirecionando...`);
    }
  }, [agencyId, isValid]);

  if (agencyId && !isValid) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
