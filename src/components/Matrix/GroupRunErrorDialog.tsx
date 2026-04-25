import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";

export interface GroupRunResult {
  templateId: string;
  templateName: string;
  status: "success" | "error";
  storesUpdated?: number;
  errorMessage?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  results: GroupRunResult[];
  onReview: () => void;
}

/** Translate common Postgres / Supabase error messages into user-friendly Portuguese. */
function humanizeError(raw: string | undefined): string {
  if (!raw) return "Erro desconhecido.";
  const msg = raw.toLowerCase();
  if (msg.includes("on conflict do update command cannot affect row a second time")) {
    return "Esta automação tenta atualizar a mesma peça da mesma loja mais de uma vez no mesmo lote (provavelmente um kit com peças repetidas). Revise o kit ou a configuração da automação.";
  }
  if (msg.includes("foreign key") || msg.includes("violates foreign key constraint")) {
    return "A peça referenciada não existe mais no banco de dados. Substitua ou remova o item da automação.";
  }
  if (msg.includes("duplicate key")) {
    return "Conflito de chave duplicada. Tente revisar a automação.";
  }
  if (msg.includes("permission denied") || msg.includes("rls")) {
    return "Permissão negada para alterar os dados. Verifique seu acesso à campanha.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Falha de rede. Verifique sua conexão e tente novamente.";
  }
  if (msg.includes("timeout")) {
    return "A operação demorou demais para responder. Tente novamente.";
  }
  return raw;
}

export function GroupRunErrorDialog({
  open, onOpenChange, groupName, results, onReview,
}: Props) {
  const successes = results.filter(r => r.status === "success");
  const failures = results.filter(r => r.status === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Resultado da execução: {groupName}
          </DialogTitle>
          <DialogDescription>
            {failures.length === 0
              ? "Todas as automações executaram com sucesso."
              : `${failures.length} ${failures.length === 1 ? "automação falhou" : "automações falharam"} durante a execução.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-1 py-2 border-y">
          <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> {successes.length} executadas
          </Badge>
          {failures.length > 0 && (
            <Badge variant="outline" className="gap-1.5 bg-destructive/10 text-destructive border-destructive/30">
              <AlertCircle className="w-3.5 h-3.5" /> {failures.length} com falha
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-2 py-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`border rounded-lg p-3 ${
                  r.status === "error"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-green-500/30 bg-green-500/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  {r.status === "success"
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{r.templateName}</p>
                    {r.status === "success" ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.storesUpdated ?? 0} {r.storesUpdated === 1 ? "loja atualizada" : "lojas atualizadas"}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-destructive mt-0.5">
                          {humanizeError(r.errorMessage)}
                        </p>
                        {r.errorMessage && humanizeError(r.errorMessage) !== r.errorMessage && (
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all">
                            {r.errorMessage}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {failures.length > 0 && (
            <Button variant="outline" onClick={onReview}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Revisar grupo
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
