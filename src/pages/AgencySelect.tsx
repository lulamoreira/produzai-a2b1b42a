import { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useAgencies, useAddAgency, useUpdateAgency, useDeleteAgency, useRestoreAgency, usePermanentDeleteAgency,
  validateAndUploadLogo, MAX_LOGO_SIZE_KB, MAX_LOGO_DIMENSION, MIN_LOGO_DIMENSION,
} from "@/hooks/useAgencies";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
import { useUserDirectAccess } from "@/hooks/useUserDirectAccess";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Plus, ArrowRight, Trash2, LogOut, Shield, Sparkles, MessageSquare, Upload, Palette, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#1e293b", "#64748b",
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const AgencySelect = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { isLimited, campaigns: limitedCampaigns, isLoading: loadingDirectAccess } = useUserDirectAccess();
  const { data: allAgencies = [], isLoading } = useAgencies();

  // Fetch user's display_name from profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "";
  const { data: agencyAccess = [], isLoading: loadingAccess } = useUserAgencyAccess();
  const addAgency = useAddAgency();
  const updateAgency = useUpdateAgency();
  const deleteAgency = useDeleteAgency();

  // Fetch client-level access to derive agency visibility
  const { data: clientAccess = [], isLoading: loadingClientAccess } = useQuery({
    queryKey: ["user_client_access_agencies", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_client_access")
        .select("client_id, suspended, clients(agency_id)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as { client_id: string; suspended: boolean; clients: { agency_id: string } | null }[];
    },
    enabled: !!user && !isAdmin,
  });

  // Non-admin users see agencies if they have direct agency access OR access to any client in that agency
  const agencies = isAdmin
    ? allAgencies
    : allAgencies.filter((ag) => {
        const hasAgencyAccess = agencyAccess.some((a) => a.agency_id === ag.id && !a.suspended);
        const hasClientInAgency = clientAccess.some(
          (ca) => ca.clients?.agency_id === ag.id && !ca.suspended
        );
        return hasAgencyAccess || hasClientInAgency;
      });

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editAgency, setEditAgency] = useState<{ id: string; name: string; color: string; logo_url: string | null } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (file: File | undefined, isEdit = false) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (isEdit) {
      setEditLogoFile(file);
      setEditLogoPreview(url);
    } else {
      setLogoFile(file);
      setLogoPreview(url);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setUploading(true);
    try {
      const created = await addAgency.mutateAsync({ name: newName.trim(), color: newColor });
      if (logoFile && created?.id) {
        const logoUrl = await validateAndUploadLogo(logoFile, created.id);
        await updateAgency.mutateAsync({ id: created.id, logo_url: logoUrl });
      }
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
      setLogoFile(null);
      setLogoPreview(null);
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgency) return;
    setUploading(true);
    try {
      const updates: any = { id: editAgency.id, name: editAgency.name, color: editAgency.color };
      if (editLogoFile) {
        const logoUrl = await validateAndUploadLogo(editLogoFile, editAgency.id);
        updates.logo_url = logoUrl;
      }
      await updateAgency.mutateAsync(updates);
      setEditAgency(null);
      setEditLogoFile(null);
      setEditLogoPreview(null);
      setEditDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (agency: typeof agencies[0]) => {
    setEditAgency({ id: agency.id, name: agency.name, color: agency.color || PRESET_COLORS[0], logo_url: agency.logo_url });
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setEditDialogOpen(true);
  };

  if (isLoading || loadingAccess || loadingClientAccess || loadingDirectAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Limited users (campaign-level access only) → redirect
  if (isLimited) {
    if (limitedCampaigns.length === 1 && limitedCampaigns[0].modules.length > 0) {
      const c = limitedCampaigns[0];
      return (
        <Navigate
          to={`/agency/${c.agencyId}/clients/${c.clientId}/campaigns/${c.campaignId}`}
          state={{ initialSection: c.modules[0], limitedMode: true }}
          replace
        />
      );
    }
    return <Navigate to="/my-campaigns" replace />;
  }

  const LogoUploadArea = ({ preview, logoUrl, onFileSelect, fileInputRef }: {
    preview: string | null; logoUrl?: string | null; onFileSelect: (f: File | undefined) => void; fileInputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        Logo (quadrada, {MIN_LOGO_DIMENSION}–{MAX_LOGO_DIMENSION}px, máx {MAX_LOGO_SIZE_KB}KB)
      </label>
      <div
        className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        {(preview || logoUrl) ? (
          <img src={preview || logoUrl!} alt="Logo" className="w-20 h-20 rounded-lg object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <span className="text-xs text-muted-foreground">Clique para selecionar</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onFileSelect(e.target.files?.[0])}
        />
      </div>
    </div>
  );

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Cor da agência</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`w-8 h-8 rounded-full border-2 transition-all ${value === c ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <label className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );

  return (
    <AppLayout title="Agências">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">Agências</h2>
          <p className="text-muted-foreground text-sm">Selecione uma agência para gerenciar seus clientes e campanhas.</p>
        </div>

        <div className="flex justify-center mb-8">
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
                  <Plus className="w-4 h-4" /> Nova Agência
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Agência</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da agência</label>
                    <Input placeholder="Ex: Agência XPTO" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <ColorPicker value={newColor} onChange={setNewColor} />
                  <LogoUploadArea
                    preview={logoPreview}
                    onFileSelect={(f) => handleLogoSelect(f, false)}
                    fileInputRef={fileRef as React.RefObject<HTMLInputElement>}
                  />
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={addAgency.isPending || uploading}>
                    {uploading ? "Enviando..." : addAgency.isPending ? "Criando..." : "Criar Agência"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Edit dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar Agência</DialogTitle></DialogHeader>
            {editAgency && (
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da agência</label>
                  <Input value={editAgency.name} onChange={(e) => setEditAgency({ ...editAgency, name: e.target.value })} required />
                </div>
                <ColorPicker value={editAgency.color} onChange={(c) => setEditAgency({ ...editAgency, color: c })} />
                <LogoUploadArea
                  preview={editLogoPreview}
                  logoUrl={editAgency.logo_url}
                  onFileSelect={(f) => handleLogoSelect(f, true)}
                  fileInputRef={editFileRef as React.RefObject<HTMLInputElement>}
                />
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={uploading}>
                  {uploading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {agencies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma agência cadastrada</h3>
            <p className="text-muted-foreground text-sm">Crie sua primeira agência para começar.</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {agencies.map((agency) => {
              const agencyColor = agency.color || PRESET_COLORS[0];
              return (
                <div
                  key={agency.id}
                  className="group aqua-card p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border border-border flex flex-col items-center text-center w-[260px]"
                  style={{
                    background: `linear-gradient(135deg, ${agencyColor}15, ${agencyColor}08)`,
                    borderColor: `${agencyColor}30`,
                  }}
                  onClick={() => navigate(`/agency/${agency.id}`)}
                >
                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="flex gap-1 self-end opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1 mb-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); openEdit(agency); }}
                      >
                        <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir agência?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Todos os clientes, campanhas e dados associados a esta agência serão apagados permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAgency.mutate(agency.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              SIM
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                  <div
                    className="w-16 h-16 aqua-icon flex items-center justify-center shadow-lg overflow-hidden mb-3"
                    style={{ background: `linear-gradient(145deg, ${agencyColor}, ${agencyColor}cc)` }}
                  >
                    {agency.logo_url ? (
                      <img src={agency.logo_url} alt={agency.name} className="w-full h-full object-cover relative z-10" />
                    ) : (
                      <Building2 className="w-7 h-7 text-white relative z-10 drop-shadow-sm" />
                    )}
                  </div>
                  <h3 className="font-bold text-foreground text-base mb-0.5">{agency.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Criado em {new Date(agency.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3 group-hover:text-primary transition-colors">
                    <span>Acessar</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AgencySelect;
