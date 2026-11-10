/**
 * Lojas que aparecem na Classificação do Loja a Loja: todas que recebem peças
 * fisicamente (com instalação ou só frete). "Sem logística" fica de fora.
 * Lojas sem tipo definido seguem o padrão do cadastro (frete + instalação).
 */
export type TipoEntrega = "frete_instalacao" | "frete_apenas" | "sem_logistica" | string | null | undefined;

export function isClassifiableStore(tipoEntrega: TipoEntrega): boolean {
  const tipo = tipoEntrega ?? "frete_instalacao";
  return tipo === "frete_instalacao" || tipo === "frete_apenas";
}
