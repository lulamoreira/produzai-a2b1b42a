import { useState, useMemo } from "react";
import { useSystemMessages, useUpdateSystemMessage, useCreateSystemMessage, useDeleteSystemMessage, type SystemMessage } from "@/hooks/useSystemMessages";
import { useAgencies } from "@/hooks/useAgencies";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Plus, Trash2, Globe, Building2, Mail, MessageCircle, ShieldAlert, Monitor, Search, HelpCircle } from "lucide-react";

const VARIABLES_HELP = [
  { category: "WhatsApp", variables: [
    { name: "{name}", desc: "Primeiro nome do contato da loja" },
    { name: "{store}", desc: "Apelido ou nome da loja destinatária" },
    { name: "{id}", desc: "ID resumido da ocorrência (8 caracteres)" },
    { name: "{campaign}", desc: "Nome da campanha" },
    { name: "{date}", desc: "Data e hora do registro da ocorrência" },
    { name: "{url}", desc: "Link público da ocorrência" },
    { name: "{leader}", desc: "Nome do líder da equipe de instalação" },
    { name: "{team}", desc: "Nome da equipe de instalação" },
    { name: "{code}", desc: "Código de acesso gerado para a equipe" },
    { name: "{link}", desc: "Link de acesso ao sistema para a equipe" },
  ]},
  { category: "E-mail", variables: [
    { name: "{status}", desc: "Nome/label do status atual da ocorrência" },
    { name: "{store}", desc: "Apelido ou nome da loja" },
    { name: "{campaign}", desc: "Nome da campanha" },
    { name: "{client}", desc: "Nome do cliente" },
    { name: "{piece}", desc: "Nome da peça" },
    { name: "{motive}", desc: "Descrição do motivo da ocorrência" },
    { name: "{date}", desc: "Data e hora do registro" },
    { name: "{description}", desc: "Descrição da ocorrência" },
  ]},
  { category: "Bloqueio / Interface", variables: [
    { name: "—", desc: "Mensagens de bloqueio e interface geralmente não usam variáveis. O texto é exibido como está." },
  ]},
];

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ui: { label: "Interface (UI)", icon: <Monitor className="w-3.5 h-3.5" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  email: { label: "E-mail", icon: <Mail className="w-3.5 h-3.5" />, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  whatsapp: { label: "WhatsApp", icon: <MessageCircle className="w-3.5 h-3.5" />, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  blocking: { label: "Bloqueio", icon: <ShieldAlert className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const KEY_LABELS: Record<string, string> = {
  occurrence_period_closed: "Período de ocorrências encerrado",
  occurrence_period_closed_title: "Título: período encerrado",
  occurrence_no_period_configured: "Período não configurado",
  email_occurrence_subject: "Assunto do e-mail de ocorrência",
  email_occurrence_new_banner: "Banner: nova ocorrência",
  email_occurrence_status_banner: "Banner: status atualizado",
  email_occurrence_updated_banner: "Banner: ocorrência atualizada",
  email_occurrence_footer: "Rodapé do e-mail",
  email_occurrence_button: "Botão: visualizar ocorrência",
  whatsapp_occurrence_link: "Link de ocorrência",
  whatsapp_occurrence_contact: "Contato sobre ocorrência",
  whatsapp_store_contact: "Saudação ao contato da loja",
  whatsapp_team_code: "Código de acesso da equipe",
  whatsapp_scheduling_authorization: "Autorização de agendamento",
  ui_auth_login_error: "Erro de login",
  ui_auth_signup_success: "Sucesso ao criar conta",
  ui_auth_recovery_sent: "E-mail de recuperação enviado",
  ui_photo_sent: "Foto enviada",
  ui_code_generated: "Código gerado",
  ui_code_copied: "Código copiado",
  ui_user_deleted: "Usuário excluído",
};

export default function SystemMessagesManager() {
  const { data: messages = [], isLoading } = useSystemMessages();
  const { data: agencies = [] } = useAgencies();
  const updateMsg = useUpdateSystemMessage();
  const createMsg = useCreateSystemMessage();
  const deleteMsg = useDeleteSystemMessage();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [scope, setScope] = useState<string>("global");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ key: "", category: "ui", content: "", agency_id: "" });
  const [showHelp, setShowHelp] = useState(false);

  const filteredMessages = useMemo(() => {
    let filtered = messages;
    if (scope === "global") {
      filtered = filtered.filter(m => !m.agency_id);
    } else {
      filtered = filtered.filter(m => m.agency_id === scope);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m =>
        m.key.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        (KEY_LABELS[m.key] || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [messages, scope, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, SystemMessage[]> = {};
    for (const m of filteredMessages) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    return groups;
  }, [filteredMessages]);

  const startEdit = (msg: SystemMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateMsg.mutateAsync({ id: editingId, content: editContent });
      toast.success("Mensagem atualizada!");
      setEditingId(null);
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleCreate = async () => {
    if (!newForm.key.trim() || !newForm.content.trim()) {
      toast.error("Preencha a chave e o conteúdo");
      return;
    }
    try {
      await createMsg.mutateAsync({
        key: newForm.key.trim(),
        category: newForm.category,
        content: newForm.content.trim(),
        agency_id: newForm.agency_id || null,
      });
      toast.success("Mensagem criada!");
      setShowNew(false);
      setNewForm({ key: "", category: "ui", content: "", agency_id: "" });
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Já existe uma mensagem com essa chave" : "Erro ao criar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mensagem?")) return;
    try {
      await deleteMsg.mutateAsync(id);
      toast.success("Mensagem excluída!");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scope selector + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={scope} onValueChange={setScope} className="flex-1">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="global" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Globe className="w-4 h-4" /> Todas (Global)
            </TabsTrigger>
            {agencies.map(a => (
              <TabsTrigger key={a.id} value={a.id} className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Building2 className="w-4 h-4" /> {a.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 w-48"
            />
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowHelp(true)}>
            <HelpCircle className="w-4 h-4" /> Variáveis
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> Nova mensagem
          </Button>
        </div>
      </div>

      {/* Messages grouped by category */}
      {Object.entries(CATEGORY_META).map(([cat, meta]) => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        return (
          <Card key={cat} className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Badge className={`gap-1 ${meta.color}`}>
                  {meta.icon} {meta.label}
                </Badge>
                <span className="text-muted-foreground font-normal text-xs">({items.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map(msg => (
                <div key={msg.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {KEY_LABELS[msg.key] || msg.key}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">{msg.key}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {editingId === msg.id ? (
                        <Button size="sm" variant="default" className="gap-1 h-7" onClick={saveEdit} disabled={updateMsg.isPending}>
                          <Save className="w-3.5 h-3.5" /> Salvar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => startEdit(msg)}>
                          Editar
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(msg.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {editingId === msg.id ? (
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="min-h-[60px] text-sm"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-2">
                      {msg.content}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {filteredMessages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          {scope !== "global"
            ? "Nenhuma mensagem customizada para esta agência. Clique em \"Nova mensagem\" para criar."
            : "Nenhuma mensagem encontrada."}
        </p>
      )}

      {/* Create dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Mensagem do Sistema</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Chave (identificador)</label>
              <Input
                value={newForm.key}
                onChange={e => setNewForm(f => ({ ...f, key: e.target.value }))}
                placeholder="ex: whatsapp_welcome"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Categoria</label>
              <Select value={newForm.category} onValueChange={v => setNewForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Agência (deixe vazio para global)</label>
              <Select value={newForm.agency_id} onValueChange={v => setNewForm(f => ({ ...f, agency_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Global (todas as agências)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Global</SelectItem>
                  {agencies.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Conteúdo</label>
              <Textarea
                value={newForm.content}
                onChange={e => setNewForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Texto da mensagem..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMsg.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variables help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" /> Variáveis Dinâmicas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 mb-4">
            <p className="text-sm text-muted-foreground">
              Use variáveis entre chaves <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{variavel}"}</code> no conteúdo das mensagens. Elas serão substituídas automaticamente pelos dados reais ao enviar.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Exemplo:</strong> <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">Olá, {"{name}"}, como vai? Referente à loja {"{store}"}.</code>
            </p>
          </div>
          {VARIABLES_HELP.map(group => (
            <div key={group.category} className="mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-1">{group.category}</h3>
              <div className="space-y-1.5">
                {group.variables.map(v => (
                  <div key={v.name} className="flex gap-3 items-start text-sm">
                    <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono shrink-0 min-w-[100px]">{v.name}</code>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHelp(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
