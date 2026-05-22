import { getMessageDef } from '@/lib/messageRegistry';

export function getStaticMessage(
  key: string,
  lang: string,
  variables?: Record<string, string>
): string {
  const def = getMessageDef(key);
  if (!def) return key;

  let content =
    lang === 'en' || lang === 'en-US' ? def.defaultEn
    : lang === 'es' ? def.defaultEs
    : def.defaultPtBr;

  if (variables) {
    Object.entries(variables).forEach(([k, v]) => {
      content = content.replace(new RegExp(`{{${k}}}`, 'g'), v);
    });
  }

  return content;
}
