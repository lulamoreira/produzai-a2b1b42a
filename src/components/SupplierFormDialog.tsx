import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useAddAgencySupplier,
  useUpdateAgencySupplier,
  VISUAL_COMMUNICATION_SERVICES,
  type AgencySupplier,
  type SupplierContact,
} from "@/hooks/useAgencySuppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Upload,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { buildSupplierFilePath, SUPPLIER_FILES_BUCKET } from "@/lib/supplierFiles";
import {
  normalizeSocialUrl,
  isValidSocialUrl,
  SOCIAL_ERROR_MESSAGE,
  type SocialNetwork,
} from "@/lib/socialUrls";
import {
  getCountryConfig,
  SUPPLIER_COUNTRIES,
  formatTaxId,
  validateTaxId,
  getTaxIdPlaceholder,
} from "@/lib/countryConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | undefined;
  editingSupplier?: AgencySupplier | null;
  onSaved?: (supplier: AgencySupplier) => void;
}

const emptyForm = () => ({
  company_name: "",
  trade_name: "",
  country: "BR",
  cnpj: "",
  contact_name: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  linkedin: "",
  facebook: "",
  observations: "",
  services: [] as string[],
  custom_service: "",
  file_urls: [] as { name: string; url?: string | null; path?: string | null }[],
  contacts: [{ nome: "", funcao: "", email: "", telefone: "", whatsapp: "" }] as SupplierContact[],
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
});

