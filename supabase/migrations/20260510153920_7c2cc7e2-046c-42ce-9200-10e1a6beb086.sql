
ALTER TABLE permission_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE permission_categories ADD COLUMN IF NOT EXISTS color text DEFAULT 'amber';
ALTER TABLE permission_categories ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;
ALTER TABLE permission_categories ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES permission_categories(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  action text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(category_id, module_key, action)
);

CREATE INDEX IF NOT EXISTS idx_permission_grants_lookup
  ON permission_grants(category_id, module_key, action);

ALTER TABLE permission_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Master can manage permission grants" ON permission_grants;
CREATE POLICY "Admin/Master can manage permission grants"
  ON permission_grants FOR ALL TO authenticated
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "All authenticated can read grants" ON permission_grants;
CREATE POLICY "All authenticated can read grants"
  ON permission_grants FOR SELECT TO authenticated
  USING (true);

UPDATE permission_categories SET is_system = true WHERE name IN ('Admin', 'Master');

UPDATE permission_categories SET color = CASE
  WHEN name = 'Admin' THEN 'purple'
  WHEN name = 'Master' THEN 'amber'
  WHEN name = 'Cliente' THEN 'blue'
  WHEN name = 'Editor' THEN 'orange'
  WHEN name = 'Visualizador' THEN 'gray'
  WHEN name ILIKE '%Instala%' THEN 'green'
  WHEN name ILIKE '%Tratativa%' THEN 'red'
  ELSE 'gray'
END WHERE color IS NULL OR color = 'amber';

CREATE OR REPLACE FUNCTION backfill_permission_grants() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cat RECORD;
BEGIN
  FOR cat IN SELECT * FROM permission_categories LOOP
    IF cat.can_view_clients THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'clients', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_clients THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'clients', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_clients THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'clients', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_campaigns THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'campaigns', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_campaigns THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'campaigns', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_campaigns THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'campaigns', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_stores THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'stores', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_stores THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'stores', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_stores THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'stores', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_campaign_stores THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'campaign_stores', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_campaign_stores THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'campaign_stores', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_campaign_stores THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'campaign_stores', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_pieces THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'pieces', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_pieces THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'pieces', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_pieces THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'pieces', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_occurrences THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'occurrences', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_occurrences THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'occurrences', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_occurrences THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'occurrences', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_schedules THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'schedules', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_schedules THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'schedules', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_schedules THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'schedules', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_installations THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'installations', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_installations THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'installations', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_installations THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'installations', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_loja_a_loja THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_loja_a_loja THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_loja_a_loja THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_lal_estrutura THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.estrutura', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_lal_estrutura THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.estrutura', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_lal_estrutura THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.estrutura', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_lal_classificacao THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.classificacao', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_lal_classificacao THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.classificacao', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_lal_classificacao THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.classificacao', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_lal_acessos THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.acessos', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_lal_acessos THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.acessos', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_lal_acessos THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.acessos', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_lal_config THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.config', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_lal_config THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.config', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_lal_config THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.config', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_lal_ocorrencias THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.ocorrencias', 'view') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_lal_ocorrencias THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.ocorrencias', 'edit') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_delete_lal_ocorrencias THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'loja_a_loja.ocorrencias', 'delete') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_edit_reporter_data THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'occurrences', 'special:reporter_data') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_manage_team_codes THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'installations', 'special:team_codes') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_lock_cards THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'occurrences', 'special:lock_cards') ON CONFLICT DO NOTHING; END IF;
    IF cat.can_view_photo_checkin THEN INSERT INTO permission_grants(category_id, module_key, action) VALUES (cat.id, 'installations', 'special:photo_checkin') ON CONFLICT DO NOTHING; END IF;
  END LOOP;
END;
$$;

SELECT backfill_permission_grants();
DROP FUNCTION backfill_permission_grants();

CREATE OR REPLACE FUNCTION has_module_permission(
  _user_id uuid,
  _category_id uuid,
  _module_key text,
  _action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM permission_grants
    WHERE category_id = _category_id
      AND module_key = _module_key
      AND action = _action
      AND granted = true
  );
$$;
