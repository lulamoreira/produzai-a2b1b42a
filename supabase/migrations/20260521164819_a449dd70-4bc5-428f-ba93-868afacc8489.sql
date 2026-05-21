-- Create policy to allow anonymous users to view campaign stores (required for Occurrences Portal)
CREATE POLICY "Anon can view campaign stores" 
ON public.loja_a_loja_lojas 
FOR SELECT 
TO anon 
USING (ativo = true);

-- Also ensure we have a policy for subdivisoes and tipos if we need them, 
-- though OccurrencesPortal doesn't seem to use them yet.
CREATE POLICY "Anon can view campaign tipos" 
ON public.loja_a_loja_tipos 
FOR SELECT 
TO anon 
USING (is_deleted = false);
