import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { kit_id, campaign_id, orig_order, slots_needed, max_kit_code, max_piece_code } = await req.json();

    if (!kit_id || !campaign_id || orig_order == null || !slots_needed || max_kit_code == null || max_piece_code == null) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch original kit
    const { data: origKit, error: kitErr } = await supabase
      .from("campaign_kits")
      .select("*")
      .eq("id", kit_id)
      .single();

    if (kitErr || !origKit) {
      return new Response(JSON.stringify({ error: "Kit not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch kit pieces with quantities
    const { data: kitPiecesData } = await supabase
      .from("campaign_kit_pieces")
      .select("piece_id, quantity")
      .eq("kit_id", kit_id);

    const kpList = kitPiecesData || [];
    const pieceIds = kpList.map((kp: any) => kp.piece_id);

    let origPieces: any[] = [];
    if (pieceIds.length > 0) {
      const { data } = await supabase
        .from("campaign_pieces")
        .select("*")
        .in("id", pieceIds);
      origPieces = data || [];
    }

    // 3. Bulk shift display_orders — fetch items then update in parallel
    const [{ data: piecesToShift }, { data: kitsToShift }] = await Promise.all([
      supabase
        .from("campaign_pieces")
        .select("id, display_order")
        .eq("campaign_id", campaign_id)
        .gt("display_order", orig_order),
      supabase
        .from("campaign_kits")
        .select("id, display_order")
        .eq("campaign_id", campaign_id)
        .gt("display_order", orig_order),
    ]);

    const shiftPromises: Promise<any>[] = [];
    for (const p of (piecesToShift || [])) {
      shiftPromises.push(
        supabase.from("campaign_pieces").update({ display_order: p.display_order + slots_needed }).eq("id", p.id)
      );
    }
    for (const k of (kitsToShift || [])) {
      shiftPromises.push(
        supabase.from("campaign_kits").update({ display_order: k.display_order + slots_needed }).eq("id", k.id)
      );
    }
    if (shiftPromises.length > 0) {
      await Promise.all(shiftPromises);
    }

    // 4. Insert new kit with all metadata
    const { data: newKit, error: newKitErr } = await supabase
      .from("campaign_kits")
      .insert({
        campaign_id,
        name: `${origKit.name} - Cópia`,
        code: max_kit_code + 1,
        display_order: orig_order + 1,
        image_url: origKit.image_url,
        is_mockup: origKit.is_mockup,
        category: origKit.category,
        sub_location: origKit.sub_location,
      })
      .select()
      .single();

    if (newKitErr) {
      return new Response(JSON.stringify({ error: "Failed to create kit", details: newKitErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Batch insert cloned pieces
    let newPieces: any[] = [];
    if (origPieces.length > 0) {
      const pieceInserts = origPieces.map((p: any, idx: number) => ({
        campaign_id,
        code: max_piece_code + idx + 1,
        category: p.category,
        name: `${p.name} - Cópia`,
        size: p.size,
        store_category: p.store_category,
        specification: p.specification,
        installation_instructions: p.installation_instructions,
        kit_only: p.kit_only,
        is_mockup: p.is_mockup,
        display_order: orig_order + 1 + idx + 1,
        image_url: p.image_url,
        sub_location: p.sub_location,
      }));

      const { data: insertedPieces, error: piecesErr } = await supabase
        .from("campaign_pieces")
        .insert(pieceInserts)
        .select();

      if (piecesErr) {
        return new Response(JSON.stringify({ error: "Failed to create pieces", details: piecesErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newPieces = insertedPieces || [];
    }

    // 6. Batch insert kit_piece links
    if (newPieces.length > 0) {
      // Match new pieces to original pieces by index order (same order as origPieces)
      const kitPieceInserts = newPieces.map((np: any, idx: number) => {
        const origPiece = origPieces[idx];
        const kp = origPiece ? kpList.find((k: any) => k.piece_id === origPiece.id) : null;
        return {
          kit_id: newKit.id,
          piece_id: np.id,
          quantity: kp?.quantity || 1,
        };
      });

      const { error: linkErr } = await supabase
        .from("campaign_kit_pieces")
        .insert(kitPieceInserts);

      if (linkErr) {
        return new Response(JSON.stringify({ error: "Failed to link pieces", details: linkErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ kit: newKit, pieces: newPieces, pieces_count: newPieces.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
