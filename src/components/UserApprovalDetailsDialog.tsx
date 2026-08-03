import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { capitalizeName, cn } from "@/lib/utils";
import { User, Shield, Calendar, Activity, Mail, Phone, Building2, Briefcase, Globe, Fingerprint } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}

function Row({ label, value, icon: Icon }: { label: string; value?: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0 group hover:bg-muted/30 px-2 rounded-md transition-colors">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">{label}</span>
        <span className="text-sm text-foreground break-words font-medium">{value || "—"}</span>
      </div>
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
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary/5 p-6 border-b border-primary/10">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="relative">
                {p?.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-4 ring-white shadow-md">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm",
                  p?.approval_status === 'approved' ? "bg-green-500" : "bg-amber-500"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-bold truncate">
                  {capitalizeName(p?.display_name) || "Detalhes do usuário"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] h-5 uppercase font-bold tracking-tight bg-primary/10 text-primary border-none">
                    {data?.role || "Sem role"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {p?.nickname && `@${p.nickname}`}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !p ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Usuário não encontrado.</p>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 gap-1 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex flex-col gap-1">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Nível de Acesso
                  </span>
                  <span className="text-sm font-semibold text-primary">{data?.role || "Pendente"}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex flex-col gap-1">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Status
                  </span>
                  <Badge variant="outline" className={cn(
                    "w-fit text-[10px] h-5 border-none px-0 font-bold",
                    p.approval_status === 'approved' ? "text-green-600" : "text-amber-600"
                  )}>
                    {p.approval_status === 'approved' ? "Ativo" : "Pendente"}
                  </Badge>
                </div>
              </div>

              <Row label="E-mail" value={data?.email} icon={Mail} />
              <Row
                label="Telefone"
                value={p.phone ? `${p.phone}${p.phone_is_whatsapp ? " (WhatsApp)" : ""}` : null}
                icon={Phone}
              />
              <Row label="Empresa" value={p.company} icon={Building2} />
              <Row label="Cargo" value={p.job_title} icon={Briefcase} />
              <Row label="Agência vinculada" value={data?.agencyName} icon={Globe} />
              <Row label="Cliente vinculado" value={data?.clientName} icon={Building2} />
              <Row label="Data de Cadastro" value={fmt(p.created_at)} icon={Calendar} />
              <Row label="Primeiro acesso" value={fmt(p.first_login_at)} icon={Clock} />
              <Row label="Último acesso" value={fmt(p.last_seen_at)} icon={Clock} />
              <Row label="Total de logins" value={String(p.login_count ?? 0)} icon={Activity} />
              <Row label="Idioma" value={p.preferred_language} icon={Globe} />
              <Row label="Identificação (ID)" value={<span className="font-mono text-[10px] opacity-70">{p.user_id}</span>} icon={Fingerprint} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
