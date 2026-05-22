import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMessages } from '@/lib/useMessages';
import { MESSAGE_REGISTRY, getCoverageStats, getMissingKeys, getMessageDef, type MessageDefinition } from '@/lib/messageRegistry';
import { 
  Monitor, 
  Mail, 
  MessageCircle, 
  Bell, 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  Sparkles,
  Eye,
  Info,
  Loader2,
  Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function MessagesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { dbMessages, isLoading, getMessage } = useMessages();
  
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'ui' | 'email' | 'whatsapp' | 'push'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMissingExpanded, setIsMissingExpanded] = useState(false);
  const [editingMessage, setEditingMessage] = useState<MessageDefinition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const stats = useMemo(() => getCoverageStats(dbMessages.map(m => m.key)), [dbMessages]);
  const missingMessages = useMemo(() => getMissingKeys(dbMessages.map(m => m.key)), [dbMessages]);

  const filteredMessages = useMemo(() => {
    return MESSAGE_REGISTRY.filter(msg => {
      const dbMsg = dbMessages.find(m => m.key === msg.key);
      
      const channelMatch = selectedChannel === 'all' || msg.channel === selectedChannel;
      const categoryMatch = selectedCategory === 'all' || msg.category === selectedCategory;
      
      let statusMatch = true;
      if (selectedStatus === 'custom') statusMatch = dbMsg?.is_customized === true;
      else if (selectedStatus === 'default') statusMatch = !!dbMsg && !dbMsg.is_customized;
      else if (selectedStatus === 'missing') statusMatch = !dbMsg;

      const searchLower = searchQuery.toLowerCase();
      const searchMatch = !searchQuery || 
        msg.name.toLowerCase().includes(searchLower) || 
        msg.key.toLowerCase().includes(searchLower) || 
        msg.description.toLowerCase().includes(searchLower);

      return channelMatch && categoryMatch && statusMatch && searchMatch;
    });
  }, [selectedChannel, selectedCategory, selectedStatus, searchQuery, dbMessages]);

  const handleEdit = (msg: MessageDefinition) => {
    setEditingMessage(msg);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingMessage({
      key: '',
      name: '',
      description: '',
      channel: 'ui',
      category: 'general',
      defaultPtBr: '',
      defaultEn: '',
      defaultEs: ''
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-stone-900">{t('admin.messages.title')}</h2>
          <Badge className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            stats.percentage >= 80 ? "bg-emerald-50 text-emerald-700" :
            stats.percentage >= 50 ? "bg-amber-50 text-amber-700" :
            "bg-red-50 text-red-600"
          )}>
            {t('admin.messages.coverage', { percentage: stats.percentage, covered: stats.covered })}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <BulkTranslateButton dbMessages={dbMessages} />
          <Button onClick={handleNew} className="bg-[#C2714F] hover:bg-[#A35D3F] text-white gap-2">
            <Plus className="w-4 h-4" />
            {t('admin.messages.newTitle')}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Channel Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: t('admin.messages.filterAll'), icon: null },
            { id: 'ui', label: t('admin.messages.filterUI'), icon: '🖥️' },
            { id: 'email', label: t('admin.messages.filterEmail'), icon: '📧' },
            { id: 'whatsapp', label: t('admin.messages.filterWhatsapp'), icon: '💬' },
            { id: 'push', label: t('admin.messages.filterPush'), icon: '🔔' }
          ].map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id as any)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                selectedChannel === ch.id 
                  ? "bg-[#C2714F] text-white" 
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              {ch.icon} {ch.label}
            </button>
          ))}
        </div>

        {/* Category & Status & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="bg-white border-stone-200 h-10">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.messages.filterAll')}</SelectItem>
              <SelectItem value="auth">Auth</SelectItem>
              <SelectItem value="campaign">Campanha</SelectItem>
              <SelectItem value="invite">Convite</SelectItem>
              <SelectItem value="scheduling">Agendamento</SelectItem>
              <SelectItem value="occurrence">Ocorrência</SelectItem>
              <SelectItem value="approval">Aprovação</SelectItem>
              <SelectItem value="rateio">Rateio</SelectItem>
              <SelectItem value="error">Erros</SelectItem>
              <SelectItem value="validation">Validação</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="bg-white border-stone-200 h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.messages.filterAll')}</SelectItem>
              <SelectItem value="custom">✅ {t('admin.messages.statusCustom')}</SelectItem>
              <SelectItem value="default">⚪ {t('admin.messages.statusDefault')}</SelectItem>
              <SelectItem value="missing">🔴 {t('admin.messages.statusMissing')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Buscar mensagem..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-stone-200 h-10"
            />
          </div>
        </div>
      </div>

      {missingMessages.length > 0 && (
        <Collapsible
          open={isMissingExpanded}
          onOpenChange={setIsMissingExpanded}
          className="bg-amber-50 border border-amber-100 rounded-xl overflow-hidden"
        >
          <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between text-amber-800 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t('admin.messages.missingWarning', { count: missingMessages.length })}
            </div>
            {isMissingExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4 space-y-2">
            {missingMessages.map(msg => (
              <div key={msg.key} className="flex items-center justify-between bg-white/50 rounded-lg px-3 py-2 text-xs border border-amber-200/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-amber-700">{msg.key}</span>
                  <span className="text-stone-500">{msg.name}</span>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-amber-700 hover:text-amber-800 hover:bg-amber-100/50"
                  onClick={() => handleEdit(msg)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Criar
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="space-y-2">
        {filteredMessages.map(msg => {
          const dbMsg = dbMessages.find(m => m.key === msg.key);
          const channelEmoji = {
            ui: '🖥️',
            email: '📧',
            whatsapp: '💬',
            push: '🔔'
          }[msg.channel];

          return (
            <div 
              key={msg.key} 
              className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition group"
            >
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm shrink-0">{channelEmoji}</span>
                    <h3 className="font-semibold text-stone-900 text-sm truncate">{msg.name}</h3>
                    <span className="font-mono text-[10px] text-stone-400 bg-stone-50 px-2 py-0.5 rounded shrink-0">
                      {msg.key}
                    </span>
                  </div>
                  <p className="text-stone-400 text-xs mb-2">{msg.description}</p>
                  
                  <div className="bg-stone-50/50 rounded-lg p-2 border border-stone-50">
                    <p className="text-stone-600 text-sm italic line-clamp-2">
                      {dbMsg?.content_pt_br || msg.defaultPtBr}
                    </p>
                    {msg.variables && msg.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.variables.map(v => (
                          <span key={v} className="bg-stone-100 text-stone-500 text-[10px] px-1.5 py-0.5 rounded">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <span className={cn("w-1.5 h-1.5 rounded-full", (dbMsg?.content_pt_br || msg.defaultPtBr) ? "bg-emerald-500" : "bg-stone-300")}></span>
                              <span className="text-[10px] grayscale opacity-50">🇧🇷</span>
                              <span className={cn("w-1.5 h-1.5 rounded-full ml-1", dbMsg?.content_en ? "bg-emerald-500" : (msg.defaultEn ? "bg-amber-400" : "bg-stone-300"))}></span>
                              <span className="text-[10px] grayscale opacity-50">🇺🇸</span>
                              <span className={cn("w-1.5 h-1.5 rounded-full ml-1", dbMsg?.content_es ? "bg-emerald-500" : (msg.defaultEs ? "bg-amber-400" : "bg-stone-300"))}></span>
                              <span className="text-[10px] grayscale opacity-50">🇪🇸</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">
                            Português {(dbMsg?.content_pt_br || msg.defaultPtBr) ? '✅' : '❌'} | 
                            English {dbMsg?.content_en ? '✅' : (msg.defaultEn ? '⚠️' : '❌')} | 
                            Español {dbMsg?.content_es ? '✅' : (msg.defaultEs ? '⚠️' : '❌')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {dbMsg?.is_customized ? (
                      <Badge className="bg-emerald-50 text-emerald-600 border-none font-medium hover:bg-emerald-50 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.messages.statusCustom')}
                      </Badge>
                    ) : dbMsg ? (
                      <Badge className="bg-stone-50 text-stone-500 border-none font-medium hover:bg-stone-50 text-[10px]">
                        <Circle className="w-3 h-3 mr-1" /> {t('admin.messages.statusDefault')}
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-500 border-none font-medium hover:bg-red-50 text-[10px]">
                        <AlertCircle className="w-3 h-3 mr-1" /> {t('admin.messages.statusMissing')}
                      </Badge>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-stone-200 text-stone-600 hover:bg-stone-50 h-8"
                    onClick={() => handleEdit(msg)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                    {t('common.edit')}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MessageEditDialog 
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        message={editingMessage}
        dbMessage={dbMessages.find(m => m.key === editingMessage?.key)}
      />
    </div>
  );
}

function MessageEditDialog({ isOpen, onOpenChange, message, dbMessage }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  message: MessageDefinition | null;
  dbMessage?: any;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeLangTab, setActiveLangTab] = useState('pt');
  const [showPreview, setShowPreview] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    channel: 'ui' as any,
    category: 'general' as any,
    content_pt: '',
    content_en: '',
    content_es: ''
  });

  useMemo(() => {
    if (message) {
      setFormData({
        name: message.name,
        key: message.key,
        channel: message.channel,
        category: message.category,
        content_pt: dbMessage?.content_pt_br || message.defaultPtBr || '',
        content_en: dbMessage?.content_en || message.defaultEn || '',
        content_es: dbMessage?.content_es || message.defaultEs || ''
      });
    }
  }, [message, dbMessage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: formData.key,
        name: formData.name,
        channel: formData.channel,
        category: formData.category,
        content_pt_br: formData.content_pt,
        content_en: formData.content_en,
        content_es: formData.content_es,
        is_customized: true,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('messages' as any)
        .upsert(payload, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-messages'] });
      toast.success(t('admin.messages.saved'));
      onOpenChange(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(t('common.error'));
    }
  });

  if (!message) return null;

  const isNew = !message.key;

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById(`content-${activeLangTab}`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = activeLangTab === 'pt' ? formData.content_pt : activeLangTab === 'en' ? formData.content_en : formData.content_es;
    const newText = currentText.substring(0, start) + `{{${variable}}}` + currentText.substring(end);
    
    setFormData(prev => ({
      ...prev,
      [activeLangTab === 'pt' ? 'content_pt' : activeLangTab === 'en' ? 'content_en' : 'content_es']: newText
    }));

    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 0);
  };

  const currentContent = activeLangTab === 'pt' ? formData.content_pt : activeLangTab === 'en' ? formData.content_en : formData.content_es;

  const handleAutoTranslate = async () => {
    if (!formData.content_pt?.trim()) {
      toast.error(t('admin.messages.translateNeedsContent'));
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-message', {
        body: {
          text: formData.content_pt,
          targetLanguages: ['en', 'es']
        }
      });

      if (error) throw error;

      const { translations } = data;
      
      setFormData(prev => ({
        ...prev,
        content_en: translations['en'],
        content_es: translations['es']
      }));
      
      setActiveLangTab('en');
      toast.success(t('admin.messages.translateSuccess'));
    } catch (err) {
      toast.error(t('admin.messages.translateError'));
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const renderPreview = () => {
    let previewContent = currentContent;
    // Simple placeholder substitution for preview
    const sampleVars: Record<string, string> = {
      name: 'João Silva',
      campaignName: 'Black Friday 2024',
      storeName: 'Loja Centro',
      platformName: 'ProduzAI',
      inviterName: 'Admin',
      date: '25/11/2024',
      time: '14:30',
      team: 'Equipe Alpha',
      occurrenceType: 'Atraso na entrega',
      approvalUrl: 'https://produzai.app/approve/123',
      joinUrl: 'https://produzai.app/join/xyz'
    };

    Object.entries(sampleVars).forEach(([k, v]) => {
      previewContent = previewContent.replace(new RegExp(`{{${k}}}`, 'g'), v);
    });

    if (formData.channel === 'whatsapp') {
      return (
        <div className="bg-[#e5ddd5] p-4 rounded-lg flex flex-col gap-1 items-start">
          <div className="bg-[#dcf8c6] p-3 rounded-lg rounded-tl-none shadow-sm text-sm text-stone-800 max-w-[85%] whitespace-pre-wrap relative">
            {previewContent}
            <span className="text-[10px] text-stone-400 float-right mt-1 ml-2">14:30</span>
          </div>
        </div>
      );
    }

    if (formData.channel === 'email') {
      return (
        <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-sm text-sm text-stone-700 whitespace-pre-wrap">
          {previewContent}
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <div className={cn(
          "px-4 py-2 rounded-lg text-sm shadow-lg flex items-center gap-2 max-w-sm",
          formData.category === 'error' ? "bg-red-600 text-white" : "bg-stone-800 text-white"
        )}>
          {formData.category === 'error' ? <AlertCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          {previewContent}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-stone-900 font-semibold">
            {isNew ? t('admin.messages.newTitle') : t('admin.messages.editTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase">Nome da Mensagem</label>
              <Input 
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Erro de Login"
                className="bg-stone-50/50 border-stone-200"
                readOnly={!isNew}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase">Chave (Identificador)</label>
              <Input 
                value={formData.key}
                onChange={e => setFormData(f => ({ ...f, key: e.target.value }))}
                placeholder="Ex: ui_auth_login_error"
                className="bg-stone-50 border-stone-200 font-mono text-xs"
                readOnly={!isNew}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase">Canal</label>
              <Select value={formData.channel} onValueChange={v => setFormData(f => ({ ...f, channel: v }))} disabled={!isNew}>
                <SelectTrigger className="bg-stone-50/50 border-stone-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ui">🖥️ Visual (UI)</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="push">🔔 Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-500 uppercase">Categoria</label>
              <Select value={formData.category} onValueChange={v => setFormData(f => ({ ...f, category: v }))} disabled={!isNew}>
                <SelectTrigger className="bg-stone-50/50 border-stone-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="campaign">Campanha</SelectItem>
                  <SelectItem value="invite">Convite</SelectItem>
                  <SelectItem value="scheduling">Agendamento</SelectItem>
                  <SelectItem value="occurrence">Ocorrência</SelectItem>
                  <SelectItem value="approval">Aprovação</SelectItem>
                  <SelectItem value="rateio">Rateio</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                  <SelectItem value="validation">Validação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeLangTab} onValueChange={setActiveLangTab} className="w-full">
            <TabsList className="bg-stone-100 p-1 rounded-lg w-fit">
              <TabsTrigger value="pt" className="gap-2 px-4 py-1.5 data-[state=active]:bg-white rounded-md transition-all">
                <span>🇧🇷</span> Português
              </TabsTrigger>
              <TabsTrigger value="en" className="gap-2 px-4 py-1.5 data-[state=active]:bg-white rounded-md transition-all">
                <span>🇺🇸</span> English
              </TabsTrigger>
              <TabsTrigger value="es" className="gap-2 px-4 py-1.5 data-[state=active]:bg-white rounded-md transition-all">
                <span>🇪🇸</span> Español
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {message.variables?.map(v => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="bg-stone-50 hover:bg-stone-100 text-stone-500 border border-stone-200 text-[10px] px-2 py-1 rounded-md transition-colors"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Textarea 
                  id={`content-${activeLangTab}`}
                  value={currentContent}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    [activeLangTab === 'pt' ? 'content_pt' : activeLangTab === 'en' ? 'content_en' : 'content_es']: e.target.value
                  }))}
                  rows={5}
                  className="bg-stone-50/30 border-stone-200 resize-none focus:ring-1 focus:ring-stone-200"
                  placeholder="Escreva o conteúdo da mensagem..."
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-stone-400">
                  {currentContent.length} caracteres
                </div>
              </div>

              {activeLangTab === 'pt' && (
                <div className="flex items-center gap-2">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={handleAutoTranslate}
                    disabled={isTranslating || !formData.content_pt}
                    className="gap-2 text-stone-600 border-stone-200 bg-white h-8"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t('admin.messages.translating')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {t('admin.messages.autoTranslate')}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Tabs>

          <div className="space-y-4 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                <Eye className="w-4 h-4 text-[#C2714F]" />
                {t('admin.messages.preview')}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="text-stone-400 text-xs h-7 hover:bg-stone-50"
              >
                {showPreview ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            
            {showPreview && (
              <div className="bg-stone-50/50 rounded-xl p-8 border border-stone-100/50">
                {renderPreview()}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 bg-stone-50/50 border-t border-stone-100">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-stone-500 hover:text-stone-700">
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || !formData.key || !formData.content_pt}
            className="bg-[#C2714F] hover:bg-[#A35D3F] text-white min-w-[180px]"
          >
            {saveMutation.isPending ? t('common.saving') : t('admin.messages.saveCustom')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkTranslateButton({ dbMessages }: { dbMessages: any[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const pendingMessages = useMemo(() => {
    return MESSAGE_REGISTRY.filter(def => {
      const dbMsg = dbMessages.find(m => m.key === def.key);
      // Missing either EN or ES
      return !dbMsg?.content_en || !dbMsg?.content_es;
    });
  }, [dbMessages]);

  const handleBulkTranslate = async () => {
    if (pendingMessages.length === 0) return;
    if (!confirm(t('admin.messages.bulkTranslateConfirm', { count: pendingMessages.length }) || `Deseja traduzir ${pendingMessages.length} mensagens pendentes automaticamente?`)) return;

    setIsBulkTranslating(true);
    setProgress({ current: 0, total: pendingMessages.length });

    try {
      for (let i = 0; i < pendingMessages.length; i++) {
        const msg = pendingMessages[i];
        setProgress(p => ({ ...p, current: i + 1 }));
        
        const dbMsg = dbMessages.find(m => m.key === msg.key);
        const ptContent = dbMsg?.content_pt_br || msg.defaultPtBr;

        const { data, error } = await supabase.functions.invoke('translate-message', {
          body: {
            text: ptContent,
            targetLanguages: ['en', 'es']
          }
        });

        if (error) throw error;

        const { translations } = data;
        
        await supabase
          .from('messages' as any)
          .upsert({
            key: msg.key,
            name: msg.name,
            channel: msg.channel,
            category: msg.category,
            content_pt_br: ptContent,
            content_en: translations['en'],
            content_es: translations['es'],
            is_customized: true,
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      }

      queryClient.invalidateQueries({ queryKey: ['system-messages'] });
      toast.success(t('admin.messages.bulkTranslateSuccess', { count: pendingMessages.length }));
    } catch (err) {
      console.error('Bulk translation error:', err);
      toast.error(t('admin.messages.translateError'));
    } finally {
      setIsBulkTranslating(false);
    }
  };

  if (pendingMessages.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBulkTranslate}
      disabled={isBulkTranslating}
      className="gap-2 border-[#C2714F] text-[#C2714F] hover:bg-[#C2714F]/5"
    >
      {isBulkTranslating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('admin.messages.bulkTranslating', { current: progress.current, total: progress.total })}
        </>
      ) : (
        <>
          <Languages className="w-4 h-4" />
          {t('admin.messages.bulkTranslate', { count: pendingMessages.length })}
        </>
      )}
    </Button>
  );
}
