-- Permite leitura anônima de tokens do portal de ocorrências (necessário para a listagem pública de lojas)
CREATE POLICY "Anon read store portal tokens for public occurrence portal"
ON public.store_portal_tokens
FOR SELECT
TO anon
USING (token IS NOT NULL);