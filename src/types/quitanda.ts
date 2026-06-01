export type Q3DDrop = {
  id: string;
  drop_name: string;
  description: string | null;
  drop_image_url: string | null;
  drop_link: string | null;
  source: string;
  created_at: string;
};

export type Q3DPiece = {
  id: string;
  drop_id: string;
  name: string;
  image_url: string | null;
  piece_url: string | null;
  active: boolean;
  price_figura: number | null;
  price_chaveiro: number | null;
  available_as: 'figura' | 'chaveiro' | 'ambos';
  status: 'pendente' | 'publicado' | 'pausado';
  filament_grams: number | null;
  print_hours: number | null;
  created_at: string;
};

export type Q3DCostSettings = {
  id: string;
  filament_price_per_kg: number;
  energy_cost_per_hour: number;
  packaging_cost: number;
  ml_commission_rate: number;
  shopee_commission_rate: number;
  desired_margin: number;
  updated_at: string;
};
