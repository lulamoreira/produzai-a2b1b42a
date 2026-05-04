import { useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Camera, Download, Trash2, AlertTriangle } from "lucide-react";
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
  folder: string; // top-level folder in zip
  storeFolder?: string;
  table: "installation_photos" | "occurrence_photos" | "campaign_messages";
  rowId: string;
  category?: string;
};

function sanitize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60) || "sem_nome";
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
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>({
    installations: true,
    checkin: true,
    occurrences: true,
    chat: true,
  });
  const [deleteAfter, setDeleteAfter] = useState(false);
  const [deleteOnly, setDeleteOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const reset = () => {
    setProgress({ done: 0, total: 0, label: "" });
    setConfirmText("");
    setConfirmOpen(false);
    setDeleteOnly(false);
  };

  const collectPhotos = async (): Promise<{ photos: CollectedPhoto[]; storeMap: Record<string, string> }> => {
    const photos: CollectedPhoto[] = [];

    // Build store map for foldering
    const { data: stores } = await supabase
      .from("client_stores")
      .select("id, name, nickname, store_code")
      .in(
        "id",
        // We don't have direct list — fetch via campaign relations below; use empty fallback
        (await (async () => {
          const ids = new Set<string>();
          const r1 = await supabase.from("installation_photos").select("store_id").eq("campaign_id", campaignId);
          r1.data?.forEach((x: any) => x.store_id && ids.add(x.store_id));
          const r2 = await supabase.from("occurrences").select("store_id").eq("campaign_id", campaignId);
          r2.data?.forEach((x: any) => x.store_id && ids.add(x.store_id));
          return Array.from(ids);
        })()) as string[]
      );
    const storeMap: Record<string, string> = {};
    (stores || []).forEach((s: any) => {
      storeMap[s.id] = sanitize(s.nickname || s.name || s.store_code || s.id);
    });

    if (scope.installations || scope.checkin) {
      const { data } = await supabase
        .from("installation_photos")
        .select("id, photo_url, category, store_id")
        .eq("campaign_id", campaignId);
      (data || []).forEach((p: any) => {
        const isCheckin = p.category === "checkin";
        if (isCheckin && !scope.checkin) return;
        if (!isCheckin && !scope.installations) return;
        const parsed = parseStoragePath(p.photo_url);
        if (!parsed) return;
        const folder = isCheckin ? "Check-in" : "Instalacoes";
        const storeFolder = storeMap[p.store_id] || "Loja_Desconhecida";
        photos.push({
          url: p.photo_url,
          bucket: parsed.bucket,
          path: parsed.path,
          folder,
          storeFolder,
          table: "installation_photos",
          rowId: p.id,
          category: p.category,
        });
      });
    }

    if (scope.occurrences) {
      const { data: occs } = await supabase
        .from("occurrences")
        .select("id, store_id")
        .eq("campaign_id", campaignId);
      const occIds = (occs || []).map((o: any) => o.id);
      const occStoreMap: Record<string, string> = {};
      (occs || []).forEach((o: any) => {
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

    if (scope.chat) {
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

    return { photos, storeMap };
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
          setProgress({ done, total: photos.length, label: "Baixando arquivos..." });
        }
      })
    );

    setProgress({ done: photos.length, total: photos.length, label: "Compactando..." });
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
    setProgress({ done: 0, total: photos.length, label: "Excluindo arquivos..." });

    // Group by bucket for storage removal
    const byBucket: Record<string, string[]> = {};
    photos.forEach((p) => {
      byBucket[p.bucket] = byBucket[p.bucket] || [];
      byBucket[p.bucket].push(p.path);
    });
    for (const [bucket, paths] of Object.entries(byBucket)) {
      // Remove in chunks of 100
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        await supabase.storage.from(bucket).remove(chunk);
      }
    }

    // Delete DB rows / null out chat columns
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
        await supabase.from("campaign_messages").update({ image_url: null }).in("id", chatIds.slice(i, i + 200));
      }
    }

    setProgress({ done: photos.length, total: photos.length, label: "Concluído" });
  };

  const handleStart = (mode: "download" | "downloadDelete" | "deleteOnly" = "download") => {
    if (!Object.values(scope).some(Boolean)) {
      toast.error("Selecione ao menos um tipo de foto");
      return;
    }
    setDeleteOnly(mode === "deleteOnly");
    setDeleteAfter(mode === "downloadDelete");
    if (mode === "deleteOnly" || mode === "downloadDelete") {
      setConfirmOpen(true);
    } else {
      void run();
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      setProgress({ done: 0, total: 0, label: "Coletando fotos..." });
      const { photos } = await collectPhotos();
      if (photos.length === 0) {
        toast.info("Nenhuma foto encontrada para o escopo selecionado.");
        setBusy(false);
        return;
      }
      if (!deleteOnly) {
        await buildAndDownloadZip(photos);
        toast.success(`${photos.length} arquivo(s) compactados em ZIP`);
      }

      if (deleteAfter || deleteOnly) {
        await deletePhotos(photos);
        toast.success(`${photos.length} foto(s) excluídas do sistema`);
      }
      setOpen(false);
      reset();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha na operação");
    } finally {
      setBusy(false);
    }
  };

  const expectedConfirm = campaignName.trim();
  const confirmValid = confirmText.trim().toLowerCase() === expectedConfirm.toLowerCase();

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) reset(); } }}>
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
              <Camera className="w-3.5 h-3.5" /> Exportar fotos
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Exportar fotos da campanha
            </DialogTitle>
            <DialogDescription>
              Baixe todas as fotos em um único arquivo ZIP, organizadas por tipo e loja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipos de fotos
              </Label>
              <div className="space-y-2">
                {[
                  { key: "installations" as const, label: "Fotos de Instalação" },
                  { key: "checkin" as const, label: "Fotos de Check-in" },
                  { key: "occurrences" as const, label: "Fotos de Ocorrências" },
                  { key: "chat" as const, label: "Imagens do Chat" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
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
                />
                <span>
                  <span className="flex items-center gap-1 font-medium text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Apagar do sistema após download
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    As fotos serão excluídas permanentemente do banco de dados e do armazenamento. Esta ação não pode ser desfeita.
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
              <div className="text-xs text-muted-foreground">{progress.label || "Processando..."}</div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => handleStart("deleteOnly")}
                disabled={busy}
                className="gap-1.5 sm:mr-auto"
              >
                <Trash2 className="w-4 h-4" />
                Apagar todas (sem baixar)
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={() => handleStart(deleteAfter ? "downloadDelete" : "download")} disabled={busy}>
              {busy ? "Processando..." : deleteAfter ? "Baixar e apagar" : "Baixar ZIP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !busy && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Confirmar exclusão permanente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Após o download, todas as fotos selecionadas serão <strong>excluídas permanentemente</strong> do sistema. Esta ação não pode ser desfeita.
                </p>
                <p>
                  Para confirmar, digite o nome da campanha: <strong>{expectedConfirm}</strong>
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite o nome da campanha"
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmValid || busy}
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                void run();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Baixar e apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
