import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type BriefingSectionKey =
  | "objective"
  | "audience"
  | "refs"
  | "video_brief"
  | "video_notes"
  | "attachments";

export type BriefingStatus = "draft" | "in_review" | "approved";
export type BriefingMediaKind = "image" | "video" | "file" | "embed";

export interface Briefing {
  id: string;
  campaign_id: string;
  status: BriefingStatus;
  deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BriefingSection {
  id: string;
  briefing_id: string;
  section_key: BriefingSectionKey;
  body: string;
  updated_by: string | null;
  updated_at: string;
}

export interface BriefingMedia {
  id: string;
  briefing_id: string;
  section_key: BriefingSectionKey;
  kind: BriefingMediaKind;
  storage_path: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  mime_type: string | null;
  duration_sec: number | null;
  size_bytes: number | null;
  order_index: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface BriefingVideoComment {
  id: string;
  media_id: string;
  parent_id: string | null;
  timestamp_sec: number;
  body: string;
  author_id: string;
  created_at: string;
}

const BUCKET = "campaign-briefings";

/** Fetch or lazily create the briefing for a campaign. */
export function useBriefing(campaignId: string) {
  const qc = useQueryClient();

  const briefingQuery = useQuery({
    queryKey: ["briefing", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data: existing, error } = await supabase
        .from("campaign_briefings")
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle();
      if (error) throw error;
      if (existing) return existing as Briefing;

      const { data: user } = await supabase.auth.getUser();
      const { data: created, error: cErr } = await supabase
        .from("campaign_briefings")
        .insert({ campaign_id: campaignId, created_by: user.user?.id ?? null })
        .select("*")
        .single();
      if (cErr) throw cErr;
      return created as Briefing;
    },
  });

  const briefingId = briefingQuery.data?.id ?? "";

  const sectionsQuery = useQuery({
    queryKey: ["briefing-sections", briefingId],
    enabled: !!briefingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_briefing_sections")
        .select("*")
        .eq("briefing_id", briefingId);
      if (error) throw error;
      return (data ?? []) as BriefingSection[];
    },
  });

  const mediaQuery = useQuery({
    queryKey: ["briefing-media", briefingId],
    enabled: !!briefingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_briefing_media")
        .select("*")
        .eq("briefing_id", briefingId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BriefingMedia[];
    },
  });

