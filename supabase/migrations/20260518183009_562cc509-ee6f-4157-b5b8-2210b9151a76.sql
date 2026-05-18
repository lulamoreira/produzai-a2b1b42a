-- Uppercase existing data
UPDATE public.client_stores SET
  custom_field_1  = UPPER(custom_field_1),
  custom_field_2  = UPPER(custom_field_2),
  custom_field_3  = UPPER(custom_field_3),
  custom_field_4  = UPPER(custom_field_4),
  custom_field_5  = UPPER(custom_field_5),
  custom_field_6  = UPPER(custom_field_6),
  custom_field_7  = UPPER(custom_field_7),
  custom_field_8  = UPPER(custom_field_8),
  custom_field_9  = UPPER(custom_field_9),
  custom_field_10 = UPPER(custom_field_10),
  custom_field_11 = UPPER(custom_field_11),
  custom_field_12 = UPPER(custom_field_12),
  custom_field_13 = UPPER(custom_field_13),
  custom_field_14 = UPPER(custom_field_14),
  custom_field_15 = UPPER(custom_field_15)
WHERE
  custom_field_1  IS DISTINCT FROM UPPER(custom_field_1)  OR
  custom_field_2  IS DISTINCT FROM UPPER(custom_field_2)  OR
  custom_field_3  IS DISTINCT FROM UPPER(custom_field_3)  OR
  custom_field_4  IS DISTINCT FROM UPPER(custom_field_4)  OR
  custom_field_5  IS DISTINCT FROM UPPER(custom_field_5)  OR
  custom_field_6  IS DISTINCT FROM UPPER(custom_field_6)  OR
  custom_field_7  IS DISTINCT FROM UPPER(custom_field_7)  OR
  custom_field_8  IS DISTINCT FROM UPPER(custom_field_8)  OR
  custom_field_9  IS DISTINCT FROM UPPER(custom_field_9)  OR
  custom_field_10 IS DISTINCT FROM UPPER(custom_field_10) OR
  custom_field_11 IS DISTINCT FROM UPPER(custom_field_11) OR
  custom_field_12 IS DISTINCT FROM UPPER(custom_field_12) OR
  custom_field_13 IS DISTINCT FROM UPPER(custom_field_13) OR
  custom_field_14 IS DISTINCT FROM UPPER(custom_field_14) OR
  custom_field_15 IS DISTINCT FROM UPPER(custom_field_15);

-- Trigger function to uppercase on insert/update
CREATE OR REPLACE FUNCTION public.uppercase_client_store_custom_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.custom_field_1  := UPPER(NEW.custom_field_1);
  NEW.custom_field_2  := UPPER(NEW.custom_field_2);
  NEW.custom_field_3  := UPPER(NEW.custom_field_3);
  NEW.custom_field_4  := UPPER(NEW.custom_field_4);
  NEW.custom_field_5  := UPPER(NEW.custom_field_5);
  NEW.custom_field_6  := UPPER(NEW.custom_field_6);
  NEW.custom_field_7  := UPPER(NEW.custom_field_7);
  NEW.custom_field_8  := UPPER(NEW.custom_field_8);
  NEW.custom_field_9  := UPPER(NEW.custom_field_9);
  NEW.custom_field_10 := UPPER(NEW.custom_field_10);
  NEW.custom_field_11 := UPPER(NEW.custom_field_11);
  NEW.custom_field_12 := UPPER(NEW.custom_field_12);
  NEW.custom_field_13 := UPPER(NEW.custom_field_13);
  NEW.custom_field_14 := UPPER(NEW.custom_field_14);
  NEW.custom_field_15 := UPPER(NEW.custom_field_15);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uppercase_client_store_custom_fields ON public.client_stores;
CREATE TRIGGER trg_uppercase_client_store_custom_fields
  BEFORE INSERT OR UPDATE ON public.client_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_client_store_custom_fields();