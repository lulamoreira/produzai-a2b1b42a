export interface ChangelogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  type: "feature" | "fix" | "improvement";
}

/**
 * Changelog entries — newest first.
 * To add a new entry, just prepend it to this array.
 */
export const changelog: ChangelogEntry[] = [
  {
    id: "2026-03-09-scroll-fix",
    date: "2026-03-09",
    title: "Correção de rolagem no importador de especificações",
    description:
      "A lista de peças no popover de importação de especificações agora rola corretamente tanto no desktop quanto no celular.",
    type: "fix",
  },
  {
    id: "2026-03-07-import-fix",
    date: "2026-03-07",
    title: "Correção na importação de campanhas",
    description:
      "Corrigido um problema onde peças não apareciam ao selecionar uma campanha anterior nos módulos de Importar Quantidades, Especificações e Peças.",
    type: "fix",
  },
  {
    id: "2026-03-06-empty-store-indicator",
    date: "2026-03-06",
    title: "Indicador de lojas vazias na matriz",
    description:
      'Lojas sem quantidades atribuídas agora exibem o símbolo "⚠" em amarelo na matriz e aparecem com fundo destacado na Edição Rápida.',
    type: "feature",
  },
];
