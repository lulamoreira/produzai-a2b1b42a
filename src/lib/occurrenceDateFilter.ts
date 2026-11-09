/**
 * Filtro por data de abertura de ocorrências (dia local, limites inclusivos).
 *
 * - `from`: inclui ocorrências abertas a partir do início (00:00) desse dia.
 * - `to`: inclui ocorrências abertas até o fim (23:59:59.999) desse dia.
 * - Sem limites → sempre verdadeiro. Data de abertura inválida/ausente com
 *   algum limite ativo → excluída (não dá para afirmar que está no período).
 */
export function isOpenedWithinRange(
  createdAt: string | null | undefined,
  from?: Date,
  to?: Date,
): boolean {
  if (!from && !to) return true;
  if (!createdAt) return false;
  const opened = new Date(createdAt).getTime();
  if (Number.isNaN(opened)) return false;

  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (opened < start.getTime()) return false;
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (opened > end.getTime()) return false;
  }
  return true;
}
