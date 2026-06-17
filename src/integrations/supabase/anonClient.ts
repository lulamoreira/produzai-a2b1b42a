import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Cliente SOMENTE anônimo para portais públicos por token (convite de fornecedor etc).
// NÃO carrega nem persiste a sessão de usuário logado — garante que as requisições
// rodem como anônimo mesmo se houver um usuário do ProduzAI logado no mesmo navegador.
export const supabaseAnon = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
