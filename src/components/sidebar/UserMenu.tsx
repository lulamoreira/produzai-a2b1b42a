import { type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import {
  USER_MENU_ITEMS, USER_ICONS, filterByPermission, type UserMenuAction,
} from "@/lib/sidebarRegistry";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAction: (action: UserMenuAction) => void;
  trigger: ReactNode;
}

export function UserMenu({ open, onOpenChange, onAction, trigger }: Props) {
  const isMobile = useIsMobile();
  const { isAdmin, isMaster } = useUserRole();
  const { isLimited } = useUserDirectAccess();

  const items = filterByPermission(USER_MENU_ITEMS, {
    isAdmin, isMaster, isLimited, hasCampaignAccess: true,
  });

  const handle = (a: UserMenuAction) => {
    onOpenChange(false);
    // defer so popover/sheet close animation doesn't fight a new dialog
    setTimeout(() => onAction(a), 50);
  };

  const itemsList = (
    <div className="py-1">
      {items.map((item, idx) => {
        const Icon = USER_ICONS[item.icon];
        const isSignOut = item.action === "sign_out";
        return (
          <div key={item.key}>
            {isSignOut && idx > 0 && (
              <div className="my-1 -mx-1 h-px bg-border" />
            )}
            <button
              type="button"
              onClick={() => handle(item.action)}
              className={`w-full flex items-center gap-2.5 px-3 min-h-[44px] text-sm rounded-md transition-colors ${
                item.variant === "destructive"
                  ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  : "hover:bg-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-muted-foreground tracking-wider">
                  {item.shortcut}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <span onClick={() => onOpenChange(true)}>{trigger}</span>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="text-base">Conta</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{itemsList}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-64 p-1"
      >
        {itemsList}
      </PopoverContent>
    </Popover>
  );
}
