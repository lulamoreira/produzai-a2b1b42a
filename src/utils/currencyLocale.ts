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

export const supplierMessageLabels = {
  "pt-BR": {
    inviteSubject: "Convite para Cotação",
    inviteGreeting: "Olá",
    inviteIntro: "convidou",
    inviteAction: "para participar do processo de cotação da campanha",
    inviteLinkText: "Para acessar a planilha e preencher seus preços, acesse o link abaixo:",
    inviteDeadline: "Prazo para envio",
    inviteMaterials: "Material de apoio para download",
    inviteInstructionsTitle: "Instruções:",
    inviteInstructions: [
      "Acesse o link acima",
      "Preencha o preço unitário de cada peça",
      "Informe os valores de instalação e embalagem / frete",
      "Clique em ENVIAR quando concluir"
    ],
    inviteFooter: "Dúvidas? Entre em contato conosco.",
    inviteTimelineTitle: "CRONOGRAMA DA CAMPANHA",
    inviteTimelineAcceptance: "ATENÇÃO: Ao preencher e enviar a cotação, você confirma o aceite deste cronograma.",
    negotiationSubject: "Solicitação de Ajuste de Proposta",
    negotiationIntro: "Gostaríamos de solicitar um ajuste na sua proposta para a campanha",
    negotiationCurrentTotal: "Total atual",
    negotiationTarget: "Teto máximo desejado",
    negotiationAction: "Por favor, acesse o portal para revisar os preços:",
    negotiationFooter: "Você só conseguirá enviar a proposta ajustada se o total estiver dentro do teto definido.\n\nObrigado!",
    winnerSubject: "Links de produção (peças aprovadas)",
    winnerIntro: "Conforme alinhado, segue abaixo o material aprovado da campanha",
    winnerIntroProduction: "para iniciarmos a produção:",
    winnerMockupTitle: "Peças fechadas (mockup)",
    winnerBookTitle: "Book de mockup",
    winnerFooter: "Qual qualquer dúvida sobre arquivos, formatos ou cronograma, estamos à disposição.",
    winnerRegards: "Atenciosamente",
    winnerWaIntro: "Reenviando os links de produção da campanha",
    winnerWaFooter: "Qualquer dúvida, estamos à disposição."
  },
  "es-CL": {
    inviteSubject: "Invitación a Cotizar",
    inviteGreeting: "Hola",
    inviteIntro: "ha invitado a",
    inviteAction: "a participar en el proceso de cotización de la campaña",
    inviteLinkText: "Para acceder a la planilha y completar sus precios, ingrese al siguiente link:",
    inviteDeadline: "Plazo de envío",
    inviteMaterials: "Material de apoyo para descargar",
    inviteInstructionsTitle: "Instrucciones:",
    inviteInstructions: [
      "Ingrese al link de arriba",
      "Complete el precio unitario de cada ítem",
      "Informe los valores de instalación y embalaje / flete",
      "Haga clic en ENVIAR al terminar"
    ],
    inviteFooter: "¿Dudas? Póngase en contacto con nosotros.",
    inviteTimelineTitle: "CRONOGRAMA DE LA CAMPAÑA",
    inviteTimelineAcceptance: "ATENCIÓN: Al completar y enviar la cotización, usted confirma la aceptación de este cronograma.",
    negotiationSubject: "Solicitud de Ajuste de Propuesta",
    negotiationIntro: "Nos gustaría solicitar un ajuste en su propuesta para la campaña",
    negotiationCurrentTotal: "Total actual",
    negotiationTarget: "Techo máximo deseado",
    negotiationAction: "Por favor, acceda al portal para revisar los precios:",
    negotiationFooter: "Solo podrá enviar la propuesta ajustada si el total está dentro del techo definido.\n\n¡Gracias!",
    negotiationRegards: "Atentamente",
    winnerSubject: "Links de producción (ítems aprovados)",
    winnerIntro: "Según lo acordado, adjuntamos el material aprobado de la campaña",
    winnerIntroProduction: "para iniciar la producción:",
    winnerMockupTitle: "Piezas finales (mockup)",
    winnerBookTitle: "Book de mockup",
    winnerFooter: "Cualquier duda sobre archivos, formatos o cronograma, estamos a su disposición.",
    winnerRegards: "Atentamente",
    winnerWaIntro: "Reenviando los links de producción de la campaña",
    winnerWaFooter: "Cualquier duda, estamos a su disposición."
  }
} as const;

export function getMessageLabels(currency?: string) {
  const locale = getLocaleFromCurrency(currency);
  return supplierMessageLabels[locale];
}

export const supplierPortalLabels = {
  "pt-BR": {
    greeting: (name: string) => `Olá, ${name}! 👋`,
    inviteText: (campaign: string, client: string) =>
      `Você foi convidado(a) a participar do processo de cotação da campanha <strong>${campaign}</strong>${client ? ` do cliente ${client}` : ""}.`,
    instructionPrice: `Preencha o <strong>preço unitário</strong> de cada peça abaixo. O total por peça será calculado automaticamente (preço unitário × quantidade total).`,
    instructionExtras: `Ao final, informe os valores de <strong>instalação</strong> e <strong>embalagem / frete / despacho</strong>, se aplicáveis.`,
    instructionSend: `Quando tudo estiver pronto, clique em <strong>ENVIAR ORÇAMENTO</strong>. Atenção: após o envio, os valores ficam <strong>bloqueados</strong> e não poderão ser alterados.`,
    deadlineLabel: "📅 Prazo para envio:",
    scheduleTitle: "📅 Cronograma da Campanha",
    scheduleSubtitle: "Datas e entregas acordadas para esta campanha",
    submitButton: "ENVIAR ORÇAMENTO",
    waitingStatus: "Aguardando",
    valuesIn: "Valores em",
    daysLeft: (n: number) => `${n} dia${n !== 1 ? "s" : ""} restante${n !== 1 ? "s" : ""}`,
    scheduleAcceptance: "Ao enviar esta cotação, você confirma o aceite do cronograma acima.",
  },
  "es-CL": {
    greeting: (name: string) => `¡Hola, ${name}! 👋`,
    inviteText: (campaign: string, client: string) =>
      `Has sido invitado/a a participar del proceso de cotización de la campaña <strong>${campaign}</strong>${client ? ` del cliente ${client}` : ""}.`,
    instructionPrice: `Completa el <strong>precio unitario</strong> de cada ítem a continuación. El total por ítem se calculará automáticamente (precio unitario × cantidad total).`,
    instructionExtras: `Al finalizar, ingresa los valores de <strong>instalación</strong> y <strong>embalaje / flete / despacho</strong>, si aplica.`,
    instructionSend: `Cuando todo esté listo, haz clic en <strong>ENVIAR COTIZACIÓN</strong>. Atención: una vez enviados, los valores quedan <strong>bloqueados</strong> y no podrán modificarse.`,
    deadlineLabel: "📅 Plazo de envío:",
    scheduleTitle: "📅 Cronograma de la Campaña",
    scheduleSubtitle: "Fechas y entregas acordadas para esta campaña",
    submitButton: "ENVIAR COTIZACIÓN",
    waitingStatus: "Esperando",
    valuesIn: "Valores en",
    daysLeft: (n: number) => `${n} día${n !== 1 ? "s" : ""} restante${n !== 1 ? "s" : ""}`,
    scheduleAcceptance: "Al enviar esta cotización, usted confirma la aceptación de este cronograma.",
  },
} as const;

export function getSupplierPortalLabels(currency?: string) {
  const locale = getLocaleFromCurrency(currency);
  return supplierPortalLabels[locale];
}