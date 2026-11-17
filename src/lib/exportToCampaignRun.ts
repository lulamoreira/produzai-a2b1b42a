/**
 * Execução do "Exportar para campanha".
 *
 * REGRA ABSOLUTA: a campanha de origem é somente LIDA (os dados chegam já
 * carregados da aba Peças). Toda escrita aqui acontece no DESTINO, e o
 * desfazer apaga apenas o que esta operação criou no destino.
 *
 * Ordem: (1) campanha nova, se for o caso; (2) cópia das imagens;
 * (3) locais que faltam no destino; (4) peças; (5) kits e kit_pieces.
 */
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { copyPieceImage, removeCopiedPieceImages, type PieceImageCopyResult } from "@/lib/copyPieceImage";
import {
  buildExportPlan,
  labelsForNewCampaign,
  missingDestinationLocations,
  usedCustomFields,
  type ExportCodeRow,
  type ExportSelection,
  type LocationRow,
  type SubLocationRow,
} from "@/lib/exportToCampaign";

export type ExportDestination =
  | { kind: "new"; name: string }
  | { kind: "existing"; campaignId: string; name: string };

export interface ExportProgress {
  label: string;
  done?: number;
  total?: number;
}

export interface ExportRunInput {
  clientId: string;
  sourceCampaignId: string;
  selection: ExportSelection;
  sourceLabels: Array<string | null | undefined>;
  sourceLocations: LocationRow[];
  sourceSubLocations: SubLocationRow[];
  destination: ExportDestination;
  onProgress?: (p: ExportProgress) => void;
}

export interface ExportRunResult {
  campaignId: string;
  campaignName: string;
  createdCampaign: boolean;
  codeRows: ExportCodeRow[];
  sharedImages: number;
  itemCount: number;
}

export class ExportToCampaignError extends Error {
  constructor(message: string, public readonly rollbackProblems: string[]) {
    super(message);
    this.name = "ExportToCampaignError";
  }
}

const CHUNK = 200;
const DELETE_CHUNK = 100;
const IMAGE_CONCURRENCY = 4;

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/row-level security|permission denied|violates row-level/i.test(msg)) {
    return "Você não tem permissão para incluir peças, kits ou locais na campanha de destino.";
  }
  return msg;
}

/** Lê todas as linhas (paginado, count exact, ordem estável por id). */
async function readAll<T>(table: "campaign_pieces" | "campaign_kits" | "campaign_piece_locations" | "campaign_piece_sub_locations", columns: string, campaignId: string, onlyActive: boolean): Promise<T[]> {
  return supabasePaginate<T>((from, to) => {
    let q = supabase.from(table).select(columns, { count: "exact" }).eq("campaign_id", campaignId);
    if (onlyActive) q = q.eq("is_deleted", false);
    return q.order("id").range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>;
  });
}

