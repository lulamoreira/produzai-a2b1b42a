-- Create drops table
CREATE TABLE public.q3d_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_name text NOT NULL,
  description text,
  drop_image_url text,
  drop_link text,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- Create pieces table
CREATE TABLE public.q3d_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid REFERENCES public.q3d_drops(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  piece_url text,
  active boolean DEFAULT false,
  price_figura numeric,
  price_chaveiro numeric,
  available_as text DEFAULT 'ambos',
  status text DEFAULT 'pendente',
  filament_grams numeric,
  print_hours numeric,
  created_at timestamptz DEFAULT now()
);

-- Create listings table
CREATE TABLE public.q3d_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid REFERENCES public.q3d_pieces(id) ON DELETE CASCADE,
  platform text NOT NULL,
  title text,
  description_ml text,
  description_shopee text,
  caption_instagram text,
  caption_tiktok text,
  hashtags text,
  price numeric,
  published_at timestamptz DEFAULT now(),
  status text DEFAULT 'ativo'
);

-- Create sales table
CREATE TABLE public.q3d_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.q3d_listings(id),
  piece_id uuid REFERENCES public.q3d_pieces(id),
  platform text,
  quantity integer DEFAULT 1,
  unit_price numeric,
  commission_rate numeric,
  production_cost numeric,
  gross_revenue numeric,
  net_profit numeric,
  sale_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

-- Create cost_settings table
CREATE TABLE public.q3d_cost_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filament_price_per_kg numeric DEFAULT 80,
  energy_cost_per_hour numeric DEFAULT 0.80,
  packaging_cost numeric DEFAULT 2,
  ml_commission_rate numeric DEFAULT 14,
  shopee_commission_rate numeric DEFAULT 18,
  desired_margin numeric DEFAULT 40,
  updated_at timestamptz DEFAULT now()
);

-- Insert default record into cost_settings
INSERT INTO public.q3d_cost_settings (
  filament_price_per_kg,
  energy_cost_per_hour,
  packaging_cost,
  ml_commission_rate,
  shopee_commission_rate,
  desired_margin
) VALUES (
  80, 0.80, 2, 14, 18, 40
);

-- Grant permissions
GRANT ALL ON public.q3d_drops TO anon, authenticated, service_role;
GRANT ALL ON public.q3d_pieces TO anon, authenticated, service_role;
GRANT ALL ON public.q3d_listings TO anon, authenticated, service_role;
GRANT ALL ON public.q3d_sales TO anon, authenticated, service_role;
GRANT ALL ON public.q3d_cost_settings TO anon, authenticated, service_role;

-- Disable RLS
ALTER TABLE public.q3d_drops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.q3d_pieces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.q3d_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.q3d_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.q3d_cost_settings DISABLE ROW LEVEL SECURITY;
