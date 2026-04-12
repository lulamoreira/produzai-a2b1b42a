

# Plan: Edge Function for Kit Duplication

## Problem
Kit duplication currently makes many sequential/parallel HTTP requests from the client (shift display_orders one by one, create kit, create pieces one by one, link kit_pieces one by one). This is slow due to network round-trips.

## Solution
Create a single edge function `duplicate-kit` that performs all operations server-side using `service_role`, then update the client to call it in one request.

## Technical Details

### 1. Create `supabase/functions/duplicate-kit/index.ts`

**Input** (POST body):
```json
{
  "kit_id": "uuid",
  "campaign_id": "uuid", 
  "orig_order": 5,
  "slots_needed": 4,
  "max_kit_code": 12,
  "max_piece_code": 45
}
```

**Server-side logic** (using service_role Supabase client):

1. **Fetch original kit** — single SELECT on `campaign_kits` by `kit_id`
2. **Fetch kit's pieces** — JOIN `campaign_kit_pieces` + `campaign_pieces` to get all piece data + quantities
3. **Bulk shift display_orders** — two UPDATE queries (one for pieces, one for kits) using `WHERE campaign_id = $1 AND display_order > $orig_order`, incrementing by `slots_needed`. This replaces N individual updates with 2.
4. **Insert new kit** — single INSERT with all metadata (name with " - Cópia", code = max_kit_code+1, display_order = orig_order+1, image_url, category, sub_location, is_mockup)
5. **Batch insert cloned pieces** — single INSERT with array of all pieces (each with new code, " - Cópia" name, display_order offset). Returns all created piece IDs.
6. **Batch insert kit_piece links** — single INSERT mapping new kit ID to new piece IDs with quantities.

**Return**: `{ kit, pieces, kit_pieces }` for client-side cache update.

### 2. Update `supabase/config.toml`
Add `[functions.duplicate-kit]` with `verify_jwt = false` (will validate auth in code).

### 3. Update `src/pages/CampaignDetail.tsx`
Replace the `onDuplicateKit` handler (lines 2374-2437) to:
- Call `supabase.functions.invoke("duplicate-kit", { body: { kit_id, campaign_id, orig_order, slots_needed, max_kit_code, max_piece_code } })`
- On success, invalidate queries and show toast
- Remove usage of `addKit.mutateAsync`, `updateKit.mutateAsync`, `addPiece.mutateAsync`, `addKitPiece.mutateAsync` from this handler

This reduces ~(2N + 4) network calls to 1 single call.

