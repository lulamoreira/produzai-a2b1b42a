-- Update existing records in client_store_models
UPDATE public.client_store_models SET name = UPPER(name);

-- Create trigger function for client_store_models
CREATE OR REPLACE FUNCTION public.uppercase_client_store_models_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := UPPER(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for client_store_models
DROP TRIGGER IF EXISTS trg_uppercase_client_store_models_fields ON public.client_store_models;
CREATE TRIGGER trg_uppercase_client_store_models_fields
BEFORE INSERT OR UPDATE ON public.client_store_models
FOR EACH ROW EXECUTE FUNCTION public.uppercase_client_store_models_fields();

-- Update existing records in loja_a_loja_tipos
UPDATE public.loja_a_loja_tipos SET nome = UPPER(nome), letra = UPPER(letra);

-- Create trigger function for loja_a_loja_tipos
CREATE OR REPLACE FUNCTION public.uppercase_loja_a_loja_tipos_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nome  := UPPER(NEW.nome);
  NEW.letra := UPPER(NEW.letra);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for loja_a_loja_tipos
DROP TRIGGER IF EXISTS trg_uppercase_loja_a_loja_tipos_fields ON public.loja_a_loja_tipos;
CREATE TRIGGER trg_uppercase_loja_a_loja_tipos_fields
BEFORE INSERT OR UPDATE ON public.loja_a_loja_tipos
FOR EACH ROW EXECUTE FUNCTION public.uppercase_loja_a_loja_tipos_fields();

-- Update existing records in loja_a_loja_subdivisoes
UPDATE public.loja_a_loja_subdivisoes SET nome = UPPER(nome);

-- Create trigger function for loja_a_loja_subdivisoes
CREATE OR REPLACE FUNCTION public.uppercase_loja_a_loja_subdivisoes_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nome := UPPER(NEW.nome);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for loja_a_loja_subdivisoes
DROP TRIGGER IF EXISTS trg_uppercase_loja_a_loja_subdivisoes_fields ON public.loja_a_loja_subdivisoes;
CREATE TRIGGER trg_uppercase_loja_a_loja_subdivisoes_fields
BEFORE INSERT OR UPDATE ON public.loja_a_loja_subdivisoes
FOR EACH ROW EXECUTE FUNCTION public.uppercase_loja_a_loja_subdivisoes_fields();
