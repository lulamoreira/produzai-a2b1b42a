import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, Import, ChevronRight, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportSpecFromCampaignProps {
  clientId: string;
  currentCampaignId: string;
  onImport: (data: { specification: string; size: string }) => void;
}

type CampaignOption = { id: string; name: string };
type PieceOption = { id: string; name: string; code: number; size: string; specification: string };

export default function ImportSpecFromCampaign({ clientId, currentCampaignId, onImport }: ImportSpecFromCampaignProps) {
  const [open, setOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignOption | null>(null);
  const [search, setSearch] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["import-spec-campaigns", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("client_id", clientId)
        .neq("id", currentCampaignId)
        .order("created_at", { ascending: false });
      return (data || []) as CampaignOption[];
    },
    enabled: open && !!clientId,
  });

  const { data: pieces = [] } = useQuery({
    queryKey: ["import-spec-pieces", selectedCampaign?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_pieces")
        .select("id, name, code, size, specification")
        .eq("campaign_id", selectedCampaign!.id)
        .order("code");
      return (data || []) as PieceOption[];
    },
    enabled: !!selectedCampaign,
  });

  const filtered = search
    ? pieces.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || String(p.code).includes(search))
    : pieces;

  const handleSelect = (piece: PieceOption) => {
    onImport({ specification: piece.specification, size: piece.size });
    setOpen(false);
    setSelectedCampaign(null);
    setSearch("");
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setSelectedCampaign(null);
      setSearch("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <Import className="w-3 h-3" /> Importar de campanha
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {!selectedCampaign ? (
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Selecione a campanha</p>
            <ScrollArea className="max-h-48">
              {campaigns.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma campanha anterior encontrada.</p>
              ) : (
                <div className="space-y-1">
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCampaign(c)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors text-left"
                    >
                      <span className="truncate">{c.name}</span>
                      <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedCampaign(null); setSearch(""); }}>
                <ArrowLeft className="w-3 h-3" />
              </Button>
              <p className="text-xs font-semibold text-foreground truncate">{selectedCampaign.name}</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Buscar peça..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs pl-7"
              />
            </div>
            <ScrollArea className="max-h-48">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma peça encontrada.</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors space-y-0.5"
                    >
                      <div className="font-medium text-foreground">{p.code} — {p.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.size} · {p.specification}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
