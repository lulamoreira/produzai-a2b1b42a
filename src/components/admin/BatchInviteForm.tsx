import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDisplayName } from "@/components/AppHeader";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FileSpreadsheet, Download, Copy, Check, ChevronLeft, CheckCircle2, Mail, AlertCircle, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { downloadCsv } from "@/lib/downloadCsv";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usePermissionCategories } from "@/hooks/usePermissionCategories";

interface BatchRow {
  id: string;
  name: string;
  email: string;
  role: string;
  agency_id: string;
  valid: boolean;
  error?: string;
  existing?: boolean;
}

const ROLES = [
  { value: "viewer", labelKey: "invite.roles.viewer", shortLabel: "Visualizador" },
  { value: "editor", labelKey: "invite.roles.editor", shortLabel: "Editor" },
  { value: "manager", labelKey: "invite.roles.manager", shortLabel: "Gerente" },
  { value: "master", labelKey: "invite.roles.master", shortLabel: "Master" },
  { value: "admin", labelKey: "invite.roles.admin", shortLabel: "Admin" },
];

const VALIDITY_OPTIONS = [
  { value: "7", labelKey: "invite.form.days7" },
  { value: "15", labelKey: "invite.form.days15" },
  { value: "30", labelKey: "invite.form.days30" },
];

