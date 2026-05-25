-- Campos de valor nas peças (nullable — campanhas existentes ficam intactas)
ALTER TABLE campaign_pieces
  ADD COLUMN IF NOT EXISTS custom_field_1 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_field_2 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_field_3 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_field_4 TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_field_5 TEXT DEFAULT NULL;

-- Labels dos campos (configurados por campanha, não globais)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS piece_custom_field_1_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS piece_custom_field_2_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS piece_custom_field_3_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS piece_custom_field_4_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS piece_custom_field_5_label TEXT DEFAULT NULL;