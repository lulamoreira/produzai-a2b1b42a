import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ParsedRequoteResult,
  ParsedRequoteRow,
} from "@/lib/parseAdjustmentResponseWorkbook";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: ParsedRequoteResult | null;
  onConfirmSelected: (
    rows: ParsedRequoteRow[],
    installation: number | null,
    freight: number | null
  ) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ImportRequoteConfirmDialog({
  open,
  onOpenChange,
  result,
  onConfirmSelected,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (result && open) {
      setSelected(new Set(result.rows.filter((r) => r.isValid).map((r) => r.code)));
    }
  }, [result, open]);

  if (!result) return null;

  const validRows = result.rows.filter((r) => r.isValid);
  const allSelected = validRows.length > 0 && selected.size === validRows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Confirmar importação da planilha</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {result.matched} peças identificadas
            </span>
            {result.unmatched > 0 && (
              <span className="ml-1 text-amber-700">
                · {result.unmatched} não encontradas
              </span>
            )}
            {" "}— revise antes de aplicar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {result.warnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {result.warnings.length} aviso(s)
              </div>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {result.warnings.map((w, i) => (
                  <div key={i} className="text-[11px] text-amber-900 dark:text-amber-200">
                    • {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelected(new Set(validRows.map((r) => r.code)));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Peça / Kit</TableHead>
                  <TableHead className="text-right w-28">Anterior</TableHead>
                  <TableHead className="text-right w-32">Novo preço</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => {
                  const isChecked = selected.has(row.code);
                  const changed =
                    row.newPrice !== null && row.newPrice !== row.previousPrice;
                  return (
                    <TableRow key={row.code} className={changed ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={isChecked}
                          disabled={!row.isValid}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected);
                            if (checked) next.add(row.code);
                            else next.delete(row.code);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.code}</TableCell>
                      <TableCell className="text-xs">{row.name}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(row.previousPrice)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs tabular-nums ${
                          changed ? "text-blue-700 dark:text-blue-300 font-semibold" : ""
                        }`}
                      >
                        {row.newPrice !== null ? formatCurrency(row.newPrice) : "—"}
                      </TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {(result.installation !== null || result.freight !== null) && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <div className="text-xs font-medium text-foreground">
                Instalação e Frete
              </div>
              {result.installation !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Instalação</span>
                  <span className="tabular-nums">{formatCurrency(result.installation)}</span>
                </div>
              )}
              {result.freight !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="tabular-nums">{formatCurrency(result.freight)}</span>
                </div>
              )}
              <div className="text-[11px] text-muted-foreground italic">
                Instalação e frete serão aplicados junto com os preços.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {selected.size} de {validRows.length} preços selecionados
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const selectedRows = result.rows.filter((r) => selected.has(r.code));
                onConfirmSelected(selectedRows, result.installation, result.freight);
                onOpenChange(false);
              }}
              disabled={selected.size === 0}
            >
              Aplicar {selected.size} preço(s)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
