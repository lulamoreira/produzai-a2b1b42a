import { useState, useMemo, useRef } from "react";
import { useCampaignBudgets, useBudgetItems, useAddBudget, useDeleteBudget, useAddBudgetItems, type Budget, type BudgetItem } from "@/hooks/useBudgets";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, Trash2, FileSpreadsheet, Trophy, TrendingDown, DollarSign, Package } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BudgetsTabProps {
  campaignId: string;
  canEdit: boolean;
}

const BudgetsTab = ({ campaignId, canEdit }: BudgetsTabProps) => {
  const { data: budgets = [], isLoading: loadingBudgets } = useCampaignBudgets(campaignId);
  const { data: allItems = [], isLoading: loadingItems } = useBudgetItems(campaignId);
  const addBudget = useAddBudget();
  const deleteBudget = useDeleteBudget();
  const addBudgetItems = useAddBudgetItems();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [previewItems, setPreviewItems] = useState<{ item_name: string; quantity: number; unit_price: number; total_price: number }[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [colMap, setColMap] = useState<{ item: string; quantity: string; unit_price: string; total_price: string }>({ item: "", quantity: "", unit_price: "", total_price: "" });
  const [mappingStep, setMappingStep] = useState(false);

  // Group items by budget
  const itemsByBudget = useMemo(() => {
    const map: Record<string, BudgetItem[]> = {};
    allItems.forEach((item) => {
      if (!map[item.budget_id]) map[item.budget_id] = [];
      map[item.budget_id].push(item);
    });
    return map;
  }, [allItems]);

  // Build comparison data: all unique item names across all budgets
  const comparisonData = useMemo(() => {
    if (budgets.length === 0) return { items: [], totals: {}, cheapestBudgetId: "" };

    const allItemNames = new Set<string>();
    allItems.forEach((item) => allItemNames.add(item.item_name));

    const itemNames = [...allItemNames].sort();

    // For each item, find price per budget
    const items = itemNames.map((name) => {
      const pricesPerBudget: Record<string, { quantity: number; unit_price: number; total_price: number }> = {};
      budgets.forEach((b) => {
        const budgetItems = itemsByBudget[b.id] || [];
        const match = budgetItems.find((bi) => bi.item_name === name);
        if (match) {
          pricesPerBudget[b.id] = { quantity: match.quantity, unit_price: match.unit_price, total_price: match.total_price };
        }
      });

      // Find cheapest total_price for this item
      let cheapestId = "";
      let cheapestPrice = Infinity;
      Object.entries(pricesPerBudget).forEach(([budgetId, info]) => {
        if (info.total_price > 0 && info.total_price < cheapestPrice) {
          cheapestPrice = info.total_price;
          cheapestId = budgetId;
        }
      });

      return { name, pricesPerBudget, cheapestBudgetId: cheapestId };
    });

    // Compute totals per budget
    const totals: Record<string, number> = {};
    budgets.forEach((b) => {
      const budgetItems = itemsByBudget[b.id] || [];
      totals[b.id] = budgetItems.reduce((sum, bi) => sum + bi.total_price, 0);
    });

    // Find cheapest overall budget
    let cheapestBudgetId = "";
    let cheapestTotal = Infinity;
    Object.entries(totals).forEach(([id, total]) => {
      if (total > 0 && total < cheapestTotal) {
        cheapestTotal = total;
        cheapestBudgetId = id;
      }
    });

    return { items, totals, cheapestBudgetId };
  }, [budgets, allItems, itemsByBudget]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewItems([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          toast.error("Planilha vazia.");
          return;
        }

        const keys = Object.keys(rows[0]);
        setDetectedColumns(keys);
        setRawRows(rows);

        // Auto-detect hints
        const findCol = (hints: string[]) => keys.find((k) => hints.some((h) => k.toLowerCase().includes(h))) || "";
        setColMap({
          item: findCol(["item", "peça", "peca", "descrição", "descricao", "nome", "produto", "material"]) || keys[0] || "",
          quantity: findCol(["qtd", "quantidade", "qty", "quant"]),
          unit_price: findCol(["unitário", "unitario", "unit", "preço unit", "preco unit", "valor unit", "vl unit", "vl. unit"]),
          total_price: findCol(["total", "valor total", "vl total", "vl. total", "subtotal"]),
        });
        setMappingStep(true);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao ler planilha.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const applyColumnMapping = () => {
    if (!colMap.item) {
      toast.error("Selecione ao menos a coluna de Item.");
      return;
    }
    const parsed = rawRows.map((row) => {
      const item_name = String(row[colMap.item] || "").trim();
      const quantity = colMap.quantity
        ? parseFloat(String(row[colMap.quantity] || "1").replace(",", ".")) || 1
        : 1;
      const unit_price = colMap.unit_price
        ? parseFloat(String(row[colMap.unit_price] || "0").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0
        : 0;
      let total_price = colMap.total_price
        ? parseFloat(String(row[colMap.total_price] || "0").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0
        : 0;
      if (total_price === 0 && unit_price > 0) total_price = quantity * unit_price;
      return { item_name, quantity, unit_price, total_price };
    }).filter((r) => r.item_name.length > 0);

    setPreviewItems(parsed);
    setMappingStep(false);
  };

  const handleUpload = async () => {
    if (!supplierName.trim() || previewItems.length === 0) return;
    setUploading(true);
    try {
      // Upload file to storage
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const path = `${campaignId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("budget-files").upload(path, selectedFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("budget-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      // Create budget
      const budget = await addBudget.mutateAsync({
        campaign_id: campaignId,
        supplier_name: supplierName.trim(),
        file_url: fileUrl,
        file_name: fileName,
      });

      // Insert items
      const items = previewItems.map((item, i) => ({
        budget_id: budget.id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        display_order: i,
      }));
      await addBudgetItems.mutateAsync({ items, campaignId });

      toast.success(`Orçamento de "${supplierName}" importado com ${items.length} itens.`);
      setUploadDialogOpen(false);
      setSupplierName("");
      setPreviewItems([]);
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar orçamento.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    await deleteBudget.mutateAsync({ id, campaignId });
    toast.success("Orçamento removido.");
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loadingBudgets || loadingItems) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Orçamentos
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare até 3 orçamentos de fornecedores.
          </p>
        </div>
        {canEdit && budgets.length < 3 && (
          <Button size="sm" onClick={() => setUploadDialogOpen(true)} className="gap-1.5">
            <Upload className="w-4 h-4" />
            Novo Orçamento
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => {
            const items = itemsByBudget[budget.id] || [];
            const total = items.reduce((s, i) => s + i.total_price, 0);
            const isCheapest = comparisonData.cheapestBudgetId === budget.id && budgets.length > 1;
            return (
              <Card key={budget.id} className={`relative overflow-hidden ${isCheapest ? "ring-2 ring-green-500/50 bg-green-500/5" : ""}`}>
                {isCheapest && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-600 text-white gap-1">
                      <Trophy className="w-3 h-3" />
                      Menor
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    {budget.supplier_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {items.length} itens
                    </span>
                    {budget.file_name && (
                      <span className="truncate max-w-[120px]">{budget.file_name}</span>
                    )}
                  </div>
                  {canEdit && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1 mt-1 h-7 text-xs">
                          <Trash2 className="w-3 h-3" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover Orçamento</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja remover o orçamento de "{budget.supplier_name}"? Essa ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteBudget(budget.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparison Table */}
      {budgets.length > 1 && comparisonData.items.length > 0 && (
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Item</TableHead>
                {budgets.map((b) => (
                  <TableHead key={b.id} className="text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{b.supplier_name}</span>
                      {comparisonData.cheapestBudgetId === b.id && (
                        <TrendingDown className="w-3 h-3 text-green-600" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonData.items.map((item) => (
                <TableRow key={item.name}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                    {item.name}
                  </TableCell>
                  {budgets.map((b) => {
                    const info = item.pricesPerBudget[b.id];
                    const isCheapest = item.cheapestBudgetId === b.id && Object.keys(item.pricesPerBudget).length > 1;
                    return (
                      <TableCell key={b.id} className={`text-center text-sm ${isCheapest ? "bg-green-500/10 font-semibold text-green-700 dark:text-green-400" : ""}`}>
                        {info ? (
                          <div className="flex flex-col items-center">
                            <span>{formatCurrency(info.total_price)}</span>
                            {info.quantity !== 1 && (
                              <span className="text-[10px] text-muted-foreground">
                                {info.quantity}x {formatCurrency(info.unit_price)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="sticky left-0 bg-muted/50 z-10 text-sm">TOTAL</TableCell>
                {budgets.map((b) => {
                  const total = comparisonData.totals[b.id] || 0;
                  const isCheapest = comparisonData.cheapestBudgetId === b.id;
                  return (
                    <TableCell key={b.id} className={`text-center text-sm ${isCheapest ? "text-green-700 dark:text-green-400" : ""}`}>
                      {formatCurrency(total)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Single budget - show items list */}
      {budgets.length === 1 && (itemsByBudget[budgets[0].id] || []).length > 0 && (
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Valor Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(itemsByBudget[budgets[0].id] || []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.item_name}</TableCell>
                  <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(item.total_price)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={3} className="text-sm">TOTAL</TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency((itemsByBudget[budgets[0].id] || []).reduce((s, i) => s + i.total_price, 0))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state */}
      {budgets.length === 0 && (
        <div className="text-center py-16">
          <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-4">Nenhum orçamento cadastrado.</p>
          {canEdit && (
            <Button size="sm" onClick={() => setUploadDialogOpen(true)} className="gap-1.5">
              <Upload className="w-4 h-4" />
              Importar Orçamento
            </Button>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setSupplierName("");
          setPreviewItems([]);
          setSelectedFile(null);
          setRawRows([]);
          setDetectedColumns([]);
          setColMap({ item: "", quantity: "", unit_price: "", total_price: "" });
          setMappingStep(false);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Orçamento</DialogTitle>
            <DialogDescription>
              Suba uma planilha Excel (.xlsx) com os itens do orçamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do Fornecedor</label>
              <Input
                placeholder="Ex: Gráfica XYZ"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Planilha</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 w-full"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {selectedFile ? selectedFile.name : "Selecionar planilha"}
              </Button>
            </div>

            {/* Column Mapping Step */}
            {mappingStep && detectedColumns.length > 0 && (
              <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium text-foreground">
                  Mapeamento de Colunas
                </p>
                <p className="text-xs text-muted-foreground">
                  Selecione qual coluna da planilha corresponde a cada campo. Detectamos {detectedColumns.length} colunas.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "item" as const, label: "Item / Descrição *", required: true },
                    { key: "quantity" as const, label: "Quantidade", required: false },
                    { key: "unit_price" as const, label: "Valor Unitário", required: false },
                    { key: "total_price" as const, label: "Valor Total", required: false },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
                      <select
                        value={colMap[key]}
                        onChange={(e) => setColMap((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Não mapear —</option>
                        {detectedColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Sample preview of first 3 rows with current mapping */}
                {rawRows.length > 0 && colMap.item && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Amostra com mapeamento atual:</p>
                    <div className="border border-border rounded overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-xs text-center">Qtd</TableHead>
                            <TableHead className="text-xs text-right">Unit.</TableHead>
                            <TableHead className="text-xs text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rawRows.slice(0, 3).map((row, i) => {
                            const itemVal = String(row[colMap.item] || "").trim();
                            const qtyVal = colMap.quantity ? parseFloat(String(row[colMap.quantity] || "1").replace(",", ".")) || 1 : 1;
                            const unitVal = colMap.unit_price ? parseFloat(String(row[colMap.unit_price] || "0").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0 : 0;
                            let totalVal = colMap.total_price ? parseFloat(String(row[colMap.total_price] || "0").replace(/[^\d,.-]/g, "").replace(",", ".")) || 0 : 0;
                            if (totalVal === 0 && unitVal > 0) totalVal = qtyVal * unitVal;
                            return (
                              <TableRow key={i}>
                                <TableCell className="text-xs">{itemVal || "—"}</TableCell>
                                <TableCell className="text-xs text-center">{qtyVal}</TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(unitVal)}</TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(totalVal)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <Button onClick={applyColumnMapping} disabled={!colMap.item} className="w-full" size="sm">
                  Confirmar Mapeamento
                </Button>
              </div>
            )}

            {/* Preview */}
            {previewItems.length > 0 && !mappingStep && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Pré-visualização ({previewItems.length} itens)
                  </p>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setMappingStep(true)}>
                    Remapear colunas
                  </Button>
                </div>
                <div className="border border-border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs text-center">Qtd</TableHead>
                        <TableHead className="text-xs text-right">Unit.</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewItems.slice(0, 20).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{item.item_name}</TableCell>
                          <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(item.total_price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {previewItems.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ... e mais {previewItems.length - 20} itens
                    </p>
                  )}
                </div>
                <div className="text-right text-sm font-bold text-foreground">
                  Total: {formatCurrency(previewItems.reduce((s, i) => s + i.total_price, 0))}
                </div>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!supplierName.trim() || previewItems.length === 0 || uploading || mappingStep}
              className="w-full"
            >
              {uploading ? "Importando..." : "Importar Orçamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetsTab;
