ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS custom_field_16_label text,
  ADD COLUMN IF NOT EXISTS custom_field_17_label text,
  ADD COLUMN IF NOT EXISTS custom_field_18_label text,
  ADD COLUMN IF NOT EXISTS custom_field_19_label text,
  ADD COLUMN IF NOT EXISTS custom_field_20_label text;

ALTER TABLE public.client_stores
  ADD COLUMN IF NOT EXISTS custom_field_16 text,
  ADD COLUMN IF NOT EXISTS custom_field_17 text,
  ADD COLUMN IF NOT EXISTS custom_field_18 text,
  ADD COLUMN IF NOT EXISTS custom_field_19 text,
  ADD COLUMN IF NOT EXISTS custom_field_20 text;

ALTER TABLE public.client_custom_field_config
  DROP CONSTRAINT IF EXISTS client_custom_field_config_field_index_check;
ALTER TABLE public.client_custom_field_config
  ADD CONSTRAINT client_custom_field_config_field_index_check
  CHECK (field_index BETWEEN 1 AND 20);