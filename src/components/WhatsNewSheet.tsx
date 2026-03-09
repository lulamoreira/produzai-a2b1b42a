import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Bug, Zap, Bell } from "lucide-react";
import { changelog, type ChangelogEntry } from "@/data/changelog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STORAGE_KEY = "whats-new-last-seen";

const typeConfig: Record<
  ChangelogEntry["type"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  feature: {
    label: "Novo",
    icon: <Sparkles className="w-3 h-3" />,
    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  },
  fix: {
    label: "Correção",
    icon: <Bug className="w-3 h-3" />,
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  improvement: {
    label: "Melhoria",
    icon: <Zap className="w-3 h-3" />,
    className: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  },
};

export function useUnreadCount() {
  const lastSeen = localStorage.getItem(STORAGE_KEY);
  return useMemo(() => {
    if (!lastSeen) return changelog.length;
    return changelog.filter((e) => e.date > lastSeen).length;
  }, [lastSeen]);
}

export function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (!lastSeen) {
      setUnread(changelog.length);
    } else {
      setUnread(changelog.filter((e) => e.date > lastSeen).length);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (changelog.length > 0) {
      localStorage.setItem(STORAGE_KEY, changelog[0].date);
    }
    setUnread(0);
  };

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:gap-1 bg-white text-[#1e3a5f] border-white/80 shadow-lg shadow-black/20 hover:bg-white/90 hover:text-[#1e3a5f] relative"
        onClick={handleOpen}
      >
        <Bell className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs font-semibold">Novidades</span>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md animate-pulse">
            {unread}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[380px] sm:w-[420px] p-0 flex flex-col">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-primary" />
              Novidades do Sistema
            </SheetTitle>
            <SheetDescription className="text-xs">
              Últimas atualizações e melhorias do Produz.aí
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 px-5 py-3">
            <div className="space-y-4 pb-4">
              {changelog.map((entry) => {
                const config = typeConfig[entry.type];
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border p-3.5 space-y-2 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${config.className}`}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(entry.date), "dd 'de' MMM, yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold leading-tight">
                      {entry.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {entry.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
