import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, Megaphone, Store } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { onOpenGlobalSearch } from "@/lib/globalSearchBus";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["global-search-campaigns"],
    enabled: open && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, client_id, clients(id, name, agency_id, agencies(name))")
        .order("created_at", { ascending: false })
        .limit(80);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["global-search-clients"],
    enabled: open && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, agency_id, agencies(name)")
        .order("name", { ascending: true })
        .limit(80);
      return data ?? [];
    },
  });

  const { data: agencies = [] } = useQuery({
    queryKey: ["global-search-agencies"],
    enabled: open && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(40);
      return data ?? [];
    },
  });

  const handleSelect = (route: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(route);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl overflow-hidden gap-0">
        <Command>
          <CommandInput
            placeholder="Buscar campanhas, clientes, agências…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>Nenhum resultado.</CommandEmpty>

            {campaigns.length > 0 && (
              <CommandGroup heading="Campanhas">
                {campaigns.map((c: any) => {
                  const cli = c.clients;
                  const agencyId = cli?.agency_id;
                  if (!agencyId || !c.client_id) return null;
                  return (
                    <CommandItem
                      key={`camp-${c.id}`}
                      value={`campanha ${c.name} ${cli?.name ?? ""} ${cli?.agencies?.name ?? ""}`}
                      onSelect={() =>
                        handleSelect(`/agency/${agencyId}/clients/${c.client_id}/campaigns/${c.id}`)
                      }
                      className="gap-2 min-h-[44px]"
                    >
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground truncate max-w-[40%]">
                        {cli?.agencies?.name} › {cli?.name}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {clients.length > 0 && (
              <CommandGroup heading="Clientes">
                {clients.map((c: any) => (
                  <CommandItem
                    key={`cli-${c.id}`}
                    value={`cliente ${c.name} ${c.agencies?.name ?? ""}`}
                    onSelect={() => handleSelect(`/agency/${c.agency_id}/clients/${c.id}`)}
                    className="gap-2 min-h-[44px]"
                  >
                    <Megaphone className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground truncate">
                      {c.agencies?.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {agencies.length > 0 && (
              <CommandGroup heading="Agências">
                {agencies.map((a: any) => (
                  <CommandItem
                    key={`ag-${a.id}`}
                    value={`agencia ${a.name}`}
                    onSelect={() => handleSelect(`/agency/${a.id}`)}
                    className="gap-2 min-h-[44px]"
                  >
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mounts <GlobalSearch /> globally and wires:
 *   - ⌘K / Ctrl+K to toggle
 *   - the global event bus (openGlobalSearch())
 */
export function GlobalSearchMount() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    const off = onOpenGlobalSearch(() => setOpen(true));
    return () => {
      window.removeEventListener("keydown", onKey);
      off();
    };
  }, []);

  return <GlobalSearch open={open} onOpenChange={setOpen} />;
}