export function BatchInviteForm() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { displayName } = useDisplayName();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'edit' | 'preview' | 'done'>('edit');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([
    { id: Math.random().toString(), name: "", email: "", role: "viewer", agency_id: "none", valid: false },
    { id: Math.random().toString(), name: "", email: "", role: "viewer", agency_id: "none", valid: false },
    { id: Math.random().toString(), name: "", email: "", role: "viewer", agency_id: "none", valid: false },
  ]);

  const [globalConfig, setGlobalSettings] = useState({
    role: "viewer",
    agency_id: "none",
    validity: "15"
  });

  const [createdInvites, setCreatedInvites] = useState<any[]>([]);
  const [campaignAccess, setCampaignAccess] = useState<any[]>([]);

  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: allCampaigns = [] } = useQuery({
    queryKey: ["all-campaigns-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_id, clients(name, agency_id, agencies(name))")
        .order("name");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: categories = [] } = usePermissionCategories();

  const { data: existingEmails = [] } = useQuery({
    queryKey: ["existing-invites-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invites").select("email");
      if (error) throw error;
      return data.map(d => d.email.toLowerCase());
    },
    enabled: open
  });

  const validateRow = (row: BatchRow) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let valid = true;
    let error = "";
    let existing = false;

    if (!row.name.trim()) {
      valid = false;
    } else if (!row.email.trim() || !emailRegex.test(row.email)) {
      valid = false;
    } else if (existingEmails.includes(row.email.toLowerCase())) {
      valid = false;
      error = t("invite.batch.alreadyInvited");
      existing = true;
    }

    return { ...row, valid, error, existing };
  };

  const addRow = () => {
    setRows([
      ...rows,
      { 
        id: Math.random().toString(), 
        name: "", 
        email: "", 
        role: globalConfig.role, 
        agency_id: globalConfig.agency_id,
        valid: false 
      }
    ]);
  };

  const updateRow = (id: string, updates: Partial<BatchRow>) => {
    setRows(rows.map(r => r.id === id ? validateRow({ ...r, ...updates }) : r));
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const handleGlobalChange = (key: string, value: string) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'role' || key === 'agency_id') {
      setRows(rows.map(r => validateRow({ ...r, [key]: value })));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (json.length < 2) throw new Error("File empty");

        const headers = (json[0] as string[]).map(h => h?.toString().toLowerCase().trim());
        const nameIdx = headers.findIndex(h => h === 'nome' || h === 'name');
        const emailIdx = headers.findIndex(h => h === 'email');
        const roleIdx = headers.findIndex(h => h === 'papel' || h === 'role');
        const agencyIdx = headers.findIndex(h => h === 'agência' || h === 'agencia' || h === 'agency');

        if (emailIdx === -1) {
          toast.error(t("invite.batch.importError"));
          return;
        }

        const importedRows: BatchRow[] = json.slice(1)
          .filter(r => r[emailIdx])
          .map(r => {
            const roleStr = r[roleIdx]?.toString().toLowerCase().trim() || globalConfig.role;
            const agencyStr = r[agencyIdx]?.toString().trim();
            
            // Basic role mapping
            let role = globalConfig.role;
            if (roleStr.includes('admin')) role = 'admin';
            else if (roleStr.includes('master')) role = 'master';
            else if (roleStr.includes('gerente') || roleStr.includes('manager')) role = 'manager';
            else if (roleStr.includes('editor')) role = 'editor';
            else if (roleStr.includes('visualizador') || roleStr.includes('viewer')) role = 'viewer';

            // Agency mapping (brute force name match)
            let agency_id = globalConfig.agency_id;
            if (agencyStr) {
              const matched = agencies.find(a => a.name.toLowerCase() === agencyStr.toLowerCase());
              if (matched) agency_id = matched.id;
            }

            return validateRow({
              id: Math.random().toString(),
              name: r[nameIdx]?.toString() || "",
              email: r[emailIdx]?.toString() || "",
              role,
              agency_id,
              valid: false
            });
          });

        setRows(importedRows);
        toast.success(t("invite.batch.imported", { count: importedRows.length }));
      } catch (err) {
        toast.error(t("invite.batch.importError"));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const rows = [
      { Nome: "João Silva", Email: "joao@empresa.com", Papel: "Editor", Agência: "" },
      { Nome: "Maria Santos", Email: "maria@empresa.com", Papel: "Gerente", Agência: "" }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Convites");
    XLSX.writeFile(wb, "modelo_convites.xlsx");
  };

  const handleReview = () => {
    setRows(rows.map(validateRow));
    setStep('preview');
  };

  const handleConfirm = async () => {
    setLoading(true);
    const validRows = rows.filter(r => r.valid);
    const created: any[] = [];

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(globalConfig.validity));

      for (const row of validRows) {
        const { data, error } = await supabase
          .from("invites")
          .insert({
            email: row.email,
            name: row.name,
            role: row.role,
            agency_id: row.agency_id === "none" ? null : row.agency_id,
            invited_by: user?.id,
            invited_by_name: displayName,
            expires_at: expiresAt.toISOString(),
            permissions: campaignAccess
          })
          .select()
          .single();
        
        if (error) throw error;
        created.push(data);
      }

      setCreatedInvites(created);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast.success(t("invite.batch.done", { count: created.length }));
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const openEmails = async () => {
    for (const invite of createdInvites) {
      const joinUrl = `${window.location.origin}/join/${invite.token}`;
      const subject = encodeURIComponent(`Você foi convidado para o ProduzAI`);
      const body = encodeURIComponent(
        `Olá, ${invite.name}!\n\nVocê foi convidado por ${displayName} para acessar o ProduzAI.\n\nLink: ${joinUrl}`
      );
      window.open(`mailto:${invite.email}?subject=${subject}&body=${body}`);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const downloadResults = () => {
    const csvRows = createdInvites.map(inv => ({
      Nome: inv.name,
      Email: inv.email,
      "Link do Convite": `${window.location.origin}/join/${inv.token}`,
      "Válido até": format(new Date(inv.expires_at), 'dd/MM/yyyy')
    }));
    downloadCsv("convites_gerados.csv", csvRows);
  };

  const resetAll = () => {
    setStep('edit');
    setRows([
      { id: Math.random().toString(), name: "", email: "", role: "viewer", agency_id: "none", valid: false },
      { id: Math.random().toString(), name: "", email: "", role: "viewer", agency_id: "none", valid: false },
      { id: Math.random().toString(), name: "", email: "", role: "viewer", agency_id: "none", valid: false },
    ]);
    setCreatedInvites([]);
    setCampaignAccess([]);
  };

  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.filter(r => !r.valid && (r.name || r.email)).length;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) resetAll();
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <Button className="bg-[#C2714F] hover:bg-[#b06040] text-white">
          {t("invite.batch.batchButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b">
          <DialogTitle className="text-2xl">{t("invite.batch.title")}</DialogTitle>
          <p className="text-stone-500">{t("invite.batch.subtitle")}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'edit' && (
            <div className="space-y-6">
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-stone-400">Papel padrão</Label>
                  <Select value={globalConfig.role} onValueChange={(v) => handleGlobalChange('role', v)}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{t(r.labelKey).split(' — ')[0]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-stone-400">Agência padrão</Label>
                  <Select value={globalConfig.agency_id} onValueChange={(v) => handleGlobalChange('agency_id', v)}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("invite.form.selectAgency")}</SelectItem>
                      {agencies.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-stone-400">Validade</Label>
                  <Select value={globalConfig.validity} onValueChange={(v) => handleGlobalChange('validity', v)}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALIDITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="md:col-span-3 text-[11px] text-stone-400 italic">
                  {t("invite.batch.globalHint")}
                </p>

                <div className="md:col-span-3 pt-4 border-t space-y-4">
                  <div className="flex items-center gap-2">
                    <Megaphone size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">{t("invite.campaignAccess.title")}</h4>
                    <Badge variant="outline" className="bg-stone-100 text-stone-500 text-[10px] rounded-full border-none">
                      {t("invite.campaignAccess.badge")}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-stone-400 italic">
                    {t("invite.batch.campaignAccessHint")}
                  </p>

                  {campaignAccess.length > 0 && (
                    <div className="space-y-3">
                      {campaignAccess.map((access, index) => (
                        <div key={index} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-white">
                          <div className="flex items-center gap-2">
                            <Select 
                              value={access.campaign_id} 
                              onValueChange={(val) => {
                                const newAccess = [...campaignAccess];
                                newAccess[index].campaign_id = val;
                                setCampaignAccess(newAccess);
                              }}
                            >
                              <SelectTrigger className="h-9 text-xs flex-1">
                                <SelectValue placeholder={t("invite.campaignAccess.selectCampaign")} />
                              </SelectTrigger>
                              <SelectContent>
                                {allCampaigns.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.clients?.agencies?.name} / {c.clients?.name} / {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => setCampaignAccess(campaignAccess.filter((_, i) => i !== index))}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Select 
                              value={access.category_id || ""} 
                              onValueChange={(val) => {
                                const newAccess = [...campaignAccess];
                                newAccess[index].category_id = val;
                                setCampaignAccess(newAccess);
                              }}
                            >
                              <SelectTrigger className="h-8 text-[11px] flex-1">
                                <SelectValue placeholder="Papel / Categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="flex items-center gap-2 ml-auto">
                              <span className="text-[10px] font-medium text-stone-500">
                                {access.suspended ? t("invite.campaignAccess.inactive") : t("invite.campaignAccess.active")}
                              </span>
                              <Switch 
                                checked={!access.suspended} 
                                onCheckedChange={(checked) => {
                                  const newAccess = [...campaignAccess];
                                  newAccess[index].suspended = !checked;
                                  setCampaignAccess(newAccess);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-primary h-8 gap-1.5"
                    onClick={() => setCampaignAccess([...campaignAccess, { campaign_id: "", category_id: categories[0]?.id || "", suspended: false }])}
                  >
                    <Plus size={14} /> {t("invite.campaignAccess.addCampaign")}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={addRow} className="text-[#C2714F] hover:text-[#b06040] hover:bg-[#C2714F]/5">
                    <Plus size={16} className="mr-1.5" /> {t("invite.batch.addRow")}
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={downloadTemplate} className="text-xs text-stone-400 hover:text-stone-600 underline">
                    {t("invite.batch.downloadTemplate")}
                  </button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                    <FileSpreadsheet size={16} /> {t("invite.batch.importSheet")}
                  </Button>
                  <input type="file" ref={fileInputRef} hidden accept=".xlsx,.xls,.csv" onChange={handleImport} />
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-400 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 w-32">Papel</th>
                      <th className="px-4 py-3 w-40">Agência</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rows.map((row) => (
                      <tr key={row.id} className={cn(
                        "group transition-colors",
                        row.valid ? "border-l-4 border-l-emerald-400" : (row.name || row.email ? "border-l-4 border-l-red-400" : "border-l-4 border-l-transparent")
                      )}>
                        <td className="p-2">
                          <Input 
                            value={row.name} 
                            placeholder="Nome completo"
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            className={cn("h-9 bg-transparent border-none focus-visible:ring-1", !row.name && (row.email) && "ring-1 ring-red-400")}
                          />
                        </td>
                        <td className="p-2">
                          <Input 
                            value={row.email} 
                            placeholder="email@empresa.com"
                            onChange={(e) => updateRow(row.id, { email: e.target.value })}
                            className={cn(
                              "h-9 bg-transparent border-none focus-visible:ring-1", 
                              ((row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) || row.existing) && "ring-1 ring-red-400"
                            )}
                            title={row.error}
                          />
                        </td>
                        <td className="p-2">
                          <Select value={row.role} onValueChange={(v) => updateRow(row.id, { role: v })}>
                            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-stone-50 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.shortLabel}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select value={row.agency_id} onValueChange={(v) => updateRow(row.id, { agency_id: v })}>
                            <SelectTrigger className="h-8 border-none bg-transparent hover:bg-stone-50 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {agencies.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="h-8 w-8 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 size={16} /> {t("invite.batch.valid", { count: validCount })}
                </div>
                {errorCount > 0 && (
                  <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <AlertCircle size={16} /> {t("invite.batch.withErrors", { count: errorCount })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {rows.filter(r => r.name || r.email).map((row) => (
                  <div key={row.id} className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border",
                    row.valid ? "bg-white border-stone-200" : "bg-red-50 border-red-100"
                  )}>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={row.valid ? "bg-stone-100 text-stone-600" : "bg-red-100 text-red-400"}>
                        {row.name ? row.name.substring(0, 2).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-stone-900 truncate">{row.name || "(Sem nome)"}</div>
                      <div className="text-stone-500 text-xs truncate">{row.email || "(Sem email)"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {row.valid ? (
                        <>
                          <Badge variant="outline" className="text-[10px] uppercase">{row.role}</Badge>
                          <Badge variant="secondary" className="text-[10px] bg-stone-100">{agencies.find(a => a.id === row.agency_id)?.name || "Sem agência"}</Badge>
                        </>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">{row.error || "Campos incompletos"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2 mb-8">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-stone-900">{t("invite.batch.done", { count: createdInvites.length })}</h3>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                {createdInvites.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between group">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-stone-900">{inv.name}</div>
                      <div className="text-stone-500 text-xs">{inv.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-mono text-stone-300 bg-stone-50 px-2 py-1 rounded truncate max-w-[150px]">
                        .../join/{inv.token.substring(0, 8)}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/join/${inv.token}`);
                        toast.success(t("invite.linkCopied"));
                      }} className="h-8 w-8 text-stone-400 hover:text-stone-900">
                        <Copy size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={openEmails} className="gap-2 border-stone-200">
                  <Mail size={18} /> {t("invite.batch.openEmails")}
                </Button>
                <Button variant="outline" onClick={downloadResults} className="gap-2 border-stone-200">
                  <Download size={18} /> {t("invite.batch.downloadLinks")}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-stone-50/50">
          {step === 'edit' && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleReview} disabled={rows.filter(r => r.name && r.email).length === 0} className="bg-[#C2714F] hover:bg-[#b06040] text-white">
                {t("invite.batch.reviewAndSend")}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('edit')} className="gap-1.5">
                <ChevronLeft size={16} /> {t("invite.batch.backToEdit")}
              </Button>
              <Button onClick={handleConfirm} disabled={loading || validCount === 0} className="bg-[#C2714F] hover:bg-[#b06040] text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
                {t("invite.batch.confirm")}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => setOpen(false)} className="w-full bg-[#C2714F] hover:bg-[#b06040] text-white">
              {t("common.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}