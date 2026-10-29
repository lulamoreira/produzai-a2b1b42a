import type { LojaALojaTipo, LojaALojaPeca } from "@/hooks/useLojaALoja";

export interface CopyPieceItem {
  id: string;
  nome: string;
  image_url: string | null;
  checked: boolean;
}

export function copyPieceSources(tipos: LojaALojaTipo[], pieces: LojaALojaPeca[], tipoId: string | null, subId: string | null) {
  const sources: { id: string; kind: "tipo" | "sub"; label: string }[] = [];
  for (const tipo of tipos) {
    if (!tipo.tem_subdivisao) {
      // Vitrine: peças direto no tipo (subdivisao_id null)
      if (tipo.id !== tipoId && pieces.some(p => p.tipo_id === tipo.id && !p.subdivisao_id)) {
        sources.push({ id: tipo.id, kind: "tipo", label: `${tipo.letra} — ${tipo.nome}` });
      }
    } else {
      // Interno: peças dentro das subdivisões
      for (const sub of (tipo.subdivisoes ?? [])) {
        if (sub.id !== subId && pieces.some(p => p.subdivisao_id === sub.id)) {
          sources.push({ id: sub.id, kind: "sub", label: `${tipo.letra} — ${tipo.nome} — ${sub.nome}` });
        }
      }
    }
  }
  return sources;
}

export function buildCopiedPieceRows(items: CopyPieceItem[], campaignId: string, tipoId: string | null, subId: string | null, existing: { display_order: number }[]) {
  if (!tipoId && !subId) throw new Error("Selecione uma letra de destino.");
  const selected = items.filter(item => item.checked);
  if (selected.some(item => !item.nome.trim())) throw new Error("Preencha o nome de todas as peças marcadas.");
  const base = existing.reduce((max, p) => Math.max(max, p.display_order || 0), 0);
  return selected.map((item, index) => ({
    campaign_id: campaignId,
    tipo_id: subId ? null : tipoId,
    subdivisao_id: subId,
    nome: item.nome.trim(),
    image_url: item.image_url,
    display_order: base + index + 1,
  }));
}