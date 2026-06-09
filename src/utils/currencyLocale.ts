export type CurrencyLocale = "pt-BR" | "es-CL";

export function getLocaleFromCurrency(currency?: string): CurrencyLocale {
  return currency === "CLP" ? "es-CL" : "pt-BR";
}

export const supplierQuoteLabels = {
  "pt-BR": {
    fillTitle: "Preenchimento do fornecedor",
    partialTotal: "Total parcial (em preenchimento)",
    onlyWithoutPrice: "APENAS SEM PREÇO",
    columnItem: "Peça",
    columnQty: "Qtd",
    columnUnitPrice: "Preço Unit.",
    columnTotal: "Total",
    noPrice: "Sem preço",
    submitQuote: "Enviar cotação",
    saveQuote: "Salvar rascunho",
    confirmSend: "Confirmar envio",
    cancelBtn: "Cancelar",
    successMsg: "Cotação enviada com sucesso!",
    errorRequired: "Preencha todos os preços obrigatórios.",
  },
  "es-CL": {
    fillTitle: "Cotización del proveedor",
    partialTotal: "Total parcial (en cotización)",
    onlyWithoutPrice: "SOLO SIN PRECIO",
    columnItem: "Ítem",
    columnQty: "Ctd",
    columnUnitPrice: "Precio Unit.",
    columnTotal: "Total",
    noPrice: "Sin precio",
    submitQuote: "Enviar cotización",
    saveQuote: "Guardar borrador",
    confirmSend: "Confirmar envío",
    cancelBtn: "Cancelar",
    successMsg: "¡Cotización enviada con éxito!",
    errorRequired: "Complete todos los precios requeridos.",
  },
} as const;

export function getSupplierLabels(currency?: string) {
  const locale = getLocaleFromCurrency(currency);
  return supplierQuoteLabels[locale];
}
