import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { capitalizeName } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border last:border-b-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-words">{value || "—"}</span>
    </div>
  );
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR") : null;

export default function UserApprovalDetailsDialog({ open, onOpenChange, userId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["user_approval_details", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "user_id, display_name, nickname, company, job_title, phone, phone_is_whatsapp, avatar_url, approval_status, created_at, first_login_at, last_seen_at, login_count, preferred_language, agency_id, client_id"
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      let email: string | null = null;
      try {
        const { data: e } = await supabase.rpc("get_user_email_admin", { _user_id: userId });
        email = (e as string) ?? null;
      } catch {
        email = null;
      }

      let agencyName: string | null = null;
      let clientName: string | null = null;
      if (profile?.agency_id) {
        const { data: a } = await supabase
          .from("agencies").select("name").eq("id", profile.agency_id).maybeSingle();
        agencyName = a?.name ?? null;
      }
      if (profile?.client_id) {
        const { data: c } = await supabase
          .from("clients").select("name").eq("id", profile.client_id).maybeSingle();
        clientName = c?.name ?? null;
      }

      let role: string | null = null;
      const { data: r } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
      role = (r?.role as string) ?? null;

      return { profile, email, agencyName, clientName, role };
    },
  });

  const p = data?.profile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {p?.avatar_url && (
              <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            )}
            {capitalizeName(p?.display_name) || "Detalhes do usuário"}
          </DialogTitle>
          <DialogDescription>
            Informações completas do cadastro antes da aprovação.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !p ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Usuário não encontrado.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <Row label="Nome" value={capitalizeName(p.display_name)} />
            <Row label="Apelido" value={p.nickname} />
            <Row label="E-mail" value={data?.email} />
            <Row
              label="Telefone"
              value={p.phone ? `${p.phone}${p.phone_is_whatsapp ? " (WhatsApp)" : ""}` : null}
            />
            <Row label="Empresa" value={p.company} />
            <Row label="Cargo" value={p.job_title} />
            <Row label="Agência vinculada" value={data?.agencyName} />
            <Row label="Cliente vinculado" value={data?.clientName} />
            <Row label="Perfil (role)" value={data?.role} />
            <Row
              label="Status"
              value={<Badge variant="outline">{p.approval_status}</Badge>}
            />
            <Row label="Cadastro" value={fmt(p.created_at)} />
            <Row label="Primeiro acesso" value={fmt(p.first_login_at)} />
            <Row label="Último acesso" value={fmt(p.last_seen_at)} />
            <Row label="Total de logins" value={String(p.login_count ?? 0)} />
            <Row label="Idioma" value={p.preferred_language} />
            <Row label="ID" value={<span className="font-mono text-xs">{p.user_id}</span>} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
