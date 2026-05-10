import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link2, Check, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { isAdminOrMaster } = useUserRole();
  const params = useParams();

  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Seed from URL on open
  useEffect(() => {
    if (open) {
      setAgencyId(params.agencyId ?? "");
      setClientId(params.clientId ?? "");
      setCopiedUrl(null);
    }
  }, [open, params.agencyId, params.clientId]);

  const { data: agencies = [] } = useQuery({
    queryKey: ["invite-agencies", user?.id],
    enabled: open && isAdminOrMaster,
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["invite-clients", agencyId],
    enabled: open && !!agencyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("agency_id", agencyId)
        .order("name");
      return data ?? [];
    },
  });

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://produzai.lovable.app";
    return window.location.origin;
  }, []);

  const handleCreate = async () => {
    if (!agencyId) {
      toast.error("Selecione uma agência.");
      return;
    }
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
      const url = `${baseUrl}/auth?invite=${(data as any).token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopiedUrl(url);
      toast.success("Link de convite copiado para a área de transferência.");
    } catch (err) {
      console.error("Invite error:", err);
      toast.error("Erro ao gerar convite.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdminOrMaster) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            Gere um link de convite para acesso ao sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Agência
            </label>
            <Select value={agencyId} onValueChange={(v) => { setAgencyId(v); setClientId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {agencies.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Cliente (opcional)
            </label>
            <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
              <SelectTrigger disabled={!agencyId}>
                <SelectValue placeholder="Acesso a toda agência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Acesso a toda agência</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {copiedUrl && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs break-all">
              {copiedUrl}
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={loading || !agencyId}
            className="w-full min-h-[44px] gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
              copiedUrl ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copiedUrl ? "Link copiado — gerar outro" : "Gerar link de convite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
