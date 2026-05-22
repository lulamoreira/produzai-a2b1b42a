export interface MessageDefinition {
  key: string;
  name: string;
  description: string;
  channel: 'ui' | 'email' | 'whatsapp' | 'push';
  category: 'auth' | 'campaign' | 'invite' | 'scheduling' | 'occurrence' | 'approval' | 'rateio' | 'general' | 'error' | 'validation';
  variables?: string[];
  defaultPtBr: string;
  defaultEn: string;
  defaultEs: string;
}

export const MESSAGE_REGISTRY: MessageDefinition[] = [
  // AUTH
  { key: 'ui_auth_login_error', name: 'Erro de login', description: 'Email ou senha incorretos', channel: 'ui', category: 'auth', defaultPtBr: 'Email ou senha incorretos.', defaultEn: 'Incorrect email or password.', defaultEs: 'Email o contraseña incorrectos.' },
  { key: 'ui_auth_recovery_sent', name: 'Recuperação enviada', description: 'Confirmação de recuperação de senha', channel: 'ui', category: 'auth', defaultPtBr: 'Email de recuperação enviado! Verifique sua caixa de entrada.', defaultEn: 'Recovery email sent! Check your inbox.', defaultEs: '¡Email de recuperación enviado!' },
  { key: 'ui_auth_signup_success', name: 'Conta criada', description: 'Confirmação após criar conta', channel: 'ui', category: 'auth', defaultPtBr: 'Conta criada com sucesso! Faça login para continuar.', defaultEn: 'Account created! Please log in.', defaultEs: '¡Cuenta creada! Inicia sesión.' },
  // INVITE
  { key: 'email_invite_subject', name: 'Assunto do convite', description: 'Assunto do email de convite', channel: 'email', category: 'invite', variables: ['inviterName','platformName'], defaultPtBr: 'Você foi convidado para o {{platformName}}', defaultEn: 'You have been invited to {{platformName}}', defaultEs: 'Fuiste invitado a {{platformName}}' },
  { key: 'email_invite_body', name: 'Corpo do convite', description: 'Texto completo do email de convite', channel: 'email', category: 'invite', variables: ['name','inviterName','joinUrl','expiryDate','personalMessage'], defaultPtBr: 'Olá, {{name}}!\n\n{{personalMessage}}\n\nConvidado por {{inviterName}}.\n\nCrie sua conta:\n{{joinUrl}}\n\nVálido até: {{expiryDate}}', defaultEn: 'Hello, {{name}}!\n\n{{personalMessage}}\n\nInvited by {{inviterName}}.\n\nCreate your account:\n{{joinUrl}}\n\nValid until: {{expiryDate}}', defaultEs: '¡Hola, {{name}}!\n\n{{personalMessage}}\n\nInvitado por {{inviterName}}.\n\nCrea tu cuenta:\n{{joinUrl}}\n\nVálido hasta: {{expiryDate}}' },
  { key: 'ui_invite_sent', name: 'Convite enviado', description: 'Toast após criar convite', channel: 'ui', category: 'invite', defaultPtBr: 'Convite criado! Seu cliente de email foi aberto.', defaultEn: 'Invite created! Your email client has been opened.', defaultEs: '¡Invitación creada!' },
  // CAMPAIGN
  { key: 'ui_campaign_created', name: 'Campanha criada', description: 'Toast ao criar campanha', channel: 'ui', category: 'campaign', variables: ['campaignName'], defaultPtBr: 'Campanha "{{campaignName}}" criada com sucesso!', defaultEn: 'Campaign "{{campaignName}}" created!', defaultEs: '¡Campaña "{{campaignName}}" creada!' },
  { key: 'ui_campaign_updated', name: 'Campanha atualizada', description: 'Toast ao editar campanha', channel: 'ui', category: 'campaign', defaultPtBr: 'Campanha atualizada com sucesso!', defaultEn: 'Campaign updated!', defaultEs: '¡Campaña actualizada!' },
  { key: 'ui_campaign_deactivated', name: 'Campanha inativada', description: 'Toast ao inativar campanha', channel: 'ui', category: 'campaign', defaultPtBr: 'Campanha inativada com sucesso.', defaultEn: 'Campaign deactivated.', defaultEs: 'Campaña desactivada.' },
  // APPROVAL
  { key: 'ui_approval_approved', name: 'Aprovação concedida', description: 'Toast ao aprovar instalação', channel: 'ui', category: 'approval', defaultPtBr: 'Instalação aprovada!', defaultEn: 'Installation approved!', defaultEs: '¡Instalación aprobada!' },
  { key: 'ui_approval_rejected', name: 'Aprovação rejeitada', description: 'Toast ao rejeitar', channel: 'ui', category: 'approval', defaultPtBr: 'Instalação rejeitada.', defaultEn: 'Installation rejected.', defaultEs: 'Instalación rechazada.' },
  { key: 'whatsapp_approval_request', name: 'Aprovação (WhatsApp)', description: 'Mensagem WhatsApp de aprovação', channel: 'whatsapp', category: 'approval', variables: ['storeName','campaignName','date','approvalUrl'], defaultPtBr: '✅ *Aprovação necessária*\n\nLoja: {{storeName}}\nCampanha: {{campaignName}}\nData: {{date}}\n\nAprovar: {{approvalUrl}}', defaultEn: '✅ *Approval needed*\n\nStore: {{storeName}}\nCampaign: {{campaignName}}\nDate: {{date}}\n\nApprove: {{approvalUrl}}', defaultEs: '✅ *Aprobación necesaria*\n\nTienda: {{storeName}}\nCampaña: {{campaignName}}\nFecha: {{date}}\n\nAprobar: {{approvalUrl}}' },
  // OCCURRENCE
  { key: 'ui_occurrence_registered', name: 'Ocorrência registrada', description: 'Toast ao registrar ocorrência', channel: 'ui', category: 'occurrence', defaultPtBr: 'Ocorrência registrada com sucesso!', defaultEn: 'Occurrence registered!', defaultEs: '¡Ocurrencia registrada!' },
  { key: 'whatsapp_occurrence_new', name: 'Nova ocorrência (WhatsApp)', description: 'Notificação WhatsApp', channel: 'whatsapp', category: 'occurrence', variables: ['storeName','occurrenceType','campaignName'], defaultPtBr: '⚠️ *Nova Ocorrência*\n\nLoja: {{storeName}}\nTipo: {{occurrenceType}}\nCampanha: {{campaignName}}', defaultEn: '⚠️ *New Occurrence*\n\nStore: {{storeName}}\nType: {{occurrenceType}}\nCampaign: {{campaignName}}', defaultEs: '⚠️ *Nueva Ocurrencia*\n\nTienda: {{storeName}}\nTipo: {{occurrenceType}}\nCampaña: {{campaignName}}' },
  // SCHEDULING
  { key: 'ui_scheduling_saved', name: 'Agendamento salvo', description: 'Toast ao salvar agendamento', channel: 'ui', category: 'scheduling', defaultPtBr: 'Agendamento salvo com sucesso!', defaultEn: 'Schedule saved!', defaultEs: '¡Agendamiento guardado!' },
  { key: 'whatsapp_scheduling_confirmed', name: 'Agendamento (WhatsApp)', description: 'Confirmação de agendamento', channel: 'whatsapp', category: 'scheduling', variables: ['storeName','date','time','team'], defaultPtBr: '📅 *Agendamento Confirmado*\n\nLoja: {{storeName}}\nData: {{date}}\nHorário: {{time}}\nEquipe: {{team}}', defaultEn: '📅 *Schedule Confirmed*\n\nStore: {{storeName}}\nDate: {{date}}\nTime: {{time}}\nTeam: {{team}}', defaultEs: '📅 *Agendamiento Confirmado*\n\nTienda: {{storeName}}\nFecha: {{date}}\nHorario: {{time}}\nEquipo: {{team}}' },
  // RATEIO
  { key: 'ui_rateio_saved', name: 'Rateio salvo', description: 'Toast ao salvar rateio', channel: 'ui', category: 'rateio', defaultPtBr: 'Rateio salvo com sucesso!', defaultEn: 'Rateio saved!', defaultEs: '¡Rateio guardado!' },
  { key: 'ui_rateio_automation_done', name: 'Automação concluída', description: 'Toast após automação', channel: 'ui', category: 'rateio', defaultPtBr: 'Automação de matriz concluída!', defaultEn: 'Matrix automation completed!', defaultEs: '¡Automatización completada!' },
  // ERRORS
  { key: 'ui_error_generic', name: 'Erro genérico', description: 'Erro padrão', channel: 'ui', category: 'error', defaultPtBr: 'Algo deu errado. Tente novamente.', defaultEn: 'Something went wrong. Please try again.', defaultEs: 'Algo salió mal. Intenta de nuevo.' },
  { key: 'ui_error_permission', name: 'Sem permissão', description: 'Ação sem permissão', channel: 'ui', category: 'error', defaultPtBr: 'Você não tem permissão para esta ação.', defaultEn: 'You do not have permission.', defaultEs: 'No tienes permiso.' },
  { key: 'ui_error_not_found', name: 'Não encontrado', description: 'Registro não existe', channel: 'ui', category: 'error', defaultPtBr: 'Registro não encontrado.', defaultEn: 'Record not found.', defaultEs: 'Registro no encontrado.' },
];

export const getMessageDef = (key: string) =>
  MESSAGE_REGISTRY.find(m => m.key === key);

export const getMessagesByChannel = (channel: MessageDefinition['channel']) =>
  MESSAGE_REGISTRY.filter(m => m.channel === channel);

export const getMessagesByCategory = (category: MessageDefinition['category']) =>
  MESSAGE_REGISTRY.filter(m => m.category === category);

export const getMissingKeys = (dbKeys: string[]): MessageDefinition[] =>
  MESSAGE_REGISTRY.filter(def => !dbKeys.includes(def.key));

export const getCoverageStats = (dbKeys: string[]) => {
  const total = MESSAGE_REGISTRY.length;
  const covered = MESSAGE_REGISTRY.filter(def => dbKeys.includes(def.key)).length;
  return { total, covered, missing: total - covered, percentage: Math.round((covered / total) * 100) };
};
