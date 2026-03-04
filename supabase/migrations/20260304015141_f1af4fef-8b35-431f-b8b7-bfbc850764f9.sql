CREATE POLICY "Editors can update kit pieces" 
ON public.campaign_kit_pieces
FOR UPDATE
USING (EXISTS (
  SELECT 1
  FROM campaign_kits ck
  JOIN campaigns c ON c.id = ck.campaign_id
  WHERE ck.id = campaign_kit_pieces.kit_id
  AND has_category_permission(auth.uid(), c.client_id, 'edit_pieces'::text)
));