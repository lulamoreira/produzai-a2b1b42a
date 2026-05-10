import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePaginate } from "@/lib/supabasePaginate";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Search, Import, ChevronRight, ArrowLeft, Boxes, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportSpecFromCampaignProps {
  clientId: string;
  currentCampaignId: string;
  onImport: (data: { specification: string; size: string }) => void;
}

type CampaignOption = { id: string; name: string };
type PieceOption = { id: string; name: string; code: number; size: string; specification: string; kit_only: boolean };
type KitOption = { id: string; name: string; code: number };

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
      return supabasePaginate<PieceOption>((from, to) =>
        supabase
          .from("campaign_pieces")
          .select("id, name, code, size, specification, kit_only")
          .eq("campaign_id", selectedCampaign!.id)
          .order("code")
          .range(from, to) as any
      );
    },
    enabled: !!selectedCampaign,
  });

  const { data: kits = [] } = useQuery({
    queryKey: ["import-spec-kits", selectedCampaign?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_kits")
        .select("id, name, code")
        .eq("campaign_id", selectedCampaign!.id)
        .order("code");
      return (data || []) as KitOption[];
    },
    enabled: !!selectedCampaign,
  });

  const { data: kitPieceLinks = [] } = useQuery({
    queryKey: ["import-spec-kit-pieces", selectedCampaign?.id],
    queryFn: async () => {
      const kitIds = kits.map((k) => k.id);
      if (kitIds.length === 0) return [];
      const { data } = await supabase
        .from("campaign_kit_pieces")
        .select("kit_id, piece_id")
        .in("kit_id", kitIds);
      return (data || []) as { kit_id: string; piece_id: string }[];
    },
    enabled: kits.length > 0,
  });

  // Build grouped list: standalone pieces + kits with their pieces
  const { standalonePieces, kitGroups } = useMemo(() => {
    const kitPieceIds = new Set(kitPieceLinks.map((kp) => kp.piece_id));
    const standalone = pieces.filter((p) => !kitPieceIds.has(p.id));

    const groups = kits.map((kit) => {
      const memberIds = kitPieceLinks.filter((kp) => kp.kit_id === kit.id).map((kp) => kp.piece_id);
      const members = pieces.filter((p) => memberIds.includes(p.id));
      return { kit, members };
    });

    return { standalonePieces: standalone, kitGroups: groups };
  }, [pieces, kits, kitPieceLinks]);

  // Filter by search
  const filteredStandalone = search
    ? standalonePieces.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || String(p.code).includes(search))
    : standalonePieces;

  const filteredKitGroups = search
    ? kitGroups
        .map((g) => ({
          ...g,
          members: g.members.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || String(p.code).includes(search)),
          kitMatches: g.kit.name.toLowerCase().includes(search.toLowerCase()) || String(g.kit.code).includes(search),
        }))
        .filter((g) => g.kitMatches || g.members.length > 0)
    : kitGroups.map((g) => ({ ...g, kitMatches: true }));

  const hasResults = filteredStandalone.length > 0 || filteredKitGroups.length > 0;

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
          <Import className="w-3 h-3" /> Importar de outra campanha
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {!selectedCampaign ? (
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Selecione a campanha</p>
            <ScrollArea className="h-48">
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
                placeholder="Buscar peça ou kit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs pl-7"
              />
            </div>
            <ScrollArea className="h-56">
              {!hasResults ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum item encontrado.</p>
              ) : (
                <div className="space-y-1">
                  {/* Standalone pieces */}
                  {filteredStandalone.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors space-y-0.5"
                    >
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                        {p.code} — {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground pl-[18px]">
                        {p.size} · {p.specification}
                      </div>
                    </button>
                  ))}

                  {/* Kit groups */}
                  {filteredKitGroups.map((group) => (
                    <div key={group.kit.id}>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1e3a5f] rounded-md mx-0 mt-1">
                        <Boxes className="w-3.5 h-3.5 shrink-0" />
                        Kit {group.kit.code} — {group.kit.name}
                      </div>
                      {group.members.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelect(p)}
                          className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted transition-colors space-y-0.5 border-l-2 border-[#1e3a5f]/30 ml-2"
                        >
                          <div className="font-medium text-foreground pl-1">{p.code} — {p.name}</div>
                          <div className="text-[10px] text-muted-foreground pl-1">
                            {p.size} · {p.specification}
                          </div>
                        </button>
                      ))}
                    </div>
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
