import { useState, useMemo, useRef } from "react";
import {
  useCampaignBudgets, useBudgetItems, useAddBudget, useDeleteBudget, useAddBudgetItems,
  useCampaignQuotations, useAddQuotation, useUpdateQuotation, useDeleteQuotation,
  type Budget, type BudgetItem, type Quotation,
} from "@/hooks/useBudgets";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, FileSpreadsheet, Trophy, TrendingDown, DollarSign, Package, Plus, FolderOpen, Pencil, ChevronRight, ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BudgetsTabProps {
  campaignId: string;
  canEdit: boolean;
}

const BudgetsTab = ({ campaignId, canEdit }: BudgetsTabProps) => {
  const { data: quotations = [], isLoading: loadingQuotations } = useCampaignQuotations(campaignId);
  const { data: budgets = [], isLoading: loadingBudgets } = useCampaignBudgets(campaignId);
  const { data: allItems = [], isLoading: loadingItems } = useBudgetItems(campaignId);
  const addQuotation = useAddQuotation();
  const updateQuotation = useUpdateQuotation();
  const deleteQuotation = useDeleteQuotation();
  const addBudget = useAddBudget();
  const deleteBudget = useDeleteBudget();
  const addBudgetItems = useAddBudgetItems();

  // Navigation state
  const [activeQuotationId, setActiveQuotationId] = useState<string | null>(null);

  // Quotation dialog
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [quotationName, setQuotationName] = useState("");

  // Budget upload dialog
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

  const activeQuotation = quotations.find((q) => q.id === activeQuotationId);
  const quotationBudgets = budgets.filter((b) => b.quotation_id === activeQuotationId);

  // Group items by budget
  const itemsByBudget = useMemo(() => {
    const map: Record<string, BudgetItem[]> = {};
    allItems.forEach((item) => {
      if (!map[item.budget_id]) map[item.budget_id] = [];
      map[item.budget_id].push(item);
    });
    return map;
  }, [allItems]);

  // Build comparison data for the active quotation
  const comparisonData = useMemo(() => {
    if (quotationBudgets.length === 0) return { items: [], totals: {}, cheapestBudgetId: "" };

    const relevantItems = allItems.filter((item) =>
      quotationBudgets.some((b) => b.id === item.budget_id)
    );

    const allItemNames = new Set<string>();
    relevantItems.forEach((item) => allItemNames.add(item.item_name));
    const itemNames = [...allItemNames].sort();

    const items = itemNames.map((name) => {
      const pricesPerBudget: Record<string, { quantity: number; unit_price: number; total_price: number }> = {};
      quotationBudgets.forEach((b) => {
        const bItems = itemsByBudget[b.id] || [];
        const match = bItems.find((bi) => bi.item_name === name);
        if (match) {
          pricesPerBudget[b.id] = { quantity: match.quantity, unit_price: match.unit_price, total_price: match.total_price };
        }
      });

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

    const totals: Record<string, number> = {};
    quotationBudgets.forEach((b) => {
      const bItems = itemsByBudget[b.id] || [];
      totals[b.id] = bItems.reduce((sum, bi) => sum + bi.total_price, 0);
    });

    let cheapestBudgetId = "";
    let cheapestTotal = Infinity;
    Object.entries(totals).forEach(([id, total]) => {
      if (total > 0 && total < cheapestTotal) {
        cheapestTotal = total;
        cheapestBudgetId = id;
      }
    });

    return { items, totals, cheapestBudgetId };
  }, [quotationBudgets, allItems, itemsByBudget]);

  // ─── Quotation CRUD ───

  const handleSaveQuotation = async () => {
    if (!quotationName.trim()) return;
    try {
      if (editingQuotation) {
        await updateQuotation.mutateAsync({ id: editingQuotation.id, name: quotationName.trim(), campaignId });
        toast.success("Cotação atualizada.");
      } else {
        const q = await addQuotation.mutateAsync({ campaign_id: campaignId, name: quotationName.trim() });
        setActiveQuotationId(q.id);
        toast.success("Cotação criada.");
      }
      setQuotationDialogOpen(false);
      setQuotationName("");
      setEditingQuotation(null);
    } catch {
      toast.error("Erro ao salvar cotação.");
    }
  };

  const handleDeleteQuotation = async (id: string) => {
    await deleteQuotation.mutateAsync({ id, campaignId });
    if (activeQuotationId === id) setActiveQuotationId(null);
    toast.success("Cotação removida.");
  };

  // ─── File handling ───

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

        const findCol = (hints: string[]) => keys.find((k) => hints.some((h) => k.toLowerCase().includes(h))) || "";
        setColMap({
          item: findCol(["item", "peça", "peca", "descrição", "descricao", "nome", "produto", "material"]) || keys[0] || "",
          quantity: findCol(["qtd", "quantidade", "qty", "quant"]),
          unit_price: findCol(["unitário", "unitario", "unit", "preço unit", "preco unit", "valor unit", "vl unit", "vl. unit"]),
          total_price: findCol(["total", "valor total", "vl total", "vl. total", "subtotal"]),
        });
        setMappingStep(true);
      } catch {
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
    if (!supplierName.trim() || previewItems.length === 0 || !activeQuotationId) return;
    setUploading(true);
    try {
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

      const budget = await addBudget.mutateAsync({
        campaign_id: campaignId,
        supplier_name: supplierName.trim(),
        quotation_id: activeQuotationId,
        file_url: fileUrl,
        file_name: fileName,
      });

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
      resetUploadDialog();
    } catch {
      toast.error("Erro ao importar orçamento.");
    } finally {
      setUploading(false);
    }
  };

  const resetUploadDialog = () => {
    setUploadDialogOpen(false);
    setSupplierName("");
    setPreviewItems([]);
    setSelectedFile(null);
    setRawRows([]);
    setDetectedColumns([]);
    setColMap({ item: "", quantity: "", unit_price: "", total_price: "" });
    setMappingStep(false);
  };

  const handleDeleteBudget = async (id: string) => {
    await deleteBudget.mutateAsync({ id, campaignId });
    toast.success("Orçamento removido.");
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── Column mapping field labels ───
  const fieldConfig = [
    { key: "item" as const, label: "📋 Item / Descrição", hint: "Nome ou descrição do item", required: true, color: "border-l-blue-500" },
    { key: "quantity" as const, label: "🔢 Quantidade", hint: "Qtd de cada item", required: false, color: "border-l-amber-500" },
    { key: "unit_price" as const, label: "💰 Valor Unitário", hint: "Preço por unidade", required: false, color: "border-l-emerald-500" },
    { key: "total_price" as const, label: "💵 Valor Total", hint: "Valor total do item", required: false, color: "border-l-purple-500" },
  ];

  // Get sample values for a column
  const getColumnSamples = (colName: string) => {
    if (!colName || rawRows.length === 0) return [];
    return rawRows.slice(0, 3).map((row) => String(row[colName] ?? "—")).filter(Boolean);
  };

  if (loadingQuotations || loadingBudgets || loadingItems) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ═══════════════════════════════════════
  // VIEW: Inside a quotation
  // ═══════════════════════════════════════
  if (activeQuotation) {
    return (
      <div className="space-y-6">
        {/* Quotation Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setActiveQuotationId(null)} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              {activeQuotation.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {quotationBudgets.length}/3 orçamentos nesta cotação
            </p>
          </div>
          {canEdit && quotationBudgets.length < 3 && (
            <Button size="sm" onClick={() => setUploadDialogOpen(true)} className="gap-1.5">
              <Upload className="w-4 h-4" />
              Adicionar Orçamento
            </Button>
          )}
        </div>

        {/* Budget cards */}
        {quotationBudgets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotationBudgets.map((budget) => {
              const bItems = itemsByBudget[budget.id] || [];
              const total = bItems.reduce((s, i) => s + i.total_price, 0);
              const isCheapest = comparisonData.cheapestBudgetId === budget.id && quotationBudgets.length > 1;
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
                        {bItems.length} itens
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
                              Deseja remover o orçamento de &ldquo;{budget.supplier_name}&rdquo;? Essa ação não pode ser desfeita.
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
        {quotationBudgets.length > 1 && comparisonData.items.length > 0 && (
          <div className="border border-border rounded-lg overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Item</TableHead>
                  {quotationBudgets.map((b) => (
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
                    {quotationBudgets.map((b) => {
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
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="sticky left-0 bg-muted/50 z-10 text-sm">TOTAL</TableCell>
                  {quotationBudgets.map((b) => {
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

        {/* Single budget items */}
        {quotationBudgets.length === 1 && (itemsByBudget[quotationBudgets[0].id] || []).length > 0 && (
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
                {(itemsByBudget[quotationBudgets[0].id] || []).map((item) => (
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
                    {formatCurrency((itemsByBudget[quotationBudgets[0].id] || []).reduce((s, i) => s + i.total_price, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty state */}
        {quotationBudgets.length === 0 && (
          <div className="text-center py-16">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-4">Nenhum orçamento nesta cotação.</p>
            {canEdit && (
              <Button size="sm" onClick={() => setUploadDialogOpen(true)} className="gap-1.5">
                <Upload className="w-4 h-4" />
                Importar Orçamento
              </Button>
            )}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) resetUploadDialog(); else setUploadDialogOpen(true); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Importar Orçamento</DialogTitle>
              <DialogDescription>
                Suba uma planilha Excel (.xlsx) com os itens do orçamento para a cotação &ldquo;{activeQuotation.name}&rdquo;.
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

              {/* Visual Column Mapping */}
              {mappingStep && detectedColumns.length > 0 && (
                <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/20">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      🗂️ Mapeamento de Colunas
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Para cada campo abaixo, escolha a coluna da planilha correspondente. Veja os exemplos de valores para identificar.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {fieldConfig.map(({ key, label, hint, required, color }) => (
                      <div key={key} className={`border-l-4 ${color} rounded-r-lg bg-background p-3 space-y-2`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-sm font-medium text-foreground">{label}</span>
                            {required && <span className="text-destructive ml-1">*</span>}
                            <p className="text-xs text-muted-foreground">{hint}</p>
                          </div>
                        </div>
                        <Select
                          value={colMap[key] || "__none__"}
                          onValueChange={(val) => setColMap((prev) => ({ ...prev, [key]: val === "__none__" ? "" : val }))}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecionar coluna..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">— Não mapear —</span>
                            </SelectItem>
                            {detectedColumns.map((col) => {
                              const samples = getColumnSamples(col);
                              return (
                                <SelectItem key={col} value={col}>
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium">{col}</span>
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {samples.slice(0, 2).join(" · ")}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {/* Show selected column sample */}
                        {colMap[key] && (
                          <div className="flex gap-2 flex-wrap">
                            {getColumnSamples(colMap[key]).map((val, i) => (
                              <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {val}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Preview table */}
                  {rawRows.length > 0 && colMap.item && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Pré-visualização com mapeamento atual
                      </p>
                      <div className="border border-border rounded-lg overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Item</TableHead>
                              <TableHead className="text-xs text-center">Qtd</TableHead>
                              <TableHead className="text-xs text-right">Valor Unit.</TableHead>
                              <TableHead className="text-xs text-right">Valor Total</TableHead>
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
                                  <TableCell className="text-xs font-medium">{itemVal || "—"}</TableCell>
                                  <TableCell className="text-xs text-center">{qtyVal}</TableCell>
                                  <TableCell className="text-xs text-right">{formatCurrency(unitVal)}</TableCell>
                                  <TableCell className="text-xs text-right font-medium">{formatCurrency(totalVal)}</TableCell>
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

              {/* Preview after mapping */}
              {previewItems.length > 0 && !mappingStep && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      ✅ {previewItems.length} itens detectados
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
  }

  // ═══════════════════════════════════════
  // VIEW: Quotation list (main view)
  // ═══════════════════════════════════════
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Cotações
          </h2>
          <p className="text-sm text-muted-foreground">
            Crie cotações para organizar e comparar orçamentos de fornecedores.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setQuotationName(""); setEditingQuotation(null); setQuotationDialogOpen(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nova Cotação
          </Button>
        )}
      </div>

      {/* Quotation cards */}
      {quotations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quotations.map((q) => {
            const qBudgets = budgets.filter((b) => b.quotation_id === q.id);
            const totalBudgets = qBudgets.length;
            const totalValue = qBudgets.reduce((sum, b) => {
              const bItems = itemsByBudget[b.id] || [];
              return sum + bItems.reduce((s, i) => s + i.total_price, 0);
            }, 0);
            // Find cheapest budget in this quotation
            let cheapestName = "";
            let cheapestTotal = Infinity;
            qBudgets.forEach((b) => {
              const bItems = itemsByBudget[b.id] || [];
              const t = bItems.reduce((s, i) => s + i.total_price, 0);
              if (t > 0 && t < cheapestTotal) {
                cheapestTotal = t;
                cheapestName = b.supplier_name;
              }
            });

            return (
              <Card
                key={q.id}
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => setActiveQuotationId(q.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      {q.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="gap-1">
                      <FileSpreadsheet className="w-3 h-3" />
                      {totalBudgets}/3 orçamentos
                    </Badge>
                  </div>
                  {totalBudgets > 0 && (
                    <div className="space-y-1">
                      {qBudgets.map((b) => {
                        const bItems = itemsByBudget[b.id] || [];
                        const t = bItems.reduce((s, i) => s + i.total_price, 0);
                        const isCheapest = b.supplier_name === cheapestName && totalBudgets > 1;
                        return (
                          <div key={b.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${isCheapest ? "bg-green-500/10 text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                            <span className="flex items-center gap-1.5">
                              {isCheapest && <Trophy className="w-3 h-3" />}
                              {b.supplier_name}
                            </span>
                            <span>{formatCurrency(t)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => { setEditingQuotation(q); setQuotationName(q.name); setQuotationDialogOpen(true); }}
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 text-xs gap-1">
                            <Trash2 className="w-3 h-3" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Cotação</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja excluir a cotação &ldquo;{q.name}&rdquo; e todos os seus orçamentos? Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuotation(q.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-1">Nenhuma cotação criada.</p>
          <p className="text-muted-foreground text-xs mb-4">Crie uma cotação para começar a comparar orçamentos.</p>
          {canEdit && (
            <Button size="sm" onClick={() => { setQuotationName(""); setEditingQuotation(null); setQuotationDialogOpen(true); }} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nova Cotação
            </Button>
          )}
        </div>
      )}

      {/* Quotation Create/Edit Dialog */}
      <Dialog open={quotationDialogOpen} onOpenChange={(open) => {
        setQuotationDialogOpen(open);
        if (!open) { setQuotationName(""); setEditingQuotation(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingQuotation ? "Editar Cotação" : "Nova Cotação"}</DialogTitle>
            <DialogDescription>
              {editingQuotation ? "Atualize o nome da cotação." : "Dê um nome para a cotação (ex: Cenário 1 - Impressão Digital)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Ex: Cotação Cenário 1"
              value={quotationName}
              onChange={(e) => setQuotationName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveQuotation()}
              autoFocus
            />
            <Button onClick={handleSaveQuotation} disabled={!quotationName.trim()} className="w-full">
              {editingQuotation ? "Salvar" : "Criar Cotação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetsTab;
