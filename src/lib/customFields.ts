/**
 * Maximum number of custom fields per client.
 * Currently 15 (schema has custom_field_1..15 + custom_field_1..15_label).
 * To expand: add DB columns + change this constant.
 */
export const MAX_CUSTOM_FIELDS = 20;

export const customFieldIndices = (): number[] =>
  Array.from({ length: MAX_CUSTOM_FIELDS }, (_, i) => i + 1);

export const customFieldLabelKey = (i: number) => `custom_field_${i}_label` as const;
export const customFieldValueKey = (i: number) => `custom_field_${i}` as const;

/**
 * Interpreta o valor salvo de um campo personalizado do tipo Sim/Não.
 * Valores vindos de planilhas chegam como "TRUE", "True", "Sim", "1" etc.;
 * a leitura é tolerante a maiúsculas/acentos para que nenhuma loja marcada
 * apareça como "Não". A gravação continua sempre em "true"/"false".
 */
const TRUTHY_BOOLEAN_VALUES = new Set(["true", "sim", "s", "yes", "y", "1", "x", "verdadeiro"]);

export const isCustomFieldTrue = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === null || value === undefined || value === false) return false;
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return TRUTHY_BOOLEAN_VALUES.has(normalized);
};