  // Realtime — invalidate on any change to this briefing.
  useEffect(() => {
    if (!briefingId) return;
    const channel = supabase
      .channel(`briefing-${briefingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_briefings", filter: `id=eq.${briefingId}` },
        () => qc.invalidateQueries({ queryKey: ["briefing", campaignId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_briefing_sections", filter: `briefing_id=eq.${briefingId}` },
        () => qc.invalidateQueries({ queryKey: ["briefing-sections", briefingId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "campaign_briefing_media", filter: `briefing_id=eq.${briefingId}` },
        () => qc.invalidateQueries({ queryKey: ["briefing-media", briefingId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [briefingId, campaignId, qc]);

  const sectionsByKey = useMemo(() => {
    const map = new Map<BriefingSectionKey, BriefingSection>();
    (sectionsQuery.data ?? []).forEach((s) => map.set(s.section_key, s));
    return map;
  }, [sectionsQuery.data]);

  const mediaBySection = useMemo(() => {
    const map = new Map<BriefingSectionKey, BriefingMedia[]>();
    (mediaQuery.data ?? []).forEach((m) => {
      const arr = map.get(m.section_key) ?? [];
      arr.push(m);
      map.set(m.section_key, arr);
    });
    return map;
  }, [mediaQuery.data]);

  const upsertSection = useMutation({
    mutationFn: async ({ key, body }: { key: BriefingSectionKey; body: string }) => {
      if (!briefingId) throw new Error("Briefing not ready");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("campaign_briefing_sections")
        .upsert(
          { briefing_id: briefingId, section_key: key, body, updated_by: user.user?.id ?? null },
          { onConflict: "briefing_id,section_key" },
        );
      if (error) throw error;
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar seção"),
  });

  const updateBriefing = useMutation({
    mutationFn: async (patch: Partial<Pick<Briefing, "status" | "deadline">>) => {
      if (!briefingId) throw new Error("Briefing not ready");
      const { error } = await supabase.from("campaign_briefings").update(patch).eq("id", briefingId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing", campaignId] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar briefing"),
  });

  const addEmbed = useMutation({
    mutationFn: async (input: {
      sectionKey: BriefingSectionKey;
      externalUrl: string;
      thumbnailUrl?: string;
      title?: string;
      kind?: BriefingMediaKind;
    }) => {
      if (!briefingId) throw new Error("Briefing not ready");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("campaign_briefing_media").insert({
        briefing_id: briefingId,
        section_key: input.sectionKey,
        kind: input.kind ?? "embed",
        external_url: input.externalUrl,
        thumbnail_url: input.thumbnailUrl ?? null,
        title: input.title ?? null,
        uploaded_by: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing-media", briefingId] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao adicionar link"),
  });

  const uploadFile = useMutation({
    mutationFn: async (input: {
      sectionKey: BriefingSectionKey;
      file: File | Blob;
      fileName: string;
      kind: BriefingMediaKind;
      durationSec?: number;
      title?: string;
    }) => {
      if (!briefingId) throw new Error("Briefing not ready");
      const { data: user } = await supabase.auth.getUser();
      const uid = crypto.randomUUID();
      const safeName = input.fileName.replace(/[^\w.\-]+/g, "_");
      const path = `${campaignId}/${briefingId}/${input.sectionKey}/${uid}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, input.file, {
        contentType: (input.file as File).type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("campaign_briefing_media").insert({
        briefing_id: briefingId,
        section_key: input.sectionKey,
        kind: input.kind,
        storage_path: path,
        mime_type: (input.file as File).type || null,
        size_bytes: (input.file as File).size ?? null,
        duration_sec: input.durationSec ?? null,
        title: input.title ?? input.fileName,
        uploaded_by: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing-media", briefingId] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha no upload"),
  });

  const deleteMedia = useMutation({
    mutationFn: async (media: BriefingMedia) => {
      if (media.storage_path) {
        await supabase.storage.from(BUCKET).remove([media.storage_path]);
      }
      const { error } = await supabase.from("campaign_briefing_media").delete().eq("id", media.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefing-media", briefingId] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover mídia"),
  });

  return {
    briefing: briefingQuery.data,
    isLoading: briefingQuery.isLoading || sectionsQuery.isLoading || mediaQuery.isLoading,
    sectionsByKey,
    mediaBySection,
    upsertSection,
    updateBriefing,
    addEmbed,
    uploadFile,
    deleteMedia,
  };
}

/** Signed URL helper for private bucket assets. Cached briefly in-memory per path. */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
export async function getBriefingSignedUrl(storagePath: string): Promise<string | null> {
  const cached = signedUrlCache.get(storagePath);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  signedUrlCache.set(storagePath, { url: data.signedUrl, expiresAt: now + 3600_000 });
  return data.signedUrl;
}

/** Comments on a specific video media item. */
export function useBriefingVideoComments(mediaId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["briefing-vcomments", mediaId],
    enabled: !!mediaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_briefing_video_comments")
        .select("*")
        .eq("media_id", mediaId!)
        .order("timestamp_sec", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BriefingVideoComment[];
    },
  });

  useEffect(() => {
    if (!mediaId) return;
    const channel = supabase
      .channel(`briefing-vc-${mediaId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "campaign_briefing_video_comments", filter: `media_id=eq.${mediaId}` },
        () => qc.invalidateQueries({ queryKey: ["briefing-vcomments", mediaId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mediaId, qc]);

  const addComment = useMutation({
    mutationFn: async (input: { timestampSec: number; body: string; parentId?: string | null }) => {
      if (!mediaId) throw new Error("No media");
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("campaign_briefing_video_comments").insert({
        media_id: mediaId,
        timestamp_sec: input.timestampSec,
        body: input.body,
        parent_id: input.parentId ?? null,
        author_id: user.user.id,
      });
      if (error) throw error;
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao comentar"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_briefing_video_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover comentário"),
  });

  return { comments: query.data ?? [], isLoading: query.isLoading, addComment, deleteComment };
}
