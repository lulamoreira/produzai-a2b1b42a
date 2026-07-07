import { useMemo, useRef, useState } from "react";
import { Target, Users, ImageIcon, Film, Video, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BriefingHeader from "@/components/briefing/BriefingHeader";
import BriefingSection from "@/components/briefing/BriefingSection";
import BriefingMediaGrid from "@/components/briefing/BriefingMediaGrid";
import BriefingUploadDropzone from "@/components/briefing/BriefingUploadDropzone";
import BriefingVideoPlayer from "@/components/briefing/BriefingVideoPlayer";
import BriefingVideoComments from "@/components/briefing/BriefingVideoComments";
import BriefingVideoNoteRecorder from "@/components/briefing/BriefingVideoNoteRecorder";
import {
  useBriefing,
  type BriefingMedia,
  type BriefingMediaKind,
  type BriefingSectionKey,
} from "@/hooks/useBriefing";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { compressImage } from "@/lib/compressImage";

interface Props { campaignId: string }

const detectKind = (file: File): BriefingMediaKind => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
};

const BriefingTab = ({ campaignId }: Props) => {
  const {
    briefing, isLoading, sectionsByKey, mediaBySection,
    upsertSection, updateBriefing, addEmbed, uploadFile, deleteMedia,
  } = useBriefing(campaignId);

  const { isAdmin, isMaster } = useUserRole();
  const { data: authData } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const currentUserId = authData?.id ?? null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedVideoBriefId, setSelectedVideoBriefId] = useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);

  const body = (k: BriefingSectionKey) => sectionsByKey.get(k)?.body ?? "";
  const media = (k: BriefingSectionKey) => mediaBySection.get(k) ?? [];

  const canDeleteMedia = (m: BriefingMedia) =>
    isAdmin || isMaster || m.uploaded_by === currentUserId;

  const commitSection = (key: BriefingSectionKey, v: string) =>
    upsertSection.mutate({ key, body: v });

  const handleUpload = async (sectionKey: BriefingSectionKey, file: File, kind: BriefingMediaKind) => {
    let toUpload: File | Blob = file;
    let fileName = file.name;
    if (kind === "image") {
      try {
        const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 });
        if (compressed) { toUpload = compressed; fileName = file.name.replace(/\.\w+$/, "") + ".jpg"; }
      } catch { /* keep original */ }
    }
    await uploadFile.mutateAsync({ sectionKey, file: toUpload, fileName, kind });
  };

  const videoBriefs = media("video_brief");
  const activeVideo = useMemo(
    () => videoBriefs.find((v) => v.id === selectedVideoBriefId) ?? videoBriefs[0],
    [videoBriefs, selectedVideoBriefId],
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground italic">Carregando briefing...</div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <BriefingHeader
        briefing={briefing}
        canEditStatus={isAdmin || isMaster}
        onStatusChange={(status) => updateBriefing.mutate({ status })}
        onDeadlineChange={(deadline) => updateBriefing.mutate({ deadline })}
      />

      <BriefingSection
        icon={Target}
        title="Objetivo da campanha"
        description="O que essa campanha precisa comunicar e alcançar?"
        color="#8C6F4E"
        body={body("objective")}
        onBodyChange={(v) => commitSection("objective", v)}
        placeholder="Descreva o objetivo, KPIs e mensagem principal..."
      />

      <BriefingSection
        icon={Users}
        title="Público-alvo"
        description="Para quem estamos falando?"
        color="#6B4F2E"
        body={body("audience")}
        onBodyChange={(v) => commitSection("audience", v)}
        placeholder="Perfil demográfico, comportamento, canais preferidos..."
      />

      <BriefingSection
        icon={ImageIcon}
        title="Referências visuais"
        description="Moodboard, inspirações, exemplos que gostamos."
        color="#7B5E3A"
        body={body("refs")}
        onBodyChange={(v) => commitSection("refs", v)}
        placeholder="Observações sobre estilo, paleta, referências..."
      >
        <BriefingMediaGrid
          items={media("refs")}
          onDelete={(m) => deleteMedia.mutate(m)}
          canDelete={canDeleteMedia}
        />
        <BriefingUploadDropzone
          sectionKey="refs"
          accept="image/*"
          label="Adicionar imagens de referência"
          detectKind={() => "image"}
          allowEmbed
          onUpload={(f, k) => handleUpload("refs", f, k)}
          onEmbed={(url, thumb, title, kind) => addEmbed.mutateAsync({ sectionKey: "refs", externalUrl: url, thumbnailUrl: thumb, title, kind })}
        />
      </BriefingSection>

      <BriefingSection
        icon={Film}
        title="Vídeo-brief"
        description="Vídeo principal explicando a campanha. Comente em pontos específicos do tempo."
        color="#5A6B7A"
        body={body("video_brief")}
        onBodyChange={(v) => commitSection("video_brief", v)}
        placeholder="Contexto sobre o vídeo, roteiro, decisões..."
      >
        {videoBriefs.length > 0 && activeVideo && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-2">
              {videoBriefs.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {videoBriefs.map((v) => (
                    <Button
                      key={v.id}
                      size="sm"
                      variant={activeVideo.id === v.id ? "default" : "outline"}
                      onClick={() => setSelectedVideoBriefId(v.id)}
                    >
                      {v.title ?? "Vídeo"}
                    </Button>
                  ))}
                </div>
              )}
              <BriefingVideoPlayer ref={videoRef} media={activeVideo} />
              <BriefingMediaGrid
                items={[activeVideo]}
                variant="list"
                onDelete={(m) => { deleteMedia.mutate(m); setSelectedVideoBriefId(null); }}
                canDelete={canDeleteMedia}
              />
            </div>
            <div className="lg:col-span-2 rounded-lg border border-border bg-card p-3 max-h-[520px] flex flex-col">
              {activeVideo.kind === "embed" ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Comentários com marcação de tempo só funcionam em vídeos enviados (não em embeds do YouTube/Vimeo).
                </p>
              ) : (
                <BriefingVideoComments
                  mediaId={activeVideo.id}
                  videoRef={videoRef}
                  canDelete={(authorId) => isAdmin || isMaster || authorId === currentUserId}
                  currentUserId={currentUserId}
                />
              )}
            </div>
          </div>
        )}

        <BriefingUploadDropzone
          sectionKey="video_brief"
          accept="video/*"
          label="Enviar vídeo-brief"
          multiple={false}
          detectKind={() => "video"}
          allowEmbed
          onUpload={(f, k) => handleUpload("video_brief", f, k)}
          onEmbed={(url, thumb, title, kind) => addEmbed.mutateAsync({ sectionKey: "video_brief", externalUrl: url, thumbnailUrl: thumb, title, kind })}
        />
      </BriefingSection>

      <BriefingSection
        icon={Video}
        title="Vídeo-notas"
        description="Grave uma nota rápida (câmera ou tela) explicando algum detalhe."
        color="#7A6A8C"
        body={body("video_notes")}
        onBodyChange={(v) => commitSection("video_notes", v)}
        placeholder="Instruções ou índice das notas..."
      >
        <div className="flex justify-start">
          <Button onClick={() => setRecorderOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Gravar nova nota
          </Button>
        </div>
        <BriefingMediaGrid
          items={media("video_notes")}
          onDelete={(m) => deleteMedia.mutate(m)}
          canDelete={canDeleteMedia}
        />
      </BriefingSection>

      <BriefingSection
        icon={Paperclip}
        title="Anexos"
        description="PDFs, apresentações, planilhas, arquivos extras."
        color="#6B5B4E"
        body={body("attachments")}
        onBodyChange={(v) => commitSection("attachments", v)}
        placeholder="Descreva o que cada anexo contém..."
      >
        <BriefingMediaGrid
          items={media("attachments")}
          variant="list"
          onDelete={(m) => deleteMedia.mutate(m)}
          canDelete={canDeleteMedia}
        />
        <BriefingUploadDropzone
          sectionKey="attachments"
          accept="*/*"
          label="Anexar arquivos"
          detectKind={detectKind}
          onUpload={(f, k) => handleUpload("attachments", f, k)}
        />
      </BriefingSection>

      <BriefingVideoNoteRecorder
        open={recorderOpen}
        onOpenChange={setRecorderOpen}
        onUpload={async (blob, fileName, duration) => {
          await uploadFile.mutateAsync({
            sectionKey: "video_notes",
            file: blob,
            fileName,
            kind: "video",
            durationSec: duration,
            title: `Nota de ${new Date().toLocaleString("pt-BR")}`,
          });
        }}
      />
    </div>
  );
};

export default BriefingTab;
