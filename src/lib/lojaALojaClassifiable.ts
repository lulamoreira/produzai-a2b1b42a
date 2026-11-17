import { hasLogistics, normalizeDeliveryType } from "@/lib/deliveryType";

/**
 * Lojas que aparecem na Classificação do Loja a Loja: todas que recebem peças
 * fisicamente (Frete + Instalação, Só frete ou Só instalação). "Sem logística"
 * fica de fora. Lojas sem tipo definido seguem o padrão do cadastro (frete +
 * instalação). Dentro de uma campanha, passe o tipo EFETIVO (ajuste ?? padrão).
 */
export type TipoEntrega = string | null | undefined;

export function isClassifiableStore(tipoEntrega: TipoEntrega): boolean {
  return hasLogistics(normalizeDeliveryType(tipoEntrega));
}
