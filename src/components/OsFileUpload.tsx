import { useRef, useState } from "react";
import { Paperclip, Loader2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "schedule-os-files";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

interface Props {
  campaignId: string;
  storeId: string;
  filePath: string | null;
  disabled?: boolean;
  onChange: (path: string | null) => void;
}

/**
 * Upload/visualização do arquivo da OS (imagem ou PDF) enviada pelo lojista.
 * Bucket privado: a visualização usa URL assinada de curta duração.
 */
export default function OsFileUpload({ campaignId, storeId, filePath, disabled, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast.error("Envie uma imagem ou um PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo maior que 10 MB.");
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] || (isPdf ? ".pdf" : ".jpg");
      const path = `${campaignId}/${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      onChange(path);
      toast.success("Arquivo da OS anexado.");
    } catch (err) {
      console.error("OS file upload error:", err);
      toast.error("Erro ao enviar o arquivo da OS.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleView = async () => {
    if (!filePath) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) throw error || new Error("sem URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("OS file view error:", err);
      toast.error("Não foi possível abrir o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!filePath) return;
    setBusy(true);
    try {
      await supabase.storage.from(BUCKET).remove([filePath]);
      onChange(null);
      toast.success("Arquivo da OS removido.");
    } catch (err) {
      console.error("OS file remove error:", err);
      toast.error("Erro ao remover o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      {filePath ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary"
            title="Ver arquivo da OS"
            disabled={busy}
            onClick={handleView}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Remover arquivo da OS"
              disabled={busy}
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </>
      ) : (
        !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            title="Anexar imagem/PDF da OS"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        )
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
