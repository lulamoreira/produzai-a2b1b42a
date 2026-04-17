-- 1. Add 15 sub-area columns
ALTER TABLE permission_categories
  ADD COLUMN IF NOT EXISTS can_view_lal_estrutura boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_lal_estrutura boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_lal_estrutura boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_lal_classificacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_lal_classificacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_lal_classificacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_lal_acessos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_lal_acessos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_lal_acessos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_lal_config boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_lal_config boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_lal_config boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_lal_ocorrencias boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_lal_ocorrencias boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete_lal_ocorrencias boolean NOT NULL DEFAULT false;

-- 2. Add general delete flag
ALTER TABLE permission_categories
  ADD COLUMN IF NOT EXISTS can_delete_loja_a_loja boolean NOT NULL DEFAULT false;

-- 3. Migrate existing data
UPDATE permission_categories SET
  can_view_lal_estrutura = can_view_loja_a_loja,
  can_edit_lal_estrutura = can_edit_loja_a_loja,
  can_view_lal_classificacao = can_view_loja_a_loja,
  can_edit_lal_classificacao = can_edit_loja_a_loja,
  can_view_lal_acessos = can_view_loja_a_loja,
  can_edit_lal_acessos = can_edit_loja_a_loja,
  can_view_lal_config = can_view_loja_a_loja,
  can_edit_lal_config = can_edit_loja_a_loja,
  can_view_lal_ocorrencias = can_view_loja_a_loja,
  can_edit_lal_ocorrencias = can_edit_loja_a_loja;

-- 4. RLS updates - 4 core tables

-- loja_a_loja_tipos (campaign_id direct)
DROP POLICY IF EXISTS "Admin full access on loja_a_loja_tipos" ON loja_a_loja_tipos;
DROP POLICY IF EXISTS "admin_all" ON loja_a_loja_tipos;
DROP POLICY IF EXISTS "users_select" ON loja_a_loja_tipos;
CREATE POLICY "admin_all" ON loja_a_loja_tipos FOR ALL TO authenticated
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));
CREATE POLICY "users_select" ON loja_a_loja_tipos FOR SELECT TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));

-- loja_a_loja_subdivisoes (no campaign_id; join via tipo_id)
DROP POLICY IF EXISTS "Admin full access on loja_a_loja_subdivisoes" ON loja_a_loja_subdivisoes;
DROP POLICY IF EXISTS "admin_all" ON loja_a_loja_subdivisoes;
DROP POLICY IF EXISTS "users_select" ON loja_a_loja_subdivisoes;
CREATE POLICY "admin_all" ON loja_a_loja_subdivisoes FOR ALL TO authenticated
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));
CREATE POLICY "users_select" ON loja_a_loja_subdivisoes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM loja_a_loja_tipos t
    WHERE t.id = loja_a_loja_subdivisoes.tipo_id
      AND has_campaign_access(auth.uid(), t.campaign_id)
  ));

-- loja_a_loja_pecas (campaign_id direct)
DROP POLICY IF EXISTS "Admin full access on loja_a_loja_pecas" ON loja_a_loja_pecas;
DROP POLICY IF EXISTS "admin_all" ON loja_a_loja_pecas;
DROP POLICY IF EXISTS "users_select" ON loja_a_loja_pecas;
CREATE POLICY "admin_all" ON loja_a_loja_pecas FOR ALL TO authenticated
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));
CREATE POLICY "users_select" ON loja_a_loja_pecas FOR SELECT TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));

-- loja_a_loja_lojas (campaign_id direct)
DROP POLICY IF EXISTS "Admin full access on loja_a_loja_lojas" ON loja_a_loja_lojas;
DROP POLICY IF EXISTS "admin_all" ON loja_a_loja_lojas;
DROP POLICY IF EXISTS "users_select" ON loja_a_loja_lojas;
CREATE POLICY "admin_all" ON loja_a_loja_lojas FOR ALL TO authenticated
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));
CREATE POLICY "users_select" ON loja_a_loja_lojas FOR SELECT TO authenticated
  USING (has_campaign_access(auth.uid(), campaign_id));