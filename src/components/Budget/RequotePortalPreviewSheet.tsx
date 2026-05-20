import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye, Lock, Loader2, Package } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import PieceThumbnail from "@/components/PieceThumbnail";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adjustmentId: string | null;
  supplierId: string | null;
  requestId: string | null;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(n) ? n : 0,
  );

export function RequotePortalPreviewSheet({
  open,
  onOpenChange,
  adjustmentId,
  supplierId,
  requestId,
}: Props) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const enabled = open && !!adjustmentId && !!supplierId;

  const { data: adjustment } = useQuery({
    queryKey: ["preview_adjustment", adjustmentId],
    enabled: !!adjustmentId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustments")
        .select("id, name, campaign_id")
        .eq("id", adjustmentId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: supplier } = useQuery({
    queryKey: ["preview_supplier", supplierId],
    enabled: !!supplierId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_suppliers")
        .select("company_name, contact_name")
        .eq("id", supplierId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: request } = useQuery({
    queryKey: ["preview_request", requestId],
    enabled: !!requestId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_budget_request" as any)
        .select("*")
        .eq("id", requestId!)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: pieces } = useQuery({
    queryKey: ["preview_pieces", adjustmentId],
    enabled: enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_pieces" as any)
        .select("id, name, code, specification, change_type, is_deleted, image_url, image_thumb_url")
        .eq("adjustment_id", adjustmentId!)
        .eq("is_deleted", false)
        .order("code");
      return (data as any[]) ?? [];
    },
  });

  const { data: kits } = useQuery({
    queryKey: ["preview_kits", adjustmentId],
    enabled: enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_adjustment_kits" as any)
        .select("id, name, code, image_url, is_deleted")
        .eq("adjustment_id", adjustmentId!)
        .eq("is_deleted", false)
        .order("code");
      return (data as any[]) ?? [];
    },
  });

  const { data: baselinePrices } = useQuery({
    queryKey: ["preview_baseline_prices", supplierId],
    enabled: !!supplierId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_prices" as any)
        .select("piece_id, kit_id, adjusted_unit_price, unit_price")
        .eq("supplier_id", supplierId!);
      return (data as any[]) ?? [];
    },
  });

  const { data: extras } = useQuery({
    queryKey: ["preview_extras", supplierId],
    enabled: !!supplierId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("budget_extra_costs" as any)
        .select("adjusted_installation_value, installation_value, adjusted_freight_value, freight_value")
        .eq("supplier_id", supplierId!)
        .maybeSingle();
      return data as any;
    },
  });

  const isLoading = enabled && (!adjustment || !supplier || !pieces);

  const getPreviousPrice = (pieceId?: string, kitId?: string) => {
    const row = baselinePrices?.find(
      (p) =>
        (pieceId && p.piece_id === pieceId) ||
        (kitId && p.kit_id === kitId),
    );
    return Number(row?.adjusted_unit_price ?? row?.unit_price ?? 0);
  };

  const submittedPrices: any[] = request?.adjusted_prices_jsonb?.prices ?? [];
  const submittedKits: any[] = request?.adjusted_prices_jsonb?.kits ?? [];
  const submittedExtras = request?.adjusted_extras_jsonb ?? {};

  const statusLabel = (() => {
    switch (request?.status) {
      case "submitted": return "Enviado pelo fornecedor";
      case "approved":  return t("budgets.approved");
      case "rejected":  return "Recusado";
      case "filling":   return "Fornecedor preenchendo";
      case "sent":      return "Aguardando resposta";
      default:          return t("budgets.pending");
    }
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[92vh] overflow-y-auto p-0"
            : "w-full sm:max-w-3xl overflow-y-auto p-0"
        }
      >
        {/* Preview banner */}
        <div className="sticky top-0 z-10 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow">
          <Eye className="w-4 h-4" />
          <span>MODO PREVIEW — Visão do fornecedor (somente leitura)</span>
          <Lock className="w-3.5 h-3.5" />
        </div>

        <SheetHeader className="px-6 pt-4 pb-2">
          <SheetTitle className="text-base">Prévia do portal de recotação</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando prévia...
          </div>
        ) : (
          <div className="px-6 pb-10 space-y-6">
            {/* Header */}
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Recotação
              </div>
              <h2 className="text-lg font-semibold mt-0.5">{adjustment?.name}</h2>
              <div className="text-sm text-muted-foreground mt-1">
                <span className="font-medium text-foreground">
                  {supplier?.company_name}
                </span>
                {supplier?.contact_name ? ` — ${supplier.contact_name}` : ""}
              </div>
            </div>

            {/* Deadline + status */}
            {request && (
              <div className="rounded-md border bg-muted/30 p-3 flex flex-wrap items-center gap-2 text-sm">
                {request.token_expires_at && (
                  <>
                    <span className="text-muted-foreground">Prazo:</span>
                    <span className="font-medium">
                      {format(
                        new Date(request.token_expires_at),
                        "dd/MM/yyyy 'às' HH:mm"
                      )}
                    </span>
                  </>
                )}
                <Badge variant="secondary" className="ml-auto">
                  {statusLabel}
                </Badge>
              </div>
            )}

            {/* Itens */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Itens para cotar</h3>
              <div className="rounded-lg border divide-y">
                {(pieces ?? []).map((piece) => {
                  const prev = getPreviousPrice(piece.id);
                  const submitted = submittedPrices.find(
                    (p: any) => p.piece_id === piece.id,
                  );
                  return (
                    <div key={piece.id} className="flex items-center gap-3 p-3">
                      <PieceThumbnail
                        imageUrl={piece.image_thumb_url || piece.image_url}
                        name={piece.name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-muted-foreground">
                          #{piece.code}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {piece.name}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {piece.change_type === "added" && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] h-4">
                              Nova
                            </Badge>
                          )}
                          {piece.change_type === "modified" && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] h-4">
                              Modificada
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase text-muted-foreground">
                          Anterior: {fmtBRL(prev)}
                        </div>
                        <div
                          className={
                            submitted?.new_price
                              ? "text-sm font-semibold text-blue-700 dark:text-blue-300"
                              : "text-sm text-muted-foreground italic"
                          }
                        >
                          {submitted?.new_price
                            ? fmtBRL(Number(submitted.new_price))
                            : "(vazio)"}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(kits ?? []).map((kit) => {
                  const prev = getPreviousPrice(undefined, kit.id);
                  const submitted = submittedKits.find(
                    (k: any) => k.kit_id === kit.id,
                  );
                  return (
                    <div
                      key={kit.id}
                      className="flex items-center gap-3 p-3 border-l-2 border-dashed border-primary/40"
                    >
                      <div className="w-10 h-10 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-muted-foreground">
                          #{kit.code}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {kit.name}
                        </div>
                        <Badge variant="outline" className="text-[10px] h-4 mt-1">
                          Kit
                        </Badge>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase text-muted-foreground">
                          Anterior: {fmtBRL(prev)}
                        </div>
                        <div
                          className={
                            submitted?.new_price
                              ? "text-sm font-semibold text-blue-700 dark:text-blue-300"
                              : "text-sm text-muted-foreground italic"
                          }
                        >
                          {submitted?.new_price
                            ? fmtBRL(Number(submitted.new_price))
                            : "(vazio)"}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(pieces?.length ?? 0) === 0 && (kits?.length ?? 0) === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhuma peça ou kit para recotar.
                  </div>
                )}
              </div>
            </div>

            {/* Extras */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Instalação e Frete</h3>
              <div className="rounded-lg border divide-y">
                {(["installation", "freight"] as const).map((kind) => {
                  const label = kind === "installation" ? "Instalação" : "Frete";
                  const prev =
                    kind === "installation"
                      ? Number(
                          extras?.adjusted_installation_value ??
                            extras?.installation_value ??
                            0,
                        )
                      : Number(
                          extras?.adjusted_freight_value ??
                            extras?.freight_value ??
                            0,
                        );
                  const val = submittedExtras?.[kind];
                  const hasVal = val !== undefined && val !== null && val !== "";
                  return (
                    <div key={kind} className="flex items-center gap-3 p-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-[10px] uppercase text-muted-foreground">
                          Anterior: {fmtBRL(prev)}
                        </div>
                      </div>
                      <div
                        className={
                          hasVal
                            ? "text-sm font-semibold text-blue-700 dark:text-blue-300"
                            : "text-sm text-muted-foreground italic"
                        }
                      >
                        {hasVal ? fmtBRL(Number(val)) : "(vazio)"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer note */}
            <div className="text-xs text-muted-foreground italic text-center pt-2">
              Esta é uma prévia do portal do fornecedor. O fornecedor verá esta
              tela ao acessar o link enviado.
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default RequotePortalPreviewSheet;
