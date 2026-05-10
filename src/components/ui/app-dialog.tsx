// Componente padrão de dialog do ProduzAI. Ver app-dialog.README.md.
// Não usar shadcn Dialog diretamente — usar este wrapper.
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";

interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function AppDialog({ open, onOpenChange, children, className }: AppDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-[min(560px,calc(100vw-2rem))] max-h-[min(640px,calc(100vh-2rem))]",
            "flex flex-col overflow-hidden p-0 border bg-background shadow-lg sm:rounded-lg",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
        >
          {children}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={t("common.close", "Fechar")}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.close", "Fechar")}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

interface AppDialogHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function AppDialogHeader({ title, description, icon, className }: AppDialogHeaderProps) {
  return (
    <div className={cn("p-6 pb-4 flex items-start gap-3", className)}>
      {icon ? <div className="shrink-0 mt-0.5">{icon}</div> : null}
      <div className="min-w-0 flex-1 pr-8">
        <DialogPrimitive.Title className="font-semibold text-lg leading-snug break-words">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="text-sm text-muted-foreground break-words mt-1">
            {description}
          </DialogPrimitive.Description>
        ) : null}
      </div>
    </div>
  );
}

interface AppDialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function AppDialogBody({ children, className }: AppDialogBodyProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-2", className)}>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface AppDialogFooterProps {
  children?: React.ReactNode;
  destructiveAction?: React.ReactNode;
  className?: string;
}

export function AppDialogFooter({ children, destructiveAction, className }: AppDialogFooterProps) {
  if (import.meta.env.DEV) {
    const total =
      React.Children.count(children) + (destructiveAction ? 1 : 0);
    if (total > 3) {
      // eslint-disable-next-line no-console
      console.warn(
        `[AppDialogFooter] mais de 3 ações no footer (${total}). Reduza para evitar sobrecarga visual.`,
      );
    }
  }
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 p-6 pt-4 border-t sm:flex-row sm:justify-end sm:items-center",
        className,
      )}
    >
      {destructiveAction ? (
        <div className="sm:mr-auto">{destructiveAction}</div>
      ) : null}
      {children}
    </div>
  );
}
