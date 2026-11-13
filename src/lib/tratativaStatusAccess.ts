/**
 * Regras de acesso por Status da Tratativa (Loja a Loja).
 *
 * - admin_only = true  → o status só é oferecido para ADM/Master.
 * - fallback_status    → quando um usuário que NÃO é ADM/Master salva com este
 *                        status, grava-se o status de encaminhamento no lugar.
 *
 * Funções puras para que a tela de detalhe e os testes usem a mesma regra.
 */
export interface TratativaAccessFields {
  value: string;
  admin_only?: boolean | null;
  fallback_status?: string | null;
}

/** Status que o usuário pode escolher na lista. */
export function visibleTratativaStatuses<T extends TratativaAccessFields>(
  statuses: readonly T[],
  isAdminOrMaster: boolean,
): T[] {
  return isAdminOrMaster ? [...statuses] : statuses.filter((s) => !s.admin_only);
}

/** Status efetivamente gravado ao salvar. */
export function resolveEffectiveTratativaStatus(
  statuses: readonly TratativaAccessFields[],
  chosenValue: string,
  isAdminOrMaster: boolean,
): string {
  if (isAdminOrMaster) return chosenValue;
  const chosen = statuses.find((s) => s.value === chosenValue);
  const fallback = chosen?.fallback_status?.trim();
  return fallback ? fallback : chosenValue;
}

export type TratativaAccessMode = "open" | "admin" | `redirect:${string}`;

/** Valor do seletor "Quem pode usar este status". */
export function tratativaAccessMode(s: TratativaAccessFields): TratativaAccessMode {
  if (s.fallback_status) return `redirect:${s.fallback_status}`;
  if (s.admin_only) return "admin";
  return "open";
}

/** Converte a opção do seletor no que é gravado no status. */
export function tratativaAccessPatch(mode: string): { admin_only: boolean; fallback_status: string | null } {
  if (mode === "admin") return { admin_only: true, fallback_status: null };
  if (mode.startsWith("redirect:")) {
    const target = mode.slice("redirect:".length).trim();
    return { admin_only: false, fallback_status: target || null };
  }
  return { admin_only: false, fallback_status: null };
}
