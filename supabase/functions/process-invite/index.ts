import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Find the invite
    const { data: invite, error: invErr } = await admin
      .from('invites')
      .select('*')
      .eq('token', token)
      .is('used_by', null)
      .single();

    if (invErr || !invite) {
      return new Response(JSON.stringify({ error: 'Invalid or already used invite' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Auto-approve the user
    await admin
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('user_id', user.id);

    // 2. Find or create "Visualizador" permission category
    let { data: category } = await admin
      .from('permission_categories')
      .select('id')
      .eq('name', 'Visualizador')
      .maybeSingle();

    if (!category) {
      const { data: newCat, error: catErr } = await admin
        .from('permission_categories')
        .insert({
          name: 'Visualizador',
          can_view_clients: true,
          can_view_campaigns: true,
          can_view_stores: true,
          can_view_campaign_stores: true,
          can_view_pieces: true,
          can_view_occurrences: true,
          can_view_schedules: true,
          can_edit_clients: false,
          can_edit_campaigns: false,
          can_edit_stores: false,
          can_edit_campaign_stores: false,
          can_edit_pieces: false,
          can_edit_occurrences: false,
          can_edit_schedules: false,
          can_delete_clients: false,
          can_delete_campaigns: false,
          can_delete_stores: false,
          can_delete_campaign_stores: false,
          can_delete_pieces: false,
          can_delete_occurrences: false,
          can_delete_schedules: false,
          can_edit_reporter_data: false,
        })
        .select('id')
        .single();

      if (catErr) {
        return new Response(JSON.stringify({ error: 'Failed to create permission category' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      category = newCat;
    }

    // 3. Grant client-level access only
    if (invite.client_id) {
      const { data: existing } = await admin
        .from('user_client_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_id', invite.client_id)
        .maybeSingle();

      if (!existing) {
        await admin.from('user_client_access').insert({
          user_id: user.id,
          client_id: invite.client_id,
          category_id: category!.id,
          can_edit: false,
          suspended: false,
        });
      }
    } else {
      // No client_id means invalid invite for scoped access
      return new Response(JSON.stringify({ error: 'Invite must have a client scope' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Mark invite as used
    await admin
      .from('invites')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', invite.id);

    // 5. Populate agency_id and client_id on the user's profile
    await admin
      .from('profiles')
      .update({
        agency_id: invite.agency_id,
        client_id: invite.client_id ?? null,
      })
      .eq('user_id', user.id);

    // 6. Dispatch notification for new user (silent)
    const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Novo usuário';
    admin.rpc('criar_notificacao', {
      _agency_id: invite.agency_id,
      _campaign_id: null,
      _store_id: null,
      _client_id: invite.client_id ?? null,
      _type: 'novo_usuario_pendente',
      _title: 'Novo usuário via convite',
      _body: `${displayName} ingressou na plataforma via convite`,
      _action_url: '/admin?tab=aprovacoes',
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