export default function SupplierFormDialog({
  open,
  onOpenChange,
  agencyId,
  editingSupplier,
  onSaved,
}: SupplierFormDialogProps) {
  const addSupplier = useAddAgencySupplier();
  const updateSupplier = useUpdateAgencySupplier();

  const [form, setForm] = useState(emptyForm());
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState("");
  const [socialErrors, setSocialErrors] = useState<Record<SocialNetwork, string>>({
    instagram: "",
    linkedin: "",
    facebook: "",
  });

  const handleSocialBlur = (network: SocialNetwork) => {
    const raw = form[network];
    if (!raw.trim()) {
      setSocialErrors((e) => ({ ...e, [network]: "" }));
      return;
    }
    const normalized = normalizeSocialUrl(network, raw);
    if (normalized === null || !isValidSocialUrl(network, normalized)) {
      setSocialErrors((e) => ({ ...e, [network]: SOCIAL_ERROR_MESSAGE[network] }));
      return;
    }
    setSocialErrors((e) => ({ ...e, [network]: "" }));
    if (normalized !== raw) setForm((f) => ({ ...f, [network]: normalized }));
  };

  useEffect(() => {
    if (!open) return;
    setCepError("");
    setSocialErrors({ instagram: "", linkedin: "", facebook: "" });
    if (editingSupplier) {
      const s = editingSupplier;
      setForm({
        company_name: s.company_name,
        trade_name: s.trade_name || "",
        country: s.country || "BR",
        cnpj: s.cnpj || "",
        contact_name: s.contact_name || "",
        address: s.address || "",
        phone: s.phone || "",
        whatsapp: s.whatsapp || "",
        email: s.email || "",
        website: s.website || "",
        instagram: s.instagram || "",
        linkedin: s.linkedin || "",
        facebook: s.facebook || "",
        observations: s.observations || "",
        services: (s.services as string[]) || [],
        custom_service: "",
        file_urls: (s.file_urls as { name: string; url?: string | null; path?: string | null }[]) || [],
        contacts:
          s.contacts && s.contacts.length > 0
            ? s.contacts
            : [{ nome: "", funcao: "", email: "", telefone: "", whatsapp: "" }],
        cep: s.cep || "",
        logradouro: s.logradouro || "",
        numero: s.numero || "",
        complemento: s.complemento || "",
        bairro: s.bairro || "",
        cidade: s.cidade || "",
        estado: s.estado || "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editingSupplier]);

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
        setForm((f) => ({ ...f, logradouro: "", bairro: "", cidade: "", estado: "" }));
      } else {
        setForm((f) => ({
          ...f,
          logradouro: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          estado: data.uf,
        }));
        setTimeout(() => document.getElementById("numero")?.focus(), 100);
      }
    } catch {
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
    setForm((f) => ({ ...f, cep: formatted }));
    if (value.length === 8) handleCepSearch(value);
  };

  const addContact = () =>
    setForm((f) => ({
      ...f,
      contacts: [...f.contacts, { nome: "", funcao: "", email: "", telefone: "", whatsapp: "" }],
    }));

  const removeContact = (index: number) => {
    if (form.contacts.length <= 1) return;
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, i) => i !== index) }));
  };

  const updateContact = (index: number, field: keyof SupplierContact, value: string) => {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  const toggleService = (service: string) =>
    setForm((f) => ({
      ...f,
      services: f.services.includes(service)
        ? f.services.filter((s) => s !== service)
        : [...f.services, service],
    }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !agencyId) return;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = buildSupplierFilePath(agencyId, file.name);
      const { error } = await supabase.storage.from(SUPPLIER_FILES_BUCKET).upload(filePath, file);
      if (error) {
        toast.error(`Erro ao enviar arquivo: ${file.name}`);
        errorCount++;
        continue;
      }
      setForm((f) => ({ ...f, file_urls: [...f.file_urls, { name: file.name, path: filePath }] }));
      successCount++;
    }

    if (successCount > 0 && errorCount === 0) {
      toast.success("Arquivos enviados!");
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} arquivo(s) enviado(s), ${errorCount} com erro.`);
    }
  };

  const removeFile = (index: number) =>
    setForm((f) => ({ ...f, file_urls: f.file_urls.filter((_, i) => i !== index) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;

    // Normalize + validate social fields before saving
    const socials: Record<SocialNetwork, string | null> = {
      instagram: null,
      linkedin: null,
      facebook: null,
    };
    const nextErrors: Record<SocialNetwork, string> = { instagram: "", linkedin: "", facebook: "" };
    let hasError = false;
    (["instagram", "linkedin", "facebook"] as SocialNetwork[]).forEach((net) => {
      const raw = form[net];
      if (!raw.trim()) return;
      const normalized = normalizeSocialUrl(net, raw);
      if (normalized === null || !isValidSocialUrl(net, normalized)) {
        nextErrors[net] = SOCIAL_ERROR_MESSAGE[net];
        hasError = true;
        return;
      }
      socials[net] = normalized;
    });
    setSocialErrors(nextErrors);
    if (hasError) {
      toast.error("Corrija os campos de redes sociais antes de salvar.");
      return;
    }

    const finalServices = [...form.services];
    if (form.custom_service.trim()) finalServices.push(form.custom_service.trim());

    const payload = {
      agency_id: agencyId,
      company_name: form.company_name,
      trade_name: form.trade_name || null,
      cnpj: form.cnpj || null,
      contact_name: form.contact_name || null,
      address: form.address || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      website: form.website || null,
      instagram: socials.instagram,
      linkedin: socials.linkedin,
      facebook: socials.facebook,
      observations: form.observations || null,
      services: finalServices,
      file_urls: form.file_urls,
      contacts: form.contacts,
      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
    };

    try {
      let saved: AgencySupplier;
      if (editingSupplier) {
        await updateSupplier.mutateAsync({ id: editingSupplier.id, ...payload });
        saved = { ...(editingSupplier as AgencySupplier), ...(payload as any) };
      } else {
        saved = await addSupplier.mutateAsync(payload);
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      /* toast handled by hooks */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Razão Social *</Label>
                <Input
                  id="company_name"
                  required
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade_name">Nome Fantasia</Label>
                <Input
                  id="trade_name"
                  value={form.trade_name}
                  onChange={(e) => setForm((f) => ({ ...f, trade_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://..."
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    placeholder="@usuario ou URL"
                    value={form.instagram}
                    onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                    onBlur={() => handleSocialBlur("instagram")}
                    aria-invalid={!!socialErrors.instagram}
                    className={socialErrors.instagram ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {socialErrors.instagram && (
                    <p className="text-[11px] text-destructive">{socialErrors.instagram}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    placeholder="URL ou usuário"
                    value={form.linkedin}
                    onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                    onBlur={() => handleSocialBlur("linkedin")}
                    aria-invalid={!!socialErrors.linkedin}
                    className={socialErrors.linkedin ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {socialErrors.linkedin && (
                    <p className="text-[11px] text-destructive">{socialErrors.linkedin}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    placeholder="URL ou usuário"
                    value={form.facebook}
                    onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))}
                    onBlur={() => handleSocialBlur("facebook")}
                    aria-invalid={!!socialErrors.facebook}
                    className={socialErrors.facebook ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {socialErrors.facebook && (
                    <p className="text-[11px] text-destructive">{socialErrors.facebook}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                />
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Contatos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addContact} className="h-8 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Adicionar contato
                  </Button>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {form.contacts.map((contact, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-muted/20 relative space-y-3">
                      {form.contacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeContact(index)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase">Nome</Label>
                          <Input
                            value={contact.nome}
                            onChange={(e) => updateContact(index, "nome", e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Nome do contato"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase">Função</Label>
                          <Input
                            value={contact.funcao}
                            onChange={(e) => updateContact(index, "funcao", e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Ex: Gerente Comercial"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">E-mail</Label>
                        <Input
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateContact(index, "email", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="email@empresa.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase">Telefone</Label>
                          <Input
                            value={contact.telefone}
                            onChange={(e) => updateContact(index, "telefone", e.target.value)}
                            className="h-8 text-xs"
                            placeholder="(00) 0000-0000"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase">WhatsApp</Label>
                          <Input
                            value={contact.whatsapp}
                            onChange={(e) => updateContact(index, "whatsapp", e.target.value)}
                            className="h-8 text-xs"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4 pt-2">
                <Label className="text-sm font-bold">Endereço</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="relative">
                      <Input
                        id="cep"
                        value={form.cep}
                        onChange={handleCepChange}
                        onBlur={(e) => handleCepSearch(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {isSearchingCep && (
                        <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      )}
                    </div>
                    {cepError && (
                      <p className="text-[10px] text-destructive absolute -bottom-4 left-0">{cepError}</p>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="logradouro">Logradouro</Label>
                    <Input
                      id="logradouro"
                      value={form.logradouro}
                      onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número</Label>
                    <Input
                      id="numero"
                      value={form.numero}
                      onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input
                      id="complemento"
                      value={form.complemento}
                      onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input
                      id="bairro"
                      value={form.bairro}
                      onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={form.cidade}
                      onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado (UF)</Label>
                    <Input
                      id="estado"
                      value={form.estado}
                      onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Serviços Oferecidos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 border rounded-md p-3 max-h-[300px] overflow-y-auto bg-muted/30">
                  {VISUAL_COMMUNICATION_SERVICES.map((s) => (
                    <div key={s} className="flex items-start gap-2 py-1">
                      <Checkbox
                        id={`service-${s}`}
                        checked={form.services.includes(s)}
                        onCheckedChange={() => toggleService(s)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`service-${s}`}
                        className="text-xs font-normal cursor-pointer whitespace-normal break-words leading-tight"
                      >
                        {s}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <Label htmlFor="custom_service" className="text-[10px] text-muted-foreground">
                    Outro serviço (separar por vírgula se mais de um)
                  </Label>
                  <Input
                    id="custom_service"
                    placeholder="Ex: Drone, Brindes..."
                    value={form.custom_service}
                    onChange={(e) => setForm((f) => ({ ...f, custom_service: e.target.value }))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Arquivos e Anexos</Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Envie book, apresentação da empresa, portfólio, certificações e referências.
                  Esses documentos darão melhores condições de avaliação técnica por parte da agência.
                </p>
                <div
                  className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Arraste ou clique para enviar arquivos (PDF, Imagens, Documentos)
                  </p>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {form.file_urls.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {form.file_urls.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-muted/50 p-2 rounded text-xs border"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => removeFile(i)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              placeholder="Informações adicionais sobre o fornecedor..."
              className="min-h-[100px]"
              value={form.observations}
              onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pb-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addSupplier.isPending || updateSupplier.isPending}>
              {editingSupplier ? "Salvar Alterações" : "Cadastrar Fornecedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
