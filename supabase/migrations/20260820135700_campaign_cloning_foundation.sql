-- FASE 1: Fundação para renegociação como campanha clonada

-- 1. Adicionar colunas aditivas na tabela campaigns
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS root_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS origin_label text;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_campaigns_parent_campaign_id ON public.campaigns(parent_campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_root_campaign_id ON public.campaigns(root_campaign_id);

-- Nota: RLS existente já cobre estas colunas pois são parte da tabela campaigns.
-- Todas as colunas são NULL por padrão, mantendo compatibilidade com dados existentes.
