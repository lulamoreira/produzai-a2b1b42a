import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabaseAnon as supabase } from "@/integrations/supabase/anonClient";
import {
  VISUAL_COMMUNICATION_SERVICES,
  type SupplierContact
} from "@/hooks/useAgencySuppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileText,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatPhoneByCountry } from "@/lib/countryConfig";

const formatCNPJ = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};
const formatPhoneBR = (v: string) => formatPhoneByCountry(v, "BR");



const SupplierInvitePortal = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [agency, setAgency] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mySupplierDraftId, setMySupplierDraftId] = useState<string | null>(null);



  const [form, setForm] = useState({
    company_name: "",
    cnpj: "",
    contact_name: "",
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    observations: "",
    services: [] as string[],
    custom_service: "",
    file_urls: [] as { name: string; url: string }[],
    contacts: [{ nome: "", funcao: "", email: "", telefone: "", whatsapp: "" }] as SupplierContact[],
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState("");

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) return;

      const { data: inv, error: invError } = await (supabase.rpc as any)(
        "get_supplier_invitation_by_token",
        { p_token: token }
      );

      if (invError || !inv) {
        setError("Link inválido");
        setLoading(false);
        return;
      }

      if (new Date((inv as any).expires_at) < new Date()) {
        setError(`Este link expirou em ${format(new Date((inv as any).expires_at), "dd/MM/yyyy HH:mm")}`);
        setLoading(false);
        return;
      }

      setInvitation(inv);
      setAgency((inv as any).agencies);


      // Se o convite está vinculado a um fornecedor específico (link de
      // "confirmar/atualizar dados" enviado por e-mail), carrega os dados
      // existentes para que o fornecedor confira e atualize.
      // Caso contrário (convite genérico de novo cadastro), abre em branco.
      let supplierIdToLoad: string | null = inv.supplier_id || null;

      // Persistência por aba: se já criamos um rascunho nesta sessão para
      // este token, continuamos editando o mesmo registro.
      const draftKey = `supplier_draft_${token}`;
      const draftId = sessionStorage.getItem(draftKey);
      if (!supplierIdToLoad && draftId) supplierIdToLoad = draftId;

      if (supplierIdToLoad) {
        const { data: sup } = await supabase
          .from("agency_suppliers")
          .select("*")
          .eq("id", supplierIdToLoad)
          .maybeSingle();

        if (sup) {
          setMySupplierDraftId(sup.id);
          const services: string[] = Array.isArray(sup.services) ? (sup.services as any[]).map(String) : [];
          const known = new Set(VISUAL_COMMUNICATION_SERVICES);
          const customSvc = services.find(s => !known.has(s)) || "";
          const stdServices = services.filter(s => known.has(s));
          const contacts = Array.isArray(sup.contacts) && sup.contacts.length > 0
            ? (sup.contacts as any as SupplierContact[])
            : [{ nome: "", funcao: "", email: "", telefone: "", whatsapp: "" }];
          setForm(f => ({
            ...f,
            company_name: sup.company_name || "",
            cnpj: sup.cnpj || "",
            contact_name: sup.contact_name || "",
            address: sup.address || "",
            phone: sup.phone || "",
            whatsapp: sup.whatsapp || "",
            email: sup.email || "",
            website: sup.website || "",
            observations: sup.observations || "",
            services: stdServices,
            custom_service: customSvc,
            file_urls: Array.isArray(sup.file_urls) ? sup.file_urls as any : [],
            contacts,
            cep: sup.cep || "",
            logradouro: sup.logradouro || "",
            numero: sup.numero || "",
            complemento: sup.complemento || "",
            bairro: sup.bairro || "",
            cidade: sup.cidade || "",
            estado: sup.estado || "",
          }));
        }
      }

      setLoading(false);
    };

    loadInvitation();
  }, [token]);



  const handleCepSearch = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, "");
    if (cleanedCep.length !== 8) return;

    setIsSearchingCep(true);
    setCepError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError("CEP não encontrado. Preencha o endereço manualmente.");
      } else {
        setForm(f => ({
          ...f,
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          estado: data.uf,
        }));
        setTimeout(() => document.getElementById("numero")?.focus(), 100);
      }
    } catch (error) {
      setCepError("Erro ao buscar CEP. Preencha o endereço manualmente.");
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 8) value = value.slice(0, 8);
    let formatted = value;
    if (value.length > 5) formatted = `${value.slice(0, 5)}-${value.slice(5)}`;
    setForm(f => ({ ...f, cep: formatted }));
    if (value.length === 8) handleCepSearch(value);
  };

  const toggleService = (service: string) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(service)
        ? f.services.filter(s => s !== service)
        : [...f.services, service]
    }));
  };

  const addContact = () => {
    setForm(f => ({
      ...f,
      contacts: [...f.contacts, { nome: "", funcao: "", email: "", telefone: "", whatsapp: "" }]
    }));
  };

  const removeContact = (index: number) => {
    if (form.contacts.length <= 1) return;
    setForm(f => ({
      ...f,
      contacts: f.contacts.filter((_, i) => i !== index)
    }));
  };

  const updateContact = (index: number, field: keyof SupplierContact, value: string) => {
    setForm(f => ({
      ...f,
      contacts: f.contacts.map((c, i) => i === index ? { ...c, [field]: value } : c)
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !invitation) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `suppliers/${invitation.agency_id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("supplier_files").upload(filePath, file);

      if (error) {
        toast.error(`Erro ao enviar arquivo: ${file.name}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from("supplier_files").getPublicUrl(filePath);
      setForm(f => ({ ...f, file_urls: [...f.file_urls, { name: file.name, url: publicUrl }] }));
    }
    toast.success("Arquivos enviados!");
  };

  const removeFile = (index: number) => {
    setForm(f => ({ ...f, file_urls: f.file_urls.filter((_, i) => i !== index) }));
  };

  const handleSave = async (isComplete: boolean) => {
    if (isComplete && !form.cnpj) {
      toast.error("O CNPJ é obrigatório para finalizar o cadastro.");
      return;
    }

    setSaving(true);
    try {
      const finalServices = [...form.services];
      if (form.custom_service.trim()) finalServices.push(form.custom_service.trim());

      const payload: any = {
        agency_id: invitation.agency_id,
        company_name: form.company_name,
        cnpj: form.cnpj || null,
        contact_name: form.contact_name || null,
        address: form.address || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        website: form.website || null,
        observations: form.observations || null,
        services: finalServices,
        file_urls: form.file_urls,
        contacts: form.contacts as any,
        cep: form.cep || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
      };

      let supplierId = mySupplierDraftId;

      if (supplierId) {
        // Atualiza APENAS o rascunho criado nesta mesma sessão/aba.
        // Nunca toca em cadastros pré-existentes de outros fornecedores.
        const { error: updateError } = await supabase
          .from("agency_suppliers")
          .update(payload)
          .eq("id", supplierId);
        if (updateError) throw updateError;
      } else {
        // Novo fornecedor — sempre cria um registro novo e independente.
        // Cadastros existentes JAMAIS são sobrescritos por este portal.
        const newId = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from("agency_suppliers")
          .insert([{ id: newId, ...payload }]);
        if (insertError) throw insertError;
        supplierId = newId;
        setMySupplierDraftId(newId);
        sessionStorage.setItem(`supplier_draft_${token}`, newId);
      }

      if (isComplete) {


        // Auto-send confirmation email (same as the "Enviar e-mail de confirmação" button)

        try {
          const recipientRaw = (form.email || "")
            .normalize("NFKC")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .trim()
            .toLowerCase();

          if (recipientRaw && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(recipientRaw)) {
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 100);

            const { data: followupRes, error: invErr } = await (supabase.rpc as any)(
              "create_followup_supplier_invitation",
              { p_original_token: token, p_supplier_id: supplierId }
            );
            const newInv = (followupRes as any)?.invitation;

            if (!invErr && newInv) {
              const editUrl = `https://produzai.lovable.app/convite/fornecedor/${newInv.token}`;
              const primaryContactName =
                form.contacts?.[0]?.nome || form.contact_name || "Fornecedor";


              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "supplier-data-confirmation",
                  recipientEmail: recipientRaw,
                  idempotencyKey: `supplier-data-confirm-${supplierId}-${newInv.id}`,
                  fromName: agency?.name || undefined,
                  templateData: {
                    contactName: primaryContactName,
                    companyName: form.company_name,
                    agencyName: agency?.name || "",
                    editUrl,
                    expiresAt: expiresAt.toISOString(),
                    supplier: {
                      company_name: form.company_name,
                      cnpj: form.cnpj,
                      contact_name: form.contact_name,
                      email: form.email,
                      phone: form.phone,
                      whatsapp: form.whatsapp,
                      website: form.website,
                      cep: form.cep,
                      logradouro: form.logradouro,
                      numero: form.numero,
                      complemento: form.complemento,
                      bairro: form.bairro,
                      cidade: form.cidade,
                      estado: form.estado,
                      address: form.address,
                      services: finalServices,
                      contacts: form.contacts,
                      observations: form.observations,
                    },
                  },
                },
              });
            }
          }
        } catch (emailErr) {
          // Não interrompe o fluxo se o e-mail falhar
          console.error("Falha ao enviar e-mail de confirmação automático:", emailErr);
        }

        setCompleted(true);
      } else {
        toast.success("Dados salvos! Você pode voltar e continuar depois.");
      }
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">{error}</h1>
        <p className="text-muted-foreground">Caso precise de ajuda, entre em contato com a agência.</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Cadastro enviado com sucesso!</h1>
        <p className="text-muted-foreground max-w-md">
          Guarde este link — ele é <strong>eterno</strong> e você poderá usá-lo sempre que quiser atualizar seus dados.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          {agency?.logo_url && (
            <img src={agency.logo_url} alt={agency.name} className="h-16 mx-auto object-contain" />
          )}
          <div>
            <h1 className="text-2xl font-bold">Cadastro de Fornecedor</h1>
            <p className="text-muted-foreground">
              Você foi convidado para se cadastrar como fornecedor de <span className="font-semibold">{agency?.name}</span>
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-md border border-primary/20 bg-primary/5 text-xs text-foreground/80 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p>
              Este link é <strong>eterno</strong>. Você pode acessá-lo sempre que quiser alterar seus dados —
              não precisa esperar por um novo convite.
            </p>
          </div>
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={e => setForm(f => ({ ...f, company_name: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  inputMode="numeric"
                  onChange={e => setForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Contatos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addContact} className="h-8 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-md border border-primary/20 bg-primary/5 text-xs text-foreground/80">
                <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Você pode cadastrar <strong>vários contatos</strong>. Recomendamos que o
                  <strong> primeiro contato</strong> seja o <strong>responsável comercial</strong>,
                  pois será ele quem receberá as <strong>solicitações de orçamento</strong>.
                </p>
              </div>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {form.contacts.map((contact, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-muted/20 relative space-y-3">
                    {form.contacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 text-destructive"
                        onClick={() => removeContact(index)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={contact.nome} placeholder="Nome" onChange={e => updateContact(index, "nome", e.target.value)} className="h-8 text-xs" />
                      <Input value={contact.funcao} placeholder="Função" onChange={e => updateContact(index, "funcao", e.target.value)} className="h-8 text-xs" />
                    </div>
                    <Input value={contact.email} placeholder="E-mail" onChange={e => updateContact(index, "email", e.target.value)} className="h-8 text-xs" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input value={contact.telefone} placeholder="(XX) XXXXX-XXXX" inputMode="numeric" onChange={e => updateContact(index, "telefone", formatPhoneBR(e.target.value))} className="h-8 text-xs" />
                      <Input value={contact.whatsapp} placeholder="(XX) XXXXX-XXXX" inputMode="numeric" onChange={e => updateContact(index, "whatsapp", formatPhoneBR(e.target.value))} className="h-8 text-xs" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-bold">Endereço</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 relative">
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <Input id="cep" value={form.cep} onChange={handleCepChange} placeholder="00000-000" />
                  {isSearchingCep && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                </div>
                {cepError && <p className="text-[10px] text-destructive absolute -bottom-4">{cepError}</p>}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input id="logradouro" value={form.logradouro} onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Input id="numero" placeholder="Número" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Complemento" value={form.complemento} onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} />
              <Input placeholder="Bairro" value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input className="col-span-2" placeholder="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              <Input placeholder="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-bold">Serviços Oferecidos</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 border rounded-md p-4 max-h-[300px] overflow-y-auto bg-muted/10">
              {VISUAL_COMMUNICATION_SERVICES.map((s) => (
                <div key={s} className="flex items-start gap-2 py-1">
                  <Checkbox id={`service-${s}`} checked={form.services.includes(s)} onCheckedChange={() => toggleService(s)} className="mt-0.5" />
                  <Label htmlFor={`service-${s}`} className="text-xs font-normal cursor-pointer whitespace-normal break-words leading-tight">{s}</Label>
                </div>
              ))}
            </div>
            <Input
              placeholder="Outro serviço (separar por vírgula se mais de um)"
              value={form.custom_service}
              onChange={e => setForm(f => ({ ...f, custom_service: e.target.value }))}
              className="text-xs"
            />
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-bold">Arquivos e Anexos</Label>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
              <p>
                Aproveite para enviar o <strong>book da empresa</strong>, <strong>apresentação institucional</strong> e
                demais documentos (portfólio, certificações, referências etc.) que darão melhores condições de avaliação
                técnica por parte da <strong>{agency?.name || "agência"}</strong>.
              </p>
            </div>
            <div 
              className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => document.getElementById("file-upload-public")?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para enviar arquivos (PDF, Imagens, Documentos)</p>
              <input id="file-upload-public" type="file" multiple className="hidden" onChange={handleFileUpload} />
            </div>
            {form.file_urls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {form.file_urls.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded text-xs border">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea 
              id="observations" 
              placeholder="Alguma informação adicional?"
              className="min-h-[100px]"
              value={form.observations}
              onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              className="h-11"
              disabled={saving} 
              onClick={() => handleSave(false)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Rascunho
            </Button>
            <Button 
              type="button" 
              className="h-11 px-8"
              disabled={saving} 
              onClick={() => handleSave(true)}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Cadastro Completo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierInvitePortal;
