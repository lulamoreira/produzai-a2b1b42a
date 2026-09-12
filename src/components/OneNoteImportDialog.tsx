import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { disambiguateKitPieceNames } from "@/lib/disambiguateKitPieces";
import { ensureCampaignLocations } from "@/lib/ensureCampaignLocations";
import {
  createEmptyOneNoteRow,
  ONE_NOTE_COLUMNS,
  transformOneNoteRows,
  type OneNoteColumn,
  type OneNoteSourceRow,
} from "@/lib/parseOneNoteSheet";
import { pieceTypeKey } from "@/lib/pieceTypeKey";
import { normalizeBareKitName, splitKitByVariant } from "@/lib/splitKitPrimarySecondary";

interface OneNoteSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExcel: () => void;
  onPdf: () => void;
}

export function OneNoteSourceDialog({ open, onOpenChange, onExcel, onPdf }: OneNoteSourceDialogProps) {
  useTranslation();
  const choose = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar do OneNote</DialogTitle>
          <DialogDescription>Escolha o tipo de arquivo que será conferido antes da importação.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => choose(onExcel)}>
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span className="text-left">
              <span className="block font-medium">Arquivo Excel</span>
              <span className="block text-xs font-normal text-muted-foreground">Formato atual .xlsx ou .xls</span>
            </span>
          </Button>
          <Button variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => choose(onPdf)}>
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-left">
              <span className="block font-medium">PDF do OneNote</span>
              <span className="block text-xs font-normal text-muted-foreground">Texto extraído e organizado com IA</span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface OneNoteImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  rows: OneNoteSourceRow[];
  /** Cliente da campanha: habilita a sugestão de especificação de campanhas anteriores. */
  clientId?: string;
}

interface EditableRow {
  id: string;
  value: OneNoteSourceRow;
  /** Especificação conferida pelo usuário (não faz parte das colunas extraídas). */
  specification: string;
  /** Campanha de origem quando a especificação foi preenchida automaticamente. */
  specSource: string | null;
}

function editableRow(value: OneNoteSourceRow): EditableRow {
  return { id: crypto.randomUUID(), value: { ...value }, specification: "", specSource: null };
}

const DEFAULT_SPECIFICATION = "Vide Book/Manual";

interface ClientPieceSpec {
  name: string;
  specification: string;
  campaign_id: string;
  campaign_name: string;
  campaign_created_at: string;
}

