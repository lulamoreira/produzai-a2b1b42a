import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (!res.ok) { setStatus("invalid"); return; }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch { setStatus("invalid"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      setStatus(error ? "error" : "success");
    } catch { setStatus("error"); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <p className="text-muted-foreground">Verificando...</p>
            </>
          )}
          {status === "valid" && (
            <>
              <MailX className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Cancelar inscrição</h2>
              <p className="text-muted-foreground text-sm">
                Ao confirmar, você deixará de receber emails de notificação do ProduzAI.
              </p>
              <Button onClick={handleUnsubscribe} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar cancelamento
              </Button>
            </>
          )}
          {status === "already" && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Já cancelado</h2>
              <p className="text-muted-foreground text-sm">
                Você já cancelou sua inscrição anteriormente.
              </p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Inscrição cancelada</h2>
              <p className="text-muted-foreground text-sm">
                Você não receberá mais emails de notificação.
              </p>
            </>
          )}
          {(status === "invalid" || status === "error") && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Link inválido</h2>
              <p className="text-muted-foreground text-sm">
                Este link de cancelamento é inválido ou expirou.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
