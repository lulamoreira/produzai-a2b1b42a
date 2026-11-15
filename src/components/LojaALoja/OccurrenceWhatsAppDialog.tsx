import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Copy, Link2, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getCountryConfig, formatPhoneByCountry } from "@/lib/countryConfig";
import { buildWhatsappNumber, normalizeCountryCode } from "@/lib/occurrenceWhatsappMessage";
import { useGenerateStoreToken } from "@/hooks/useStorePortalTokens";

export interface OccurrenceWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto padrão já montado pelo pai (muda quando o link da loja é gerado). */
  message: string;
  store: { id: string; name: string; phone?: string | null; country?: string | null };
  campaignId: string;
  /** Link da loja já incluído na mensagem (vazio quando a loja ainda não tem link). */
  portalUrl?: string;
}

interface Recipient { key: string; label: string; phone: string }

export function OccurrenceWhatsAppDialog({ open, onOpenChange, message, store, campaignId, portalUrl }: OccurrenceWhatsAppDialogProps) {
  const [text, setText] = useState(message);
  const [selected, setSelected] = useState<string>("");
  const [otherNumber, setOtherNumber] = useState("");
  const generate = useGenerateStoreToken();

  const countryCode = normalizeCountryCode(store.country);
  const cfg = getCountryConfig(countryCode);

  // Contatos da loja (somente leitura).
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["store-contacts-whatsapp", store.id],
    enabled: open && !!store.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_contacts")
        .select("id, name, phone")
        .eq("store_id", store.id)
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((c) => (c.phone ?? "").trim());
    },
  });

  const recipients = useMemo<Recipient[]>(() => {
    const list: Recipient[] = [];
    const storePhone = (store.phone ?? "").trim();
    if (storePhone) list.push({ key: "store", label: "Telefone da loja", phone: storePhone });
    contacts.forEach((c) => list.push({ key: `c:${c.id}`, label: c.name?.trim() || "Contato", phone: (c.phone ?? "").trim() }));
    return list;
  }, [store.phone, contacts]);

  // Ao abrir (ou quando o texto padrão muda, ex.: link gerado), carrega o texto padrão.
  useEffect(() => { if (open) setText(message); }, [open, message]);

  // Seleção padrão: telefone da loja → primeiro contato → "Outro número".
  useEffect(() => {
    if (!open || loadingContacts) return;
    setSelected((cur) => (cur && (cur === "other" || recipients.some((r) => r.key === cur)) ? cur : recipients[0]?.key ?? "other"));
  }, [open, loadingContacts, recipients]);

  useEffect(() => { if (!open) { setSelected(""); setOtherNumber(""); } }, [open]);

  const rawPhone = selected === "other" ? otherNumber : recipients.find((r) => r.key === selected)?.phone ?? "";
  const waNumber = buildWhatsappNumber(rawPhone, cfg.code, cfg.phonePrefix);

  const readable = (phone: string) => {
    const n = buildWhatsappNumber(phone, cfg.code, cfg.phonePrefix);
    if (!n) return phone;
    if (!n.startsWith(cfg.phonePrefix)) return `+${n}`;
    return `+${cfg.phonePrefix} ${formatPhoneByCountry(n.slice(cfg.phonePrefix.length), cfg.code)}`;
  };

  function openWhatsapp() {
    if (!waNumber) return;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada.");
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Enviar retorno à loja por WhatsApp</DialogTitle>
          <DialogDescription className="break-words">{store.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Para:</Label>
            {loadingContacts ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando contatos…</div>
            ) : (
              <RadioGroup value={selected} onValueChange={setSelected} className="gap-2">
                {recipients.map((r) => (
                  <div key={r.key} className="flex items-start gap-2 min-w-0">
                    <RadioGroupItem value={r.key} id={`wa-${r.key}`} className="mt-0.5" />
                    <Label htmlFor={`wa-${r.key}`} className="text-sm font-normal flex flex-wrap gap-x-2 min-w-0 break-words cursor-pointer">
                      <span>{r.label}</span>
                      <span className="text-muted-foreground">{readable(r.phone)}</span>
                    </Label>
                  </div>
                ))}
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="other" id="wa-other" className="mt-0.5" />
                  <Label htmlFor="wa-other" className="text-sm font-normal cursor-pointer">Outro número</Label>
                </div>
              </RadioGroup>
            )}
            {!loadingContacts && recipients.length === 0 && (
              <p className="text-xs text-muted-foreground">Esta loja não tem telefone cadastrado. Copie a mensagem ou digite um número.</p>
            )}
            {selected === "other" && (
              <Input
                value={otherNumber}
                onChange={(e) => setOtherNumber(e.target.value)}
                placeholder={`+${cfg.phonePrefix} ...`}
                inputMode="tel"
                className="h-9"
                aria-label="Outro número"
              />
            )}
            {rawPhone.trim() && !waNumber && (
              <p className="text-xs text-destructive">Número inválido para o WhatsApp.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {portalUrl ? (
              <span className="flex items-center gap-1.5 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Link da loja incluído</span>
            ) : (
              <>
                <span className="text-muted-foreground">A loja ainda não tem link</span>
                <Button
                  type="button" size="sm" variant="outline" className="h-7 gap-1.5"
                  disabled={generate.isPending || !store.id}
                  onClick={() => generate.mutate({ campaign_id: campaignId, store_id: store.id })}
                >
                  {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  Gerar link da loja
                </Button>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="wa-text" className="text-xs font-medium text-muted-foreground">Mensagem</Label>
              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => setText(message)}>
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar texto padrão
              </Button>
            </div>
            <Textarea id="wa-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} className="min-h-[18rem] text-sm" />
            <p className="text-[11px] text-muted-foreground">A mensagem usa o que está na tela agora. Salve a tratativa antes se quiser registrar as mudanças.</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" className="gap-1.5" onClick={copy}>
              <Copy className="w-4 h-4" /> Copiar mensagem
            </Button>
            <Button type="button" className="gap-1.5 bg-success text-primary-foreground hover:bg-success/90" disabled={!waNumber || !text.trim()} onClick={openWhatsapp}>
              <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
