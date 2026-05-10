// Componente padrão de dialog do ProduzAI. Ver app-dialog.README.md.
// Não usar shadcn Dialog diretamente — usar este wrapper.
import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AppDialog,
  AppDialogHeader,
  AppDialogBody,
  AppDialogFooter,
} from "@/components/ui/app-dialog";

interface ConfirmDestructiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void | Promise<void>;
  requireTyping?: string;
  isLoading?: boolean;
}

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  requireTyping,
  isLoading,
}: ConfirmDestructiveDialogProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = React.useState("");
  const [internalLoading, setInternalLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTyped("");
      setInternalLoading(false);
    }
  }, [open]);

  const loading = isLoading || internalLoading;
  const typingOk = !requireTyping || typed === requireTyping;
  const canConfirm = typingOk && !loading;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setInternalLoading(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <AppDialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <AppDialogHeader
        icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
        title={title}
        description={description}
      />
      {requireTyping ? (
        <AppDialogBody>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("common.typeToConfirm", "Digite")}{" "}
              <strong className="text-foreground">{requireTyping}</strong>{" "}
              {t("common.toConfirm", "para confirmar")}
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTyping}
              autoComplete="off"
              autoFocus
            />
          </div>
        </AppDialogBody>
      ) : null}
      <AppDialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          {t("common.cancel", "Cancelar")}
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {confirmText}
            </>
          ) : (
            confirmText
          )}
        </Button>
      </AppDialogFooter>
    </AppDialog>
  );
}