export async function runExportToCampaign(input: ExportRunInput): Promise<ExportRunResult> {
  const { selection, destination, onProgress } = input;
  if (destination.kind === "existing" && destination.campaignId === input.sourceCampaignId) {
    throw new ExportToCampaignError("A campanha de destino não pode ser a própria campanha de origem.", []);
  }

  // Tudo o que esta operação criar no DESTINO, para o desfazer.
  const created = {
    campaignId: null as string | null,
    imagePaths: [] as string[],
    locationIds: [] as string[],
    subLocationIds: [] as string[],
    pieceIds: [] as string[],
    kitIds: [] as string[],
    kitPieceIds: [] as string[],
  };

  let destId = destination.kind === "existing" ? destination.campaignId : "";
  let destName = destination.name;

  try {
    // (1) Campanha nova: mesmo insert do "Nova campanha" + rótulos usados.
    if (destination.kind === "new") {
      onProgress?.({ label: "Criando a campanha…" });
      const labels = labelsForNewCampaign(input.sourceLabels, usedCustomFields(selection.allPieces));
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ client_id: input.clientId, name: destination.name, ...labels })
        .select("id, name")
        .single();
      if (error) throw error;
      created.campaignId = data.id;
      destId = data.id;
      destName = data.name;
    }

    // Leitura do destino (códigos, posições e locais já existentes).
    onProgress?.({ label: "Lendo a campanha de destino…" });
    const [destPieces, destKits, destLocations, destSubs] = await Promise.all([
      readAll<{ id: string; code: number; display_order: number }>("campaign_pieces", "id, code, display_order", destId, true),
      readAll<{ id: string; code: number; display_order: number }>("campaign_kits", "id, code, display_order", destId, true),
      readAll<LocationRow>("campaign_piece_locations", "id, name", destId, false),
      readAll<SubLocationRow>("campaign_piece_sub_locations", "id, location_id, name", destId, false),
    ]);
    const plan = buildExportPlan({ selection, destPieces, destKits });

    // (2) Imagens: uma cópia por URL distinta dentro do mesmo item.
    type ImageJob = { key: string; url: string };
    const jobs: ImageJob[] = [];
    const itemUrls = new Map<string, Map<string, string>>(); // itemKey -> url -> jobKey
    const register = (itemKey: string, url: string | null | undefined) => {
      if (!url) return;
      const perItem = itemUrls.get(itemKey) ?? new Map<string, string>();
      itemUrls.set(itemKey, perItem);
      if (perItem.has(url)) return;
      const key = `${itemKey}::${perItem.size}`;
      perItem.set(url, key);
      jobs.push({ key, url });
    };
    for (const p of selection.allPieces) {
      for (const url of [p.image_url, p.image_thumb_url, p.image_full_url, p.image_report_url]) register(`piece:${p.id}`, url);
    }
    for (const k of selection.kits) register(`kit:${k.id}`, k.image_url);

    const results = new Map<string, PieceImageCopyResult>();
    let doneImages = 0;
    if (jobs.length > 0) onProgress?.({ label: "Copiando imagens…", done: 0, total: jobs.length });
    for (let i = 0; i < jobs.length; i += IMAGE_CONCURRENCY) {
      const batch = jobs.slice(i, i + IMAGE_CONCURRENCY);
      const out = await Promise.all(batch.map((job, j) => copyPieceImage(job.url, i + j)));
      out.forEach((res, j) => {
        results.set(batch[j].key, res);
        if (res.status === "copied") created.imagePaths.push(res.path);
      });
      doneImages += batch.length;
      onProgress?.({ label: "Copiando imagens…", done: doneImages, total: jobs.length });
    }
    const sharedImages = [...results.values()].filter((r) => r.status === "shared").length;
    const newUrl = (itemKey: string, url: string | null | undefined): string | null => {
      if (!url) return null;
      const key = itemUrls.get(itemKey)?.get(url);
      const res = key ? results.get(key) : undefined;
      return res && res.url ? res.url : url;
    };

    // (3) Locais/sublocais cadastrados na origem que faltam no destino.
    const missing = missingDestinationLocations({
      items: [...selection.allPieces, ...selection.kits],
      sourceLocations: input.sourceLocations,
      sourceSubLocations: input.sourceSubLocations,
      destLocations,
      destSubLocations: destSubs,
    });
    if (missing.locations.length || missing.subLocations.length) {
      onProgress?.({ label: "Criando locais na campanha de destino…" });
    }
    const destLocIdByName = new Map(destLocations.map((l) => [l.name.trim().toLocaleUpperCase("pt-BR"), l.id]));
    if (missing.locations.length > 0) {
      const { data, error } = await supabase
        .from("campaign_piece_locations")
        .insert(missing.locations.map((name) => ({ campaign_id: destId, name })))
        .select("id, name");
      if (error) throw error;
      for (const row of data ?? []) {
        created.locationIds.push(row.id);
        destLocIdByName.set(row.name.trim().toLocaleUpperCase("pt-BR"), row.id);
      }
    }
    if (missing.subLocations.length > 0) {
      const rows = missing.subLocations
        .map((s) => ({ campaign_id: destId, name: s.name, location_id: destLocIdByName.get(s.locationName.trim().toLocaleUpperCase("pt-BR")) }))
        .filter((r): r is { campaign_id: string; name: string; location_id: string } => !!r.location_id);
      if (rows.length > 0) {
        const { data, error } = await supabase.from("campaign_piece_sub_locations").insert(rows).select("id");
        if (error) throw error;
        for (const row of data ?? []) created.subLocationIds.push(row.id);
      }
    }

    // (4) Peças novas, independentes da origem.
    const pieceRows = selection.allPieces.map((p) => {
      const key = `piece:${p.id}`;
      return {
        campaign_id: destId,
        code: plan.pieceCode.get(p.id)!,
        display_order: plan.pieceOrder.get(p.id)!,
        category: p.category,
        name: p.name,
        size: p.size,
        store_category: p.store_category ?? null,
        ...(p.specification != null ? { specification: p.specification } : {}),
        ...(p.installation_instructions != null ? { installation_instructions: p.installation_instructions } : {}),
        kit_only: !!p.kit_only,
        custom_field_1: p.custom_field_1 ?? null,
        custom_field_2: p.custom_field_2 ?? null,
        custom_field_3: p.custom_field_3 ?? null,
        custom_field_4: p.custom_field_4 ?? null,
        custom_field_5: p.custom_field_5 ?? null,
        sub_location: p.sub_location ?? null,
        is_new: !!p.is_new,
        is_mockup: !!p.is_mockup,
        is_deleted: false,
        image_hash: p.image_hash ?? null,
        image_url: newUrl(key, p.image_url),
        image_thumb_url: newUrl(key, p.image_thumb_url),
        image_full_url: newUrl(key, p.image_full_url),
        image_report_url: newUrl(key, p.image_report_url),
      };
    });
    const sourceIdByCode = new Map(selection.allPieces.map((p) => [plan.pieceCode.get(p.id)!, p.id]));
    const newPieceIdBySource = new Map<string, string>();
    let insertedPieces = 0;
    for (const part of chunks(pieceRows, CHUNK)) {
      onProgress?.({ label: "Incluindo peças…", done: insertedPieces, total: pieceRows.length });
      const { data, error } = await supabase.from("campaign_pieces").insert(part).select("id, code");
      if (error) throw error;
      for (const row of data ?? []) {
        created.pieceIds.push(row.id);
        const src = sourceIdByCode.get(row.code);
        if (src) newPieceIdBySource.set(src, row.id);
      }
      insertedPieces += part.length;
    }
    if (newPieceIdBySource.size !== selection.allPieces.length) {
      throw new Error("Nem todas as peças foram criadas na campanha de destino.");
    }

    // (5) Kits e suas peças (kit_pieces apontando para as peças NOVAS).
    if (selection.kits.length > 0) {
      onProgress?.({ label: "Incluindo kits…" });
      const kitRows = selection.kits.map((k) => ({
        campaign_id: destId,
        code: plan.kitCode.get(k.id)!,
        display_order: plan.kitOrder.get(k.id)!,
        name: k.name,
        category: k.category ?? null,
        sub_location: k.sub_location ?? null,
        is_new: !!k.is_new,
        is_mockup: !!k.is_mockup,
        image_url: newUrl(`kit:${k.id}`, k.image_url),
      }));
      const kitSourceByCode = new Map(selection.kits.map((k) => [plan.kitCode.get(k.id)!, k.id]));
      const newKitIdBySource = new Map<string, string>();
      for (const part of chunks(kitRows, CHUNK)) {
        const { data, error } = await supabase.from("campaign_kits").insert(part).select("id, code");
        if (error) throw error;
        for (const row of data ?? []) {
          created.kitIds.push(row.id);
          const src = kitSourceByCode.get(row.code);
          if (src) newKitIdBySource.set(src, row.id);
        }
      }
      if (newKitIdBySource.size !== selection.kits.length) {
        throw new Error("Nem todos os kits foram criados na campanha de destino.");
      }

      const kpRows = selection.kits.flatMap((k) =>
        (selection.componentsByKit.get(k.id) ?? []).map((c) => ({
          kit_id: newKitIdBySource.get(k.id)!,
          piece_id: newPieceIdBySource.get(c.piece.id)!,
          quantity: c.quantity,
          display_order: c.display_order,
        })),
      );
      for (const part of chunks(kpRows, CHUNK)) {
        const { data, error } = await supabase.from("campaign_kit_pieces").insert(part).select("id");
        if (error) throw error;
        for (const row of data ?? []) created.kitPieceIds.push(row.id);
      }
    }

    return {
      campaignId: destId,
      campaignName: destName,
      createdCampaign: destination.kind === "new",
      codeRows: plan.codeRows,
      sharedImages,
      itemCount: selection.standalonePieces.length + selection.kits.length,
    };
  } catch (e) {
    onProgress?.({ label: "Desfazendo o que foi criado no destino…" });
    const problems = await rollbackDestination(created);
    const base = friendlyError(e).replace(/[.\s]+$/, "");
    const suffix = problems.length
      ? ` Não foi possível desfazer tudo no destino: ${problems.join("; ")}.`
      : " Nada ficou gravado na campanha de destino.";
    throw new ExportToCampaignError(`Não foi possível exportar: ${base}.${suffix}`, problems);
  }
}

