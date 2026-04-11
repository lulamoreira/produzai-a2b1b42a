import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLogCampaignActivity } from "@/hooks/useCampaignActivityLog";

interface SendInstallCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: any;
  store: any;
  team: any;
  teamMembers: any[];
  agencyName: string;
  campaignName: string;
}

export default function SendInstallCodeDialog({
  open, onOpenChange, schedule, store, team, teamMembers, agencyName, campaignName,
}: SendInstallCodeDialogProps) {
  const [sending, setSending] = useState(false);
  const logCampaignActivity = useLogCampaignActivity();

  if (!schedule?.install_code) return null;

  const leader = teamMembers?.find((m: any) => m.is_leader) || teamMembers?.[0];
  const leaderName = leader?.name || team?.name || "Equipe";
  const leaderPhone = leader?.phone?.replace(/\D/g, "") || "";

  const installCode = schedule.install_code;
  const scheduledDate = schedule.reschedule_enabled
    ? schedule.reschedule_date
    : schedule.scheduled_date;
  const scheduledTime = schedule.reschedule_enabled
    ? schedule.reschedule_time
    : schedule.scheduled_time;
  const preference = schedule.reschedule_enabled
    ? schedule.reschedule_preference
    : schedule.installation_preference;

  const dateLabel = scheduledDate
    ? format(new Date(scheduledDate + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "";
  const prefLabel = preference === "morning" ? "Manhã" : preference === "afternoon" ? "Tarde" : preference === "night" ? "Noite" : "";
  const address = [store?.street, store?.number, store?.complement, store?.neighborhood, store?.city, store?.state]
    .filter(Boolean).join(", ");
  const cep = store?.zip_code || "";
  const contactName = store?.manager_name || "";
  const contactPhone = store?.phone || "";
  const os = schedule?.installation_os || "";
  const portalUrl = `${window.location.origin}/instalador`;

  const message = `Olá, ${leaderName}! 👋

Você tem uma instalação confirmada pela ${agencyName}. Aqui estão todas as informações:

📍 *Local:* ${store?.name}${store?.nickname ? ` — ${store.nickname}` : ""}
   ${address}
   ${store?.city || ""}, ${store?.state || ""}${cep ? ` — CEP ${cep}` : ""}

${contactName ? `👤 *Quem procurar:* ${contactName}${contactPhone ? `\n   📞 ${contactPhone}` : ""}\n` : ""}
📅 *Data:* ${dateLabel}
🕐 *Horário:* ${scheduledTime || ""}${prefLabel ? ` (${prefLabel})` : ""}
${os ? `🗂 *OS:* ${os}\n` : ""}
🔑 *Seu código de acesso:*
   *${installCode}*

Como usar:
1. Acesse: ${portalUrl}
2. Digite o código acima
3. Faça o check-in ao chegar na loja
4. Registre as fotos (antes e depois)
5. Marque a instalação como concluída

⚠ Código exclusivo para esta loja. Não compartilhe.

Qualquer dúvida, fale com a equipe ${agencyName}.
Bom trabalho! 💪`;

  const handleWhatsApp = async () => {
    if (!leaderPhone) {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada — envie manualmente.");
      await markSent();
      return;
    }
    const encoded = encodeURIComponent(message);
    const phone = leaderPhone.startsWith("55") ? leaderPhone : `55${leaderPhone}`;
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    await markSent();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  };

  const markSent = async () => {
    setSending(true);
    try {
      await supabase
        .from("campaign_schedules")
        .update({ code_sent_at: new Date().toISOString() } as any)
        .eq("id", schedule.id);
      onOpenChange(false);
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Enviar código de instalação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {leaderPhone ? (
            <p className="text-xs text-muted-foreground">
              Destinatário: <span className="font-medium text-foreground">{leaderName}</span> · {leaderPhone}
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              Nenhum telefone cadastrado para o líder. A mensagem será copiada.
            </p>
          )}

          <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3 border border-border max-h-64 overflow-y-auto font-sans leading-relaxed">
            {message}
          </pre>

          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={handleWhatsApp} disabled={sending}>
              <MessageCircle className="w-4 h-4" />
              {leaderPhone ? "Enviar via WhatsApp" : "Copiar e fechar"}
            </Button>
            <Button variant="outline" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
