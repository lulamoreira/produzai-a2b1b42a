import type { LojaALojaTipo, LojaALojaPeca } from "@/hooks/useLojaALoja";

export interface CopyPieceItem {
  id: string;
  nome: string;
  image_url: string | null;
  checked: boolean;
}

export function copyPieceSources(tipos: LojaALojaTipo[], pieces: LojaALojaPeca[], tipoId: string | null, subId: string | null) {
  return tipos.flatMap(tipo => subId
    ? (tipo.subdivisoes ?? []).filter(sub => sub.id !== subId && pieces.some(p => p.subdivisao_id === sub.id))
      .map(sub => ({ id: sub.id, label: `${tipo.letra} — ${tipo.nome} — ${sub.nome}` }))
    : !tipo.tem_subdivisao && tipo.id !== tipoId && pieces.some(p => p.tipo_id === tipo.id && !p.subdivisao_id)
      ? [{ id: tipo.id, label: `${tipo.letra} — ${tipo.nome}` }] : []);
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