import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BUCKET = "installer-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
const QUICK_LABELS = ["ASO", "Certificado"];

export interface InstallerDocumentsSectionProps {
  teamId: string;
  memberId: string;
  canEdit: boolean;
}

interface InstallerDocument {
  id: string;
  label: string;
  file_path: string;
  file_name: string | null;
  created_at: string | null;
}

/** Lista e gerencia documentos (ASO, certificados) de um instalador já salvo. */
export function InstallerDocumentsSection({ teamId, memberId, canEdit }: InstallerDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const queryKey = ["installer_documents", memberId];

  const { data: docs = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<InstallerDocument[]> => {
      const { data, error } = await supabase
        .from("installer_documents")
        .select("id, label, file_path, file_name, created_at")
        .eq("member_id", memberId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo.");
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Informe o tipo/descrição do documento.");
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) throw new Error("Formato não permitido. Use PDF, JPG ou PNG.");
      if (file.size > MAX_BYTES) throw new Error("O arquivo excede 10 MB.");
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `${teamId}/${memberId}/${Date.now()}_${rand}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: auth } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("installer_documents").insert({
        member_id: memberId,
        label: trimmed,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        uploaded_by: auth.user?.id ?? null,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Documento anexado");
      setFile(null);
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao anexar documento"),
  });

  const remove = useMutation({
    mutationFn: async (doc: InstallerDocument) => {
      const { error: stErr } = await supabase.storage.from(BUCKET).remove([doc.file_path]);
      if (stErr) throw stErr;
      const { error } = await supabase.from("installer_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao excluir documento"),
  });

  const openDoc = async (doc: InstallerDocument) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o documento.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="w-full mt-1 rounded border border-border bg-background/60 p-2 space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
        <Paperclip className="w-3 h-3" /> Documentos (ASO, certificados)
      </p>
      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Carregando...</p>
      ) : docs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhum documento anexado.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-[11px]">
              <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{d.label}</span>
              <span className="text-muted-foreground truncate">{d.file_name}</span>
              {d.created_at && (
                <span className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] gap-1" onClick={() => openDoc(d)}>
                  <Download className="w-3 h-3" /> Ver/Baixar
                </Button>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-destructive"
                    aria-label="Excluir documento"
                    disabled={remove.isPending}
                    onClick={() => { if (window.confirm(`Excluir o documento "${d.label}"?`)) remove.mutate(d); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Tipo/descrição"
            className="h-7 text-xs w-36"
          />
          {QUICK_LABELS.map((q) => (
            <Button key={q} type="button" size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setLabel(q)}>
              {q}
            </Button>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,.jpg,.jpeg,.png,image/jpeg,image/png"
            className="text-[11px] max-w-[200px]"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button size="sm" className="h-7 text-xs gap-1" disabled={!file || !label.trim() || upload.isPending} onClick={() => upload.mutate()}>
            <Upload className="w-3 h-3" /> {upload.isPending ? "Enviando..." : "Adicionar documento"}
          </Button>
        </div>
      )}
    </div>
  );
}
