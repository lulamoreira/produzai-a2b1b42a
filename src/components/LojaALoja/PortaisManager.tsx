import { useMemo, useState } from "react";
import { useLojaALojaLojas } from "@/hooks/useLojaALoja";
import {
  useStorePortalTokens,
  useGenerateStoreToken,
  useDeleteStoreToken,
  useGenerateAllStoreTokens,
} from "@/hooks/useStorePortalTokens";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, MessageCircle, Trash2, Plus, LinkIcon, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

interface Props {
  campaignId: string;
  clientId: string;
  isAdmin: boolean;
}

type SortField = "name" | "city" | "state" | "status";
type SortDir = "asc" | "desc" | null;

export default function PortaisManager({ campaignId, clientId, isAdmin }: Props) {
  const { data: lojas = [] } = useLojaALojaLojas(campaignId);
  const { data: tokens = [], isLoading } = useStorePortalTokens(campaignId);
  const generateToken = useGenerateStoreToken();
  const deleteToken = useDeleteStoreToken();
  const generateAll = useGenerateAllStoreTokens();

  const [sortField, setSortField] = useState<SortField | null>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const storeIds = useMemo(() => [...new Set(lojas.filter((l) => l.ativo).map((l) => l.store_id))], [lojas]);

  const { data: stores = [] } = useQuery({
    queryKey: ["portal-stores", clientId, storeIds],
    enabled: storeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_stores")
        .select("id, name, city, state, store_code")
        .in("id", storeIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tokenMap = useMemo(() => {
    const map = new Map<string, (typeof tokens)[0]>();
    tokens.forEach((t) => map.set(t.store_id, t));
    return map;
  }, [tokens]);

  const sortedStores = useMemo(() => {
    if (!sortField || !sortDir) return stores;
    return [...stores].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortField === "name") {
        va = (a.store_code ? `${a.store_code} ${a.name}` : a.name).toLowerCase();
        vb = (b.store_code ? `${b.store_code} ${b.name}` : b.name).toLowerCase();
      } else if (sortField === "city") {
        va = (a.city || "").toLowerCase();
        vb = (b.city || "").toLowerCase();
      } else if (sortField === "state") {
        va = (a.state || "").toLowerCase();
        vb = (b.state || "").toLowerCase();
      } else if (sortField === "status") {
        // generated (true) sorts before pending (false) in asc
        va = tokenMap.has(a.id) ? 0 : 1;
        vb = tokenMap.has(b.id) ? 0 : 1;
      }
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [stores, sortField, sortDir, tokenMap]);

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortField(null);
      setSortDir(null);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const portalUrl = (token: string) => `${window.location.origin}/loja/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(portalUrl(token));
    toast.success("Link copiado!");
  };

  const openWhatsApp = (token: string, storeName: string) => {
    const url = portalUrl(token);
    const msg = encodeURIComponent(`Olá! Acesse o Portal da Loja "${storeName}" pelo link:\n${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (storeIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma loja vinculada. Vincule lojas na aba "Lojas" primeiro.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{stores.length} lojas vinculadas</p>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => generateAll.mutate(campaignId)}
            disabled={generateAll.isPending}
          >
            <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
            Gerar todos os links
          </Button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort("name")}>
                  Loja <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort("city")}>
                  Cidade <SortIcon field="city" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort("state")}>
                  UF <SortIcon field="state" />
                </button>
              </TableHead>
              <TableHead>
                <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" />
                </button>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStores.map((store) => {
              const tk = tokenMap.get(store.id);
              return (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">
                    {store.store_code ? `${store.store_code} — ` : ""}
                    {store.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{store.city || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{store.state || "—"}</TableCell>
                  <TableCell>
                    {tk ? (
                      <Badge variant="default" className="text-xs">Gerado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {tk ? (
                         <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(portalUrl(tk.token), "_blank")} title="Abrir portal">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(tk.token)} title="Copiar link">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openWhatsApp(tk.token, store.name)} title="Enviar por WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteToken.mutate({ id: tk.id, campaign_id: campaignId })}
                              disabled={deleteToken.isPending}
                              title="Remover link"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      ) : (
                        isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateToken.mutate({ campaign_id: campaignId, store_id: store.id })}
                            disabled={generateToken.isPending}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Gerar
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
