import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  User as UserIcon,
  FileText,
  Send,
  Loader2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import type { AgencySupplier } from "@/hooks/useAgencySuppliers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: AgencySupplier | null;
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm py-1">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export default function SupplierDetailsSheet({ open, onOpenChange, supplier }: Props) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState("");

  const { data: agency } = useQuery({
    queryKey: ["agency_name_for_email", supplier?.agency_id],
    queryFn: async () => {
      if (!supplier?.agency_id) return null;
      const { data } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", supplier.agency_id)
        .maybeSingle();
      return data;
    },
    enabled: !!supplier?.agency_id && open,
  });

  // Preselect primary email
  useMemo(() => {
    if (open && supplier) {
      const primary = supplier.contacts?.[0]?.email || supplier.email || "";
      setRecipient(primary);
    }
  }, [open, supplier?.id]);

  if (!supplier) return null;

  const fullAddress = [
    supplier.logradouro,
    supplier.numero,
    supplier.complemento,
    supplier.bairro,
    supplier.cidade && supplier.estado
      ? `${supplier.cidade}/${supplier.estado}`
      : supplier.cidade || supplier.estado,
    supplier.cep,
  ]
    .filter(Boolean)
    .join(", ") || supplier.address || "";

  const primaryContactName =
    supplier.contacts?.[0]?.nome || supplier.contact_name || "Fornecedor";

  const handleSendEmail = async () => {
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (!user || !supplier.agency_id) return;
    setSending(true);
    try {
      // Generate invitation token linked to this supplier (edit mode)
      const expiresAt = addDays(new Date(), 30);
      const { data: inv, error: invErr } = await supabase
        .from("supplier_invitations")
        .insert([{
          agency_id: supplier.agency_id,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          status: "pending",
          supplier_id: supplier.id,
        }])
        .select()
        .single();
      if (invErr) throw invErr;

      const editUrl = `${window.location.origin}/convite/fornecedor/${inv.token}`;

      const { error: emailErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "supplier-data-confirmation",
          recipientEmail: recipient,
          idempotencyKey: `supplier-data-confirm-${supplier.id}-${inv.id}`,
          templateData: {
            contactName: primaryContactName,
            companyName: supplier.company_name,
            agencyName: agency?.name || "",
            editUrl,
            expiresAt: expiresAt.toISOString(),
            supplier: {
              company_name: supplier.company_name,
              cnpj: supplier.cnpj,
              contact_name: supplier.contact_name,
              email: supplier.email,
              phone: supplier.phone,
              whatsapp: supplier.whatsapp,
              website: supplier.website,
              cep: supplier.cep,
              logradouro: supplier.logradouro,
              numero: supplier.numero,
              complemento: supplier.complemento,
              bairro: supplier.bairro,
              cidade: supplier.cidade,
              estado: supplier.estado,
              address: supplier.address,
              services: supplier.services,
              contacts: supplier.contacts,
              observations: supplier.observations,
            },
          },
        },
      });
      if (emailErr) throw emailErr;

      toast.success(`E-mail de confirmação enviado para ${recipient}`);
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail: " + (err.message || err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {supplier.company_name}
          </SheetTitle>
          <SheetDescription>{supplier.cnpj || "Sem CNPJ"}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Empresa */}
          <section>
            <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Empresa
            </h3>
            <DataRow label="Razão Social" value={supplier.company_name} />
            <DataRow label="CNPJ" value={supplier.cnpj} />
            <DataRow label="Website" value={supplier.website} />
          </section>

          {fullAddress && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Endereço
                </h3>
                <p className="text-sm">{fullAddress}</p>
              </section>
            </>
          )}

          <Separator />
          <section>
            <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" /> Contato Principal
            </h3>
            <DataRow label="Nome" value={supplier.contact_name} />
            <DataRow label="E-mail" value={supplier.email} />
            <DataRow label="Telefone" value={supplier.phone} />
            <DataRow label="WhatsApp" value={supplier.whatsapp} />
          </section>

          {supplier.contacts?.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> Contatos ({supplier.contacts.length})
                </h3>
                <div className="space-y-3">
                  {supplier.contacts.map((c, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-muted/30">
                      <div className="font-medium text-sm">
                        {c.nome || "—"}{c.funcao ? ` · ${c.funcao}` : ""}
                      </div>
                      <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                        {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{c.email}</div>}
                        {c.telefone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{c.telefone}</div>}
                        {c.whatsapp && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />WhatsApp: {c.whatsapp}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {supplier.services?.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Serviços</h3>
                <div className="flex flex-wrap gap-1.5">
                  {supplier.services.map((s, i) => (
                    <Badge key={i} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </section>
            </>
          )}

          {supplier.file_urls?.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Arquivos
                </h3>
                <div className="space-y-1">
                  {supplier.file_urls.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {f.name}
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}

          {supplier.observations && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Observações</h3>
                <p className="text-sm whitespace-pre-wrap">{supplier.observations}</p>
              </section>
            </>
          )}

          <Separator />

          {/* Send confirmation email */}
          <section className="bg-muted/40 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-primary" /> Enviar e-mail de confirmação
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                O fornecedor receberá todos os dados cadastrais e um link seguro para conferir/editar suas informações.
                O link é válido por 30 dias.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="recipient-email" className="text-xs">E-mail do destinatário</Label>
              <Input
                id="recipient-email"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="fornecedor@email.com"
                disabled={sending}
              />
            </div>
            <Button onClick={handleSendEmail} disabled={sending || !recipient} className="w-full">
              {sending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Enviar e-mail de confirmação</>
              )}
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