/** Apaga SÓ o que foi criado no destino por esta operação. Nunca toca a origem. */
async function rollbackDestination(created: {
  campaignId: string | null;
  imagePaths: string[];
  locationIds: string[];
  subLocationIds: string[];
  pieceIds: string[];
  kitIds: string[];
  kitPieceIds: string[];
}): Promise<string[]> {
  const problems: string[] = [];
  const del = async (
    table: "campaign_kit_pieces" | "campaign_kits" | "campaign_pieces" | "campaign_piece_sub_locations" | "campaign_piece_locations" | "campaigns",
    ids: string[],
    label: string,
  ) => {
    let removed = 0;
    for (const part of chunks(ids, DELETE_CHUNK)) {
      const { data, error } = await supabase.from(table).delete().in("id", part).select("id");
      if (error) { problems.push(`${label} (${error.message})`); return; }
      removed += data?.length ?? 0;
    }
    if (removed < ids.length) problems.push(`${ids.length - removed} ${label} sem permissão para apagar`);
  };

  await del("campaign_kit_pieces", created.kitPieceIds, "vínculo(s) de kit");
  await del("campaign_kits", created.kitIds, "kit(s)");
  await del("campaign_pieces", created.pieceIds, "peça(s)");
  await del("campaign_piece_sub_locations", created.subLocationIds, "sublocal(is)");
  await del("campaign_piece_locations", created.locationIds, "local(is)");
  if (created.campaignId) await del("campaigns", [created.campaignId], "campanha nova");
  const imgErr = await removeCopiedPieceImages(created.imagePaths);
  if (imgErr) problems.push(`imagens copiadas (${imgErr})`);
  return problems;
}
