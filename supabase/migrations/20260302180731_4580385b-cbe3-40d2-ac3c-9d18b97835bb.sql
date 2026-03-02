
-- Capitalize existing store data (INITCAP on text fields, excluding state, store_model)
UPDATE public.client_stores SET
  name = INITCAP(name),
  nickname = INITCAP(nickname),
  street = INITCAP(street),
  complement = INITCAP(complement),
  neighborhood = INITCAP(neighborhood),
  city = INITCAP(city),
  manager_name = INITCAP(manager_name),
  country = INITCAP(country),
  observations = INITCAP(observations),
  custom_field_1 = INITCAP(custom_field_1),
  custom_field_2 = INITCAP(custom_field_2),
  custom_field_3 = INITCAP(custom_field_3),
  custom_field_4 = INITCAP(custom_field_4),
  custom_field_5 = INITCAP(custom_field_5)
WHERE name IS NOT NULL;
