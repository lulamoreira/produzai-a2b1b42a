import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, RefreshCw, Download, Copy, Eye, EyeOff, Search, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useInstallationTeams, useAllTeamMembers } from "@/components/InstallationTeamDialog";
import AccessWindowConfig from "@/components/AccessWindowConfig";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, ChevronDown } from "lucide-react";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 to avoid confusion
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface TeamCodesPanelProps {
  campaignId: string;
}

export default function TeamCodesPanel({ campaignId }: TeamCodesPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [visibleCodes, setVisibleCodes] = useState<Record<string, boolean>>({});
  const [accessWindowOpen, setAccessWindowOpen] = useState(false);

  const { data: teams = [] } = useInstallationTeams(campaignId);
  const { data: allMembers = {} } = useAllTeamMembers(campaignId);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["team_codes", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_team_codes")
        .select("*")
        .eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: whatsappTeamCodeTemplate } = useQuery({
    queryKey: ["system_message", "whatsapp_team_code"],
    queryFn: async () => {
      const { data } = await supabase.from("system_messages").select("content").eq("key", "whatsapp_team_code").is("agency_id", null).maybeSingle();
      return data?.content as string | undefined;
    },
  });

  const codeMap = useMemo(() => {
    const map: Record<string, { id: string; code: string; created_at: string }> = {};
    codes.forEach((c) => { map[c.team_id] = c; });
    return map;
  }, [codes]);

  const generateMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const code = generateCode();
      const existing = codeMap[teamId];
      if (existing) {
        const { error } = await supabase
          .from("installation_team_codes")
          .update({ code, created_by: user?.id, created_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("installation_team_codes")
          .insert({ team_id: teamId, campaign_id: campaignId, code, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_codes", campaignId] });
      toast.success("Código gerado com sucesso!");
    },
    onError: () => toast.error("Erro ao gerar código"),
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      for (const team of teams) {
        const code = generateCode();
        const existing = codeMap[team.id];
        if (existing) {
          await supabase
            .from("installation_team_codes")
            .update({ code, created_by: user?.id, created_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("installation_team_codes")
            .insert({ team_id: team.id, campaign_id: campaignId, code, created_by: user?.id });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_codes", campaignId] });
      toast.success("Todos os códigos foram gerados!");
    },
    onError: () => toast.error("Erro ao gerar códigos"),
  });

  const handleExportExcel = async () => {
    try {
      const { default: XLSX } = await import("xlsx");
      const rows = teams.map((t) => ({
        Equipe: t.name,
        Código: codeMap[t.id]?.code || "— Não gerado —",
        "Gerado em": codeMap[t.id]?.created_at
          ? new Date(codeMap[t.id].created_at).toLocaleString("pt-BR")
          : "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 22 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Códigos de Equipe");
      XLSX.writeFile(wb, `Codigos_Equipes_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Planilha exportada!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const sendWhatsApp = (teamId: string) => {
    const teamCode = codeMap[teamId];
    const team = teams.find((t) => t.id === teamId);
    if (!teamCode || !team) return;

    const members = allMembers[teamId] || [];
    const leader = members.find((m) => m.is_leader);
    if (!leader || !leader.phone) {
      toast.error("Nenhum líder com telefone cadastrado nesta equipe. Defina um líder no cadastro de equipes.");
      return;
    }

    const phone = leader.phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;

    const message = `🔑 *Código de Acesso Temporário*

Olá ${leader.name}! Segue seu código de acesso para a campanha:

*Equipe:* ${team.name}
*Código:* ${teamCode.code}

📱 *Como acessar:*
1. Acesse o link do sistema
2. Na tela de login, clique em "Acesso Instalador"
3. Digite o código acima
4. Você verá as tarefas agendadas para sua equipe

⏰ O acesso é liberado 2h antes do horário agendado e expira 24h após o início.

Em caso de dúvidas, entre em contato com a administração.`;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const filteredTeams = teams.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Access Window – collapsible at the top */}
      <Collapsible open={accessWindowOpen} onOpenChange={setAccessWindowOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/60 border border-border hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Janela de Acesso Temporário</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${accessWindowOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="p-4 rounded-lg border border-border bg-card">
            <AccessWindowConfig campaignId={campaignId} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Key className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Códigos de Acesso Temporário</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => generateAllMutation.mutate()}
          disabled={generateAllMutation.isPending || teams.length === 0}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${generateAllMutation.isPending ? "animate-spin" : ""}`} />
          Gerar Todos
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={handleExportExcel}
          disabled={teams.length === 0}
        >
          <Download className="w-3.5 h-3.5" /> Exportar Excel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Gere códigos alfanuméricos de 10 dígitos para que equipes de instalação acessem suas tarefas.
        Configure a janela de acesso abaixo.
      </p>

      {teams.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-sm"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : filteredTeams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {teams.length === 0
            ? "Nenhuma equipe cadastrada. Crie equipes no módulo de Agendamento."
            : "Nenhuma equipe encontrada."}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredTeams.map((team) => {
            const teamCode = codeMap[team.id];
            const isVisible = visibleCodes[team.id];
            return (
              <div
                key={team.id}
                className="aqua-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{team.name}</p>
                  {teamCode && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Gerado em: {new Date(teamCode.created_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {teamCode ? (
                    <>
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded-md tracking-wider select-all min-w-[120px] text-center">
                        {isVisible ? teamCode.code : "••••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setVisibleCodes((p) => ({ ...p, [team.id]: !p[team.id] }))
                        }
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(teamCode.code)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={() => sendWhatsApp(team.id)}
                        title="Enviar código via WhatsApp para o líder"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sem código</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => generateMutation.mutate(team.id)}
                    disabled={generateMutation.isPending}
                  >
                    <RefreshCw className={`w-3 h-3 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                    {teamCode ? "Resetar" : "Gerar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}