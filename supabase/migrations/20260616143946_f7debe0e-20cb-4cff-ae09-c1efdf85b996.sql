-- Split pieces shared by multiple kits in the same campaign so each kit owns its own pieces.
DO $$
DECLARE
  rec RECORD;
  new_piece_id uuid;
  new_code int;
BEGIN
  -- For every (kit, piece) link where the piece is referenced by more than one kit in the same campaign,
  -- keep the link of the first kit (by created_at) untouched and clone the piece for every additional kit.
  FOR rec IN
    SELECT kp.kit_id, kp.piece_id, kp.quantity, p.* ,
           k.campaign_id,
           row_number() OVER (PARTITION BY kp.piece_id ORDER BY k.created_at, k.id) AS rn
    FROM public.campaign_kit_pieces kp
    JOIN public.campaign_kits k ON k.id = kp.kit_id
    JOIN public.campaign_pieces p ON p.id = kp.piece_id
    WHERE kp.piece_id IN (
      SELECT piece_id FROM public.campaign_kit_pieces GROUP BY piece_id HAVING count(DISTINCT kit_id) > 1
    )
    ORDER BY p.id, k.created_at, k.id
  LOOP
    IF rec.rn = 1 THEN
      CONTINUE; -- first kit keeps the original piece
    END IF;

    SELECT COALESCE(MAX(code), 0) + 1 INTO new_code
    FROM public.campaign_pieces WHERE campaign_id = rec.campaign_id;

    INSERT INTO public.campaign_pieces (
      campaign_id, code, category, name, size, store_category, sub_location,
      specification, installation_instructions, kit_only, is_mockup,
      display_order, image_url, image_thumb_url, image_full_url, image_report_url,
      custom_field_1, custom_field_2, custom_field_3, custom_field_4, custom_field_5,
      is_deleted, is_new
    )
    VALUES (
      rec.campaign_id, new_code, rec.category, rec.name || ' (cópia)', rec.size, rec.store_category, rec.sub_location,
      rec.specification, rec.installation_instructions, COALESCE(rec.kit_only, true), COALESCE(rec.is_mockup, false),
      rec.display_order, rec.image_url, rec.image_thumb_url, rec.image_full_url, rec.image_report_url,
      rec.custom_field_1, rec.custom_field_2, rec.custom_field_3, rec.custom_field_4, rec.custom_field_5,
      false, COALESCE(rec.is_new, false)
    )
    RETURNING id INTO new_piece_id;

    UPDATE public.campaign_kit_pieces
       SET piece_id = new_piece_id
     WHERE kit_id = rec.kit_id AND piece_id = rec.piece_id;
  END LOOP;
END $$;