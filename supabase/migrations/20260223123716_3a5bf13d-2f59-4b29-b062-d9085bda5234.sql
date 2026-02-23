
-- Pieces (campaign items)
CREATE TABLE public.pieces (
  id SERIAL PRIMARY KEY,
  code INTEGER UNIQUE NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores
CREATE TABLE public.stores (
  id SERIAL PRIMARY KEY,
  number INTEGER UNIQUE NOT NULL,
  uf TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model TEXT NOT NULL,
  primary_mod TEXT NOT NULL,
  secondary_mod TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store piece quantities
CREATE TABLE public.store_pieces (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  piece_id INTEGER NOT NULL REFERENCES public.pieces(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE(store_id, piece_id)
);

-- Change logs
CREATE TABLE public.change_logs (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  piece_id INTEGER REFERENCES public.pieces(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'add_quantity', 'remove_quantity', 'add_piece', 'remove_piece'
  old_value INTEGER,
  new_value INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but allow public access (internal tool, no auth)
ALTER TABLE public.pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_logs ENABLE ROW LEVEL SECURITY;

-- Public policies (no auth required for internal tool)
CREATE POLICY "Public read pieces" ON public.pieces FOR SELECT USING (true);
CREATE POLICY "Public insert pieces" ON public.pieces FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update pieces" ON public.pieces FOR UPDATE USING (true);
CREATE POLICY "Public delete pieces" ON public.pieces FOR DELETE USING (true);

CREATE POLICY "Public read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Public insert stores" ON public.stores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update stores" ON public.stores FOR UPDATE USING (true);
CREATE POLICY "Public delete stores" ON public.stores FOR DELETE USING (true);

CREATE POLICY "Public read store_pieces" ON public.store_pieces FOR SELECT USING (true);
CREATE POLICY "Public insert store_pieces" ON public.store_pieces FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update store_pieces" ON public.store_pieces FOR UPDATE USING (true);
CREATE POLICY "Public delete store_pieces" ON public.store_pieces FOR DELETE USING (true);

CREATE POLICY "Public read change_logs" ON public.change_logs FOR SELECT USING (true);
CREATE POLICY "Public insert change_logs" ON public.change_logs FOR INSERT WITH CHECK (true);

-- Storage bucket for piece images
INSERT INTO storage.buckets (id, name, public) VALUES ('piece-images', 'piece-images', true);

CREATE POLICY "Public read piece images" ON storage.objects FOR SELECT USING (bucket_id = 'piece-images');
CREATE POLICY "Public upload piece images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'piece-images');
CREATE POLICY "Public update piece images" ON storage.objects FOR UPDATE USING (bucket_id = 'piece-images');
CREATE POLICY "Public delete piece images" ON storage.objects FOR DELETE USING (bucket_id = 'piece-images');
