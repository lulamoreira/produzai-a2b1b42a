import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissionLevel } from "@/hooks/useUserPermissionLevel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InviteButton() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { isMaster } = useUserPermissionLevel();
  const { agencyId, clientId } = useParams();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isAdmin && !isMaster) return null;
  if (!agencyId) return null;

  const handleInvite = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invites" as any)
        .insert({
          created_by: user!.id,
          agency_id: agencyId,
          client_id: clientId || null,
        })
        .select("token")
        .single();

      if (error) throw error;

      const url = `https://produzai.lovable.app/auth?invite=${(data as any).token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link de convite copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Invite error:", err);
      toast.error("Erro ao gerar convite");
    } finally {
      setLoading(false);
    }
  };

  const scopeLabel = clientId ? "este cliente" : "esta agência";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1 bg-white text-[#1e3a5f] border-white/80 shadow-lg shadow-black/20 hover:bg-white/90 hover:text-[#1e3a5f]"
          onClick={handleInvite}
          disabled={loading}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline text-xs font-semibold">
            {copied ? "Copiado!" : "Convite"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Copiar link de convite para {scopeLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
