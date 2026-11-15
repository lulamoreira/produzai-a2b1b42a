/**
 * Limpa textos de AGRUPAMENTO (categoria, subgrupo, kit, modelo de loja) vindos
 * de planilhas, para que variações de escrita não criem grupos duplicados.
 *
 * Regras:
 * - NBSP e caracteres invisíveis ( , ​-‍, ﻿) viram espaço comum;
 * - espaços repetidos colapsam em um só; trim nas pontas;
 * - aspas tipográficas (“ ” „ ‘ ’) viram aspas retas;
 * - se o valor INTEIRO estiver cercado por um par de aspas, remove só esse par externo.
 *
 * Não altera maiúsculas/minúsculas. NÃO usar no nome da peça (nomes reais
 * contêm aspas internas, ex.: Shelftalk "Lisa" - Wallbay).
 */

/** Caracteres invisíveis que devem se comportar como espaço: NBSP, ZWSP-ZWJ, BOM. */
const INVISIBLE_RE = /[ ​-‍﻿]/g;

/** Aspas tipográficas → aspas retas. */
const CURLY_QUOTES_RE = /[“”„‘’]/g;

const STRAIGHT_DOUBLE = '"';

/** Converte aspas tipográficas em retas, preservando apóstrofos retos. */
function straightenQuotes(value: string): string {
  return value.replace(CURLY_QUOTES_RE, (ch) => (ch === "‘" || ch === "’" ? "'" : STRAIGHT_DOUBLE));
}

/** Remove o par de aspas externo somente quando ele cerca o valor inteiro. */
function stripOuterQuotePair(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  const isDouble = first === STRAIGHT_DOUBLE && last === STRAIGHT_DOUBLE;
  const isSingle = first === "'" && last === "'";
  if (!isDouble && !isSingle) return value;
  const inner = value.slice(1, -1);
  // O par externo só é removido se não houver outra aspa do mesmo tipo dentro.
  if (inner.includes(first)) return value;
  return inner;
}

export function cleanGroupText(value: string): string {
  if (!value) return "";
  let out = String(value).replace(INVISIBLE_RE, " ");
  out = straightenQuotes(out);
  out = out.replace(/ +/g, " ").trim();
  out = stripOuterQuotePair(out);
  return out.trim();
}
