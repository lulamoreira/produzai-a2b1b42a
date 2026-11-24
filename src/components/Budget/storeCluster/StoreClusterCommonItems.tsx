import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CommonItem } from "@/lib/storeClusterCost";

export interface StoreClusterCommonItemsProps {
  items: CommonItem[]; // já filtrados (top N + busca)
  groupNames: string[];
  fmt: (v: number) => string;
  multi: boolean;
  topN: string;
  onTopN: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
}

export function StoreClusterCommonItems({ items, groupNames, fmt, multi, topN, onTopN, search, onSearch }: StoreClusterCommonItemsProps) {
  const cell = "px-2 py-1.5 text-right whitespace-nowrap";
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar peça ou código..." aria-label="Buscar peça" />
        <Select value={topN} onValueChange={onTopN}>
          <SelectTrigger className="sm:w-36" aria-label="Quantidade de itens"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Top 10</SelectItem><SelectItem value="20">Top 20</SelectItem>
            <SelectItem value="50">Top 50</SelectItem><SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left">Cód.</th><th className="px-2 py-1.5 text-left">Item</th>
              <th className={cell}>Lojas</th><th className={cell}>%</th><th className={cell}>Qtd.</th>
              <th className={cell}>{multi ? "Preço méd." : "Preço un."}</th><th className={cell}>Valor total</th>
              {multi && <th className={cell}>Campanhas</th>}
              {groupNames.map((g) => <th key={g} className={cell}>{g}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key} className="border-t border-border">
                <td className="px-2 py-1.5">{it.code ?? "—"}</td>
                <td className="px-2 py-1.5 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt="" loading="lazy" width={32} height={32} className="w-8 h-8 object-cover rounded shrink-0" />
                    ) : <div className="w-8 h-8 rounded bg-muted shrink-0" />}
                    <span>{it.kind === "kit" && !/^kit\b/i.test(it.name) && <b>KIT </b>}{it.name}</span>
                  </div>
                </td>
                <td className={cell}>{it.stores}</td><td className={cell}>{it.pct.toFixed(0)}%</td>
                <td className={cell}>{it.totalQty}</td><td className={cell}>{fmt(it.unitPrice)}</td>
                <td className={cell}>{fmt(it.totalValue)}</td>
                {multi && <td className={cell}>{it.campaigns}</td>}
                {groupNames.map((g) => <td key={g} className={cell}>{it.storesByGroup[g] ?? 0}</td>)}
              </tr>
            ))}
            {items.length === 0 && <tr><td className="px-2 py-4 text-center text-muted-foreground" colSpan={8}>Nenhum item.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
