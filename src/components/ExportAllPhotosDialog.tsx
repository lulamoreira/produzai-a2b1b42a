import { useRef, useState } from "react";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import {
  AppDialog,
  AppDialogHeader,
  AppDialogBody,
  AppDialogFooter,
} from "@/components/ui/app-dialog";
import { ConfirmDestructiveDialog } from "@/components/ui/confirm-destructive-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Camera, Download, Trash2, MoreVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  campaignId: string;
  campaignName: string;
  trigger?: React.ReactNode;
}

type Scope = {
  installations: boolean;
  checkin: boolean;
  occurrences: boolean;
  chat: boolean;
};

type CollectedPhoto = {
  url: string;
  bucket: string;
  path: string;
  folder: string;
  storeFolder?: string;
  table: "installation_photos" | "occurrence_photos" | "campaign_messages";
  rowId: string;
  category?: string;
};

const ALL_SCOPE: Scope = {
  installations: true,
  checkin: true,
  occurrences: true,
  chat: true,
};

function sanitize(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 60) || "sem_nome"
  );
}

function parseStoragePath(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2].split("?")[0]) };
  } catch {
    return null;
  }
}

export default function ExportAllPhotosDialog({ campaignId, campaignName, trigger }: Props) {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>(ALL_SCOPE);
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  // Confirm flows
  const [confirmDownloadDeleteOpen, setConfirmDownloadDeleteOpen] = useState(false);
  const [confirmDownloadDeleteCount, setConfirmDownloadDeleteCount] = useState(0);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [confirmDeleteAllCount, setConfirmDeleteAllCount] = useState(0);

  // Snapshot of photos collected at confirmation time — guarantees the
  // user confirms the exact set that gets processed, even if uploads happen
  // concurrently between the confirm dialog opening and onConfirm firing.
  const photosToProcessRef = useRef<CollectedPhoto[] | null>(null);

  const reset = () => {
    setProgress({ done: 0, total: 0, label: "" });
    photosToProcessRef.current = null;
  };

  const collectPhotos = async (
    activeScope: Scope,
  ): Promise<{ photos: CollectedPhoto[] }> => {
    const photos: CollectedPhoto[] = [];

    const ids = new Set<string>();
    const r1 = await supabasePaginate<{ store_id: string | null }>((from, to) =>
      supabase
        .from("installation_photos")
        .select("store_id")
        .eq("campaign_id", campaignId)
        .range(from, to) as any,
    );
    r1.forEach((x: any) => x.store_id && ids.add(x.store_id));
    const r2 = await supabasePaginate<{ store_id: string | null }>((from, to) =>
      supabase
        .from("occurrences")
        .select("store_id")
        .eq("campaign_id", campaignId)
        .range(from, to) as any,
    );
    r2.forEach((x: any) => x.store_id && ids.add(x.store_id));

    const { data: stores } = await supabase
      .from("client_stores")
      .select("id, name, nickname, store_code")
      .in("id", Array.from(ids) as string[]);

    const storeMap: Record<string, string> = {};
    (stores || []).forEach((s: any) => {
      storeMap[s.id] = sanitize(s.nickname || s.name || s.store_code || s.id);
    });

    if (activeScope.installations || activeScope.checkin) {
      const data = await supabasePaginate<{
        id: string;
        photo_url: string;
        category: string;
        store_id: string;
      }>((from, to) =>
        supabase
          .from("installation_photos")
          .select("id, photo_url, category, store_id")
          .eq("campaign_id", campaignId)
          .range(from, to) as any,
      );
      data.forEach((p: any) => {
        const isCheckin = p.category === "checkin";
        if (isCheckin && !activeScope.checkin) return;
        if (!isCheckin && !activeScope.installations) return;
        const parsed = parseStoragePath(p.photo_url);
        if (!parsed) return;
        photos.push({
          url: p.photo_url,
          bucket: parsed.bucket,
          path: parsed.path,
          folder: isCheckin ? "Check-in" : "Instalacoes",
          storeFolder: storeMap[p.store_id] || "Loja_Desconhecida",
          table: "installation_photos",
          rowId: p.id,
          category: p.category,
        });
      });
    }

    if (activeScope.occurrences) {
      const occs = await supabasePaginate<{ id: string; store_id: string | null }>(
        (from, to) =>
          supabase
            .from("occurrences")
            .select("id, store_id")
            .eq("campaign_id", campaignId)
            .range(from, to) as any,
      );
      const occIds = occs.map((o: any) => o.id);
      const occStoreMap: Record<string, string> = {};
      occs.forEach((o: any) => {
        occStoreMap[o.id] = o.store_id;
      });
      if (occIds.length) {
        const { data: oph } = await supabase
          .from("occurrence_photos")
          .select("id, photo_url, category, occurrence_id")
          .in("occurrence_id", occIds);
        (oph || []).forEach((p: any) => {
          const parsed = parseStoragePath(p.photo_url);
          if (!parsed) return;
          const sid = occStoreMap[p.occurrence_id];
          photos.push({
            url: p.photo_url,
            bucket: parsed.bucket,
            path: parsed.path,
            folder: "Ocorrencias",
            storeFolder: sid ? storeMap[sid] : undefined,
            table: "occurrence_photos",
            rowId: p.id,
            category: p.category,
          });
        });
      }
    }

    if (activeScope.chat) {
      const { data: msgs } = await supabase
        .from("campaign_messages")
        .select("id, image_url")
        .eq("campaign_id", campaignId)
        .not("image_url", "is", null);
      (msgs || []).forEach((m: any) => {
        if (!m.image_url) return;
        const parsed = parseStoragePath(m.image_url);
        if (!parsed) return;
        photos.push({
          url: m.image_url,
          bucket: parsed.bucket,
          path: parsed.path,
          folder: "Chat",
          table: "campaign_messages",
          rowId: m.id,
        });
      });
    }

    return { photos };
  };

  const buildAndDownloadZip = async (photos: CollectedPhoto[]) => {
    const zip = new JSZip();
    const counters: Record<string, number> = {};
    let done = 0;

    await Promise.all(
      photos.map(async (p) => {
        try {
          const res = await fetch(p.url);
          if (!res.ok) throw new Error("fetch failed");
          const blob = await res.blob();
          const ext = p.url.match(/\.(jpg|jpeg|png|webp|gif|webm|mp4)/i)?.[1] || "jpg";
          const subPath = p.storeFolder ? `${p.folder}/${p.storeFolder}` : p.folder;
          counters[subPath] = (counters[subPath] || 0) + 1;
          const cat = p.category ? `${sanitize(p.category)}_` : "";
          const name = `${subPath}/${cat}${String(counters[subPath]).padStart(4, "0")}.${ext}`;
          zip.file(name, blob);
        } catch {
          console.warn("Failed to fetch", p.url);
        } finally {
          done++;
          setProgress({ done, total: photos.length, label: t("photoExport.downloading") });
        }
      }),
    );

    setProgress({ done: photos.length, total: photos.length, label: t("photoExport.compressing") });
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Fotos_${sanitize(campaignName)}_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deletePhotos = async (photos: CollectedPhoto[]) => {
    setProgress({ done: 0, total: photos.length, label: t("photoExport.deleting") });

    const byBucket: Record<string, string[]> = {};
    photos.forEach((p) => {
      byBucket[p.bucket] = byBucket[p.bucket] || [];
      byBucket[p.bucket].push(p.path);
    });
    for (const [bucket, paths] of Object.entries(byBucket)) {
      for (let i = 0; i < paths.length; i += 100) {
        await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
      }
    }

    const installIds = photos.filter((p) => p.table === "installation_photos").map((p) => p.rowId);
    const occIds = photos.filter((p) => p.table === "occurrence_photos").map((p) => p.rowId);
    const chatIds = photos.filter((p) => p.table === "campaign_messages").map((p) => p.rowId);

    if (installIds.length) {
      for (let i = 0; i < installIds.length; i += 200) {
        await supabase.from("installation_photos").delete().in("id", installIds.slice(i, i + 200));
      }
    }
    if (occIds.length) {
      for (let i = 0; i < occIds.length; i += 200) {
        await supabase.from("occurrence_photos").delete().in("id", occIds.slice(i, i + 200));
      }
    }
    if (chatIds.length) {
      for (let i = 0; i < chatIds.length; i += 200) {
        await supabase
          .from("campaign_messages")
          .update({ image_url: null })
          .in("id", chatIds.slice(i, i + 200));
      }
    }
  };

  // ---- Flows ----

  const runDownloadOnly = async () => {
    if (!Object.values(scope).some(Boolean)) {
      toast.error(t("photoExport.selectAtLeastOne"));
      return;
    }
    setBusy(true);
    try {
      setProgress({ done: 0, total: 0, label: t("photoExport.collecting") });
      const { photos } = await collectPhotos(scope);
      if (photos.length === 0) {
        toast.info(t("photoExport.noPhotos"));
        return;
      }
      await buildAndDownloadZip(photos);
      toast.success(t("photoExport.filesZipped", { count: photos.length }));
      setOpen(false);
      reset();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("photoExport.operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const startDownloadAndDelete = async () => {
    if (!Object.values(scope).some(Boolean)) {
      toast.error(t("photoExport.selectAtLeastOne"));
      return;
    }
    setBusy(true);
    try {
      setProgress({ done: 0, total: 0, label: t("photoExport.collecting") });
      const { photos } = await collectPhotos(scope);
      if (photos.length === 0) {
        toast.info(t("photoExport.noPhotos"));
        return;
      }
      photosToProcessRef.current = photos;
      setConfirmDownloadDeleteCount(photos.length);
      setConfirmDownloadDeleteOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("photoExport.operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runDownloadAndDelete = async () => {
    const photos = photosToProcessRef.current;
    if (!photos || photos.length === 0) {
      toast.info(t("photoExport.noPhotos"));
      return;
    }
    setBusy(true);
    try {
      await buildAndDownloadZip(photos);
      toast.success(t("photoExport.filesZipped", { count: photos.length }));
      await deletePhotos(photos);
      toast.success(t("photoExport.filesDeleted", { count: photos.length }));
      setOpen(false);
      reset();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("photoExport.operationFailed"));
      throw e;
    } finally {
      setBusy(false);
      photosToProcessRef.current = null;
    }
  };

  const startDeleteAll = async () => {
    setBusy(true);
    try {
      const { photos } = await collectPhotos(ALL_SCOPE);
      if (photos.length === 0) {
        toast.info(t("photoExport.noPhotos"));
        return;
      }
      photosToProcessRef.current = photos;
      setConfirmDeleteAllCount(photos.length);
      setConfirmDeleteAllOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("photoExport.operationFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runDeleteAll = async () => {
    const photos = photosToProcessRef.current;
    if (!photos || photos.length === 0) {
      toast.info(t("photoExport.noPhotos"));
      return;
    }
    setBusy(true);
    try {
      await deletePhotos(photos);
      toast.success(t("photoExport.filesDeleted", { count: photos.length }));
      reset();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("photoExport.operationFailed"));
      throw e;
    } finally {
      setBusy(false);
      photosToProcessRef.current = null;
    }
  };

  const primaryLabel = deleteAfter
    ? t("photoExport.downloadAndDelete")
    : t("photoExport.downloadZip");

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {trigger ? (
          <span onClick={() => setOpen(true)}>{trigger}</span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={() => setOpen(true)}
          >
            <Camera className="w-3.5 h-3.5" /> {t("photoExport.trigger")}
          </Button>
        )}

        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={t("common.moreActions")}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void startDeleteAll()}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("photoExport.deleteAll")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AppDialog
        open={open}
        onOpenChange={(v) => {
          if (busy) return;
          setOpen(v);
          if (!v) reset();
        }}
      >
        <AppDialogHeader
          icon={<Download className="w-5 h-5 text-primary" />}
          title={t("photoExport.title")}
          description={t("photoExport.description")}
        />
        <AppDialogBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("photoExport.typesLabel")}
              </p>
              <div className="space-y-2">
                {[
                  { key: "installations" as const, label: t("photoExport.installations") },
                  { key: "checkin" as const, label: t("photoExport.checkin") },
                  { key: "occurrences" as const, label: t("photoExport.occurrences") },
                  { key: "chat" as const, label: t("photoExport.chat") },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={scope[opt.key]}
                      onCheckedChange={(v) => setScope((s) => ({ ...s, [opt.key]: !!v }))}
                      disabled={busy}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={deleteAfter}
                  onCheckedChange={(v) => setDeleteAfter(!!v)}
                  disabled={busy}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-medium text-destructive">
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    {t("photoExport.deleteAfter")}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5 break-words">
                    {t("photoExport.deleteAfterHint")}
                  </span>
                </span>
              </label>
            </div>

            {busy && progress.total > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{progress.label}</div>
                <Progress value={(progress.done / progress.total) * 100} />
                <div className="text-[11px] text-muted-foreground text-right">
                  {progress.done} / {progress.total}
                </div>
              </div>
            )}
            {busy && progress.total === 0 && (
              <div className="text-xs text-muted-foreground">
                {progress.label || t("photoExport.processing")}
              </div>
            )}
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={deleteAfter ? "destructive" : "default"}
            onClick={() => (deleteAfter ? void startDownloadAndDelete() : void runDownloadOnly())}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {primaryLabel}
              </>
            ) : (
              primaryLabel
            )}
          </Button>
        </AppDialogFooter>
      </AppDialog>

      <ConfirmDestructiveDialog
        open={confirmDownloadDeleteOpen}
        onOpenChange={(v) => {
          setConfirmDownloadDeleteOpen(v);
          if (!v) photosToProcessRef.current = null;
        }}
        title={t("photoExport.downloadAndDeleteTitle")}
        description={t("photoExport.downloadAndDeleteDescription")}
        confirmText={t("photoExport.downloadAndDeleteCount", {
          count: confirmDownloadDeleteCount,
        })}
        onConfirm={runDownloadAndDelete}
        isLoading={busy}
      />

      <ConfirmDestructiveDialog
        open={confirmDeleteAllOpen}
        onOpenChange={(v) => {
          setConfirmDeleteAllOpen(v);
          if (!v) photosToProcessRef.current = null;
        }}
        title={t("photoExport.deleteAllTitle")}
        description={t("photoExport.deleteAllDescription")}
        confirmText={t("photoExport.deleteAllConfirm", { count: confirmDeleteAllCount })}
        requireTyping="APAGAR"
        onConfirm={runDeleteAll}
        isLoading={busy}
      />
    </>
  );
}
