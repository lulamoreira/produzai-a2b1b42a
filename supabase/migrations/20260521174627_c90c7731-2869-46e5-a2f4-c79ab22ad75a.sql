-- Update existing records in client_stores
UPDATE public.client_stores
SET 
  city = UPPER(city),
  state = UPPER(state),
  cnpj = UPPER(cnpj),
  state_registration = UPPER(state_registration),
  zip_code = UPPER(zip_code),
  street = UPPER(street),
  number = UPPER(number),
  complement = UPPER(complement),
  neighborhood = UPPER(neighborhood),
  phone = UPPER(phone),
  manager_name = UPPER(manager_name),
  store_model = UPPER(store_model),
  country = UPPER(country),
  store_code = UPPER(store_code),
  observations = UPPER(observations),
  email = UPPER(email),
  custom_field_1 = UPPER(custom_field_1),
  custom_field_2 = UPPER(custom_field_2),
  custom_field_3 = UPPER(custom_field_3),
  custom_field_4 = UPPER(custom_field_4),
  custom_field_5 = UPPER(custom_field_5),
  custom_field_6 = UPPER(custom_field_6),
  custom_field_7 = UPPER(custom_field_7),
  custom_field_8 = UPPER(custom_field_8),
  custom_field_9 = UPPER(custom_field_9),
  custom_field_10 = UPPER(custom_field_10),
  custom_field_11 = UPPER(custom_field_11),
  custom_field_12 = UPPER(custom_field_12),
  custom_field_13 = UPPER(custom_field_13),
  custom_field_14 = UPPER(custom_field_14),
  custom_field_15 = UPPER(custom_field_15);

-- Update the trigger function for client_stores
CREATE OR REPLACE FUNCTION public.uppercase_client_store_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.city               := UPPER(NEW.city);
  NEW.state              := UPPER(NEW.state);
  NEW.cnpj               := UPPER(NEW.cnpj);
  NEW.state_registration := UPPER(NEW.state_registration);
  NEW.zip_code           := UPPER(NEW.zip_code);
  NEW.street             := UPPER(NEW.street);
  NEW.number             := UPPER(NEW.number);
  NEW.complement         := UPPER(NEW.complement);
  NEW.neighborhood       := UPPER(NEW.neighborhood);
  NEW.phone              := UPPER(NEW.phone);
  NEW.manager_name       := UPPER(NEW.manager_name);
  NEW.store_model        := UPPER(NEW.store_model);
  NEW.country            := UPPER(NEW.country);
  NEW.store_code         := UPPER(NEW.store_code);
  NEW.observations       := UPPER(NEW.observations);
  NEW.email              := UPPER(NEW.email);
  NEW.custom_field_1     := UPPER(NEW.custom_field_1);
  NEW.custom_field_2     := UPPER(NEW.custom_field_2);
  NEW.custom_field_3     := UPPER(NEW.custom_field_3);
  NEW.custom_field_4     := UPPER(NEW.custom_field_4);
  NEW.custom_field_5     := UPPER(NEW.custom_field_5);
  NEW.custom_field_6     := UPPER(NEW.custom_field_6);
  NEW.custom_field_7     := UPPER(NEW.custom_field_7);
  NEW.custom_field_8     := UPPER(NEW.custom_field_8);
  NEW.custom_field_9     := UPPER(NEW.custom_field_9);
  NEW.custom_field_10    := UPPER(NEW.custom_field_10);
  NEW.custom_field_11    := UPPER(NEW.custom_field_11);
  NEW.custom_field_12    := UPPER(NEW.custom_field_12);
  NEW.custom_field_13    := UPPER(NEW.custom_field_13);
  NEW.custom_field_14    := UPPER(NEW.custom_field_14);
  NEW.custom_field_15    := UPPER(NEW.custom_field_15);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop the old trigger if it exists and create the new one
DROP TRIGGER IF EXISTS trg_uppercase_client_store_custom_fields ON public.client_stores;
CREATE TRIGGER trg_uppercase_client_store_fields
BEFORE INSERT OR UPDATE ON public.client_stores
FOR EACH ROW EXECUTE FUNCTION public.uppercase_client_store_fields();

-- Update existing records in stores table
UPDATE public.stores
SET 
  uf = UPPER(uf),
  type = UPPER(type),
  model = UPPER(model),
  primary_mod = UPPER(primary_mod),
  secondary_mod = UPPER(secondary_mod);

-- Create trigger function for stores table
CREATE OR REPLACE FUNCTION public.uppercase_store_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.uf            := UPPER(NEW.uf);
  NEW.type          := UPPER(NEW.type);
  NEW.model         := UPPER(NEW.model);
  NEW.primary_mod   := UPPER(NEW.primary_mod);
  NEW.secondary_mod := UPPER(NEW.secondary_mod);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for stores table
DROP TRIGGER IF EXISTS trg_uppercase_store_fields ON public.stores;
CREATE TRIGGER trg_uppercase_store_fields
BEFORE INSERT OR UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.uppercase_store_fields();