export function OneNoteImportDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  rows,
  clientId,
}: OneNoteImportDialogProps) {
  useTranslation();
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) setEditableRows(rows.map(editableRow));
  }, [open, rows]);

  // Especificações já escritas em outras campanhas do mesmo cliente.
  const { data: clientSpecs = [] } = useQuery({
    queryKey: ["onenote-client-piece-specs", clientId, campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_client_piece_specs", {
        p_client_id: clientId!,
      });
      if (error) throw error;
      return ((data ?? []) as ClientPieceSpec[]).filter((item) => item.campaign_id !== campaignId);
    },
    enabled: open && !!clientId,
  });

  /** Melhor especificação por chave de tipo (campanha mais recente vence). */
  const specByTypeKey = useMemo(() => {
    const map = new Map<string, ClientPieceSpec>();
    for (const item of clientSpecs) {
      const key = pieceTypeKey(item.name);
      if (!key || !item.specification?.trim()) continue;
      const current = map.get(key);
      if (!current || new Date(item.campaign_created_at) > new Date(current.campaign_created_at)) {
        map.set(key, item);
      }
    }
    return map;
  }, [clientSpecs]);

  // Pré-preenche apenas linhas ainda vazias; nunca sobrescreve o que o usuário digitou.
  useEffect(() => {
    if (specByTypeKey.size === 0) return;
    setEditableRows((current) => {
      let changed = false;
      const next = current.map((row) => {
        if (row.specification.trim()) return row;
        const match = specByTypeKey.get(pieceTypeKey(row.value["Nome da Peça"]));
        if (!match) return row;
        changed = true;
        return { ...row, specification: match.specification, specSource: match.campaign_name };
      });
      return changed ? next : current;
    });
  }, [specByTypeKey]);

  /** Peças geradas por linha, para levar a especificação conferida até a inserção. */
  const parsedByRow = useMemo(
    () => editableRows.map((row) => ({ rowId: row.id, pieces: transformOneNoteRows([row.value]) })),
    [editableRows],
  );

  const parsed = useMemo(() => parsedByRow.flatMap((entry) => entry.pieces), [parsedByRow]);

  const specByPieceIndex = useMemo(() => {
    const specs: string[] = [];
    const byRowId = new Map(editableRows.map((row) => [row.id, row.specification]));
    for (const entry of parsedByRow) {
      const spec = (byRowId.get(entry.rowId) ?? "").trim();
      for (let i = 0; i < entry.pieces.length; i += 1) specs.push(spec || DEFAULT_SPECIFICATION);
    }
    return specs;
  }, [parsedByRow, editableRows]);

  const autoFilledCount = useMemo(
    () => editableRows.filter((row) => row.specSource && row.specification.trim()).length,
    [editableRows],
  );


  const kitGroups = useMemo(() => {
    const groups: Array<{ kitName: string; category: string; indexes: number[] }> = [];
    const byKey = new Map<string, number>();
    parsed.forEach((piece, index) => {
      const kitName = (piece.kitName ?? "").trim();
      if (!kitName) return;
      const category = (piece.category ?? "").trim().toUpperCase();
      const key = `${kitName}||${category}`;
      let position = byKey.get(key);
      if (position === undefined) {
        position = groups.length;
        byKey.set(key, position);
        groups.push({ kitName, category, indexes: [] });
      }
      groups[position].indexes.push(index);
    });
    const nameCount = new Map<string, number>();
    groups.forEach((group) => nameCount.set(group.kitName, (nameCount.get(group.kitName) ?? 0) + 1));
    return groups.map((group) => ({
      ...group,
      displayName: (nameCount.get(group.kitName) ?? 0) > 1 && group.category
        ? `${group.kitName} - ${group.category}`
        : group.kitName,
    }));
  }, [parsed]);

  const updateCell = (id: string, column: OneNoteColumn, value: string) => {
    setEditableRows((current) => current.map((row) => (
      row.id === id ? { ...row, value: { ...row.value, [column]: value } } : row
    )));
  };

  /** Edição manual da especificação: remove o selo de preenchimento automático. */
  const updateSpecification = (id: string, value: string) => {
    setEditableRows((current) => current.map((row) => (
      row.id === id ? { ...row, specification: value, specSource: null } : row
    )));
  };

  const handleConfirm = async () => {
    if (importing || parsed.length === 0) return;
    setImporting(true);
    const toastId = "onenote-import";
    toast.loading("Importando dados revisados do OneNote...", { id: toastId });

    try {
      const { data: lastPiece, error: lastPieceError } = await supabase
        .from("campaign_pieces")
        .select("code")
        .eq("campaign_id", campaignId)
        .eq("is_deleted", false)
        .order("code", { ascending: false })
        .limit(1);
      if (lastPieceError) throw lastPieceError;
      let nextPieceCode = (lastPiece?.[0]?.code ?? 0) + 1;
      const codeToId = new Map<number, string>();
      const rowCodes: number[] = [];

      for (let index = 0; index < parsed.length; index += 1) {
        const piece = parsed[index];
        const code = nextPieceCode++;
        const { data: inserted, error: insertError } = await supabase
          .from("campaign_pieces")
          .insert({
            campaign_id: campaignId,
            code,
            name: piece.name,
            category: piece.category.toUpperCase(),
            size: piece.size,
            kit_only: piece.kit_only,
            is_mockup: piece.is_mockup,
            sub_location: null,
            specification: specByPieceIndex[index] ?? DEFAULT_SPECIFICATION,
            installation_instructions: "Sem informações específicas",
            is_deleted: false,
            is_new: false,
            display_order: index,
          })
          .select("id, code")
          .single();
        if (insertError) throw insertError;
        codeToId.set(code, inserted.id);
        rowCodes.push(code);
      }

      const { data: lastKit, error: lastKitError } = await supabase
        .from("campaign_kits")
        .select("code")
        .eq("campaign_id", campaignId)
        .eq("is_deleted", false)
        .order("code", { ascending: false })
        .limit(1);
      if (lastKitError) throw lastKitError;
      let nextKitCode = (lastKit?.[0]?.code ?? 0) + 1;

      for (const group of kitGroups) {
        const variants = splitKitByVariant(
          group.displayName,
          group.category || null,
          group.indexes,
          (index) => parsed[index].name,
        );
        for (const variant of variants) {
          const { data: kit, error: kitError } = await supabase
            .from("campaign_kits")
            .insert({
              campaign_id: campaignId,
              name: normalizeBareKitName(variant.name, group.category),
              category: group.category || null,
              code: nextKitCode++,
              is_deleted: false,
              is_mockup: group.indexes.some((index) => parsed[index].is_mockup),
            })
            .select("id")
            .single();
          if (kitError) throw kitError;
          for (let order = 0; order < variant.members.length; order += 1) {
            const pieceId = codeToId.get(rowCodes[variant.members[order]]);
            if (!pieceId) continue;
            const { error: linkError } = await supabase.from("campaign_kit_pieces").insert({
              kit_id: kit.id,
              piece_id: pieceId,
              quantity: 1,
              display_order: order,
            });
            if (linkError) throw linkError;
          }
        }
      }

      await disambiguateKitPieceNames(campaignId);
      await ensureCampaignLocations(campaignId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kits"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_kit_pieces"] }),
        queryClient.invalidateQueries({ queryKey: ["campaign_piece_locations"] }),
      ]);
      toast.success(`Importadas ${parsed.length} peças e ${kitGroups.length} kits do OneNote`, { id: toastId });
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao importar: ${message}`, { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !importing && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[90dvh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 lg:max-w-7xl">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>Conferir importação do OneNote</DialogTitle>
          <DialogDescription>
            Revise os dados antes de importar para {campaignName}. Nada será gravado até a confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 px-6">
          <span className="rounded-md border bg-muted px-3 py-1 text-sm font-medium">{parsed.length} peças</span>
          <span className="rounded-md border bg-muted px-3 py-1 text-sm font-medium">{kitGroups.length} kits</span>
          {autoFilledCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {autoFilledCount} com spec de campanha anterior
            </span>
          )}
          {kitGroups.map((group) => (
            <span key={`${group.kitName}-${group.category}`} className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
              {group.displayName}: {group.indexes.length}
            </span>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto border-y">
          <Table className="min-w-[1520px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                {ONE_NOTE_COLUMNS.map((column) => (
                  <TableHead key={column} className={column === "Nome da Peça" ? "w-72" : "w-52"}>{column}</TableHead>
                ))}
                <TableHead className="w-64">Especificação</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {editableRows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="p-2 text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                  {ONE_NOTE_COLUMNS.map((column) => (
                    <TableCell key={column} className="p-1.5">
                      {column === "O que compõe o Kit" ? (
                        <Textarea
                          aria-label={`${column} da linha ${index + 1}`}
                          className="min-h-16 resize-y"
                          value={row.value[column]}
                          onChange={(event) => updateCell(row.id, column, event.target.value)}
                        />
                      ) : (
                        <Input
                          aria-label={`${column} da linha ${index + 1}`}
                          value={row.value[column]}
                          onChange={(event) => updateCell(row.id, column, event.target.value)}
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="p-1.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover linha ${index + 1}`}
                      onClick={() => setEditableRows((current) => current.filter((item) => item.id !== row.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="px-6 pb-5">
          <Button type="button" variant="outline" className="mr-auto" onClick={() => setEditableRows((current) => [...current, editableRow(createEmptyOneNoteRow())])}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar linha
          </Button>
          <Button type="button" variant="outline" disabled={importing} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={importing || parsed.length === 0} onClick={() => void handleConfirm()}>
            {importing ? "Importando..." : "Confirmar importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}