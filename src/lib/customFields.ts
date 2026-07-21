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
