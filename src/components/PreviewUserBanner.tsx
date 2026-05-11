import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewUser } from "@/hooks/usePreviewUser";

export const PreviewUserBanner = () => {
  const { previewUserId, previewUserName, exitPreview } = usePreviewUser();
  if (!previewUserId) return null;
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow">
      <Eye className="w-4 h-4" />
      <span>
        Modo Preview — visualizando como <strong>{previewUserName || previewUserId.slice(0, 8)}</strong>. Os dados ainda
        respeitam suas permissões reais.
      </span>
      <Button size="sm" variant="ghost" onClick={exitPreview} className="h-7 gap-1 text-amber-950 hover:bg-amber-600/30">
        <X className="w-3.5 h-3.5" /> Sair
      </Button>
    </div>
  );
};
