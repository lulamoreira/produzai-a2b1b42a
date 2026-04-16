import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
  const { isAdminOrMaster } = useUserRole();
  const { agencyId, clientId } = useParams();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isAdminOrMaster) return null;
  if (!agencyId || !clientId) return null;

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1 bg-card text-foreground border-border shadow-lg hover:bg-accent"
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
        <p>Copiar link de convite para este cliente</p>
      </TooltipContent>
    </Tooltip>
  );
}
