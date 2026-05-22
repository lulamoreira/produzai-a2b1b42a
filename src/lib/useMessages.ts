import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getMessageDef } from '@/lib/messageRegistry';
import { useTranslation } from 'react-i18next';

interface DbMessage {
  key: string;
  content_pt_br: string | null;
  content_en: string | null;
  content_es: string | null;
  is_customized: boolean;
}

export function useMessages() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const { data: dbMessages = [] } = useQuery<DbMessage[]>({
    queryKey: ['system-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages' as any)
        .select('key, content_pt_br, content_en, content_es, is_customized')
        .eq('is_active', true);
      if (error) throw error;
      return (data as any) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getMessage = (key: string, variables?: Record<string, string>): string => {
    const def = getMessageDef(key);
    const dbMsg = dbMessages.find(m => m.key === key);
    let content = '';

    // Priority 1: customized DB message
    if (dbMsg?.is_customized) {
      if (lang === 'en' || lang === 'en-US') content = dbMsg.content_en ?? '';
      else if (lang === 'es') content = dbMsg.content_es ?? '';
      else content = dbMsg.content_pt_br ?? '';
    }

    // Priority 2: registry default
    if (!content && def) {
      if (lang === 'en' || lang === 'en-US') content = def.defaultEn;
      else if (lang === 'es') content = def.defaultEs;
      else content = def.defaultPtBr;
    }

    // Priority 3: key as last resort
    if (!content) content = key;

    // Interpolate {{variables}}
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        content = content.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
    }

    return content;
  };

  return { getMessage };
}
