
ALTER TABLE public.campaign_pieces
ADD COLUMN specification text NOT NULL DEFAULT 'Vide Book/Manual',
ADD COLUMN installation_instructions text NOT NULL DEFAULT 'Sem informações específicas';
