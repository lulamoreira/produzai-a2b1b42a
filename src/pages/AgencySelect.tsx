import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  useAgencies, useAddAgency, useUpdateAgency, useDeleteAgency,
  validateAndUploadLogo, MAX_LOGO_SIZE_KB, MAX_LOGO_DIMENSION, MIN_LOGO_DIMENSION,
} from "@/hooks/useAgencies";
import { useUserAgencyAccess } from "@/hooks/useUserAgencyAccess";
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

const AgencySelect = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: allAgencies = [], isLoading } = useAgencies();
  const { data: agencyAccess = [], isLoading: loadingAccess } = useUserAgencyAccess();
  const addAgency = useAddAgency();
  const updateAgency = useUpdateAgency();
  const deleteAgency = useDeleteAgency();

  // Non-admin users only see agencies they have access to (not suspended)
  const agencies = isAdmin
    ? allAgencies
    : allAgencies.filter((ag) =>
        agencyAccess.some((a) => a.agency_id === ag.id && !a.suspended)
      );

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

  if (isLoading || loadingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Gestão de Campanhas</h1>
              <p className="text-xs text-muted-foreground">Selecione uma agência</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => navigate("/chat")}>
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </Button>
            {isAdmin && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => navigate("/admin")}>
                <Shield className="w-3.5 h-3.5" /> Admin
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1.5 rounded-full px-3">
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{user?.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="hidden sm:inline text-xs max-w-[100px] truncate">{user?.email?.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user?.email}</DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">Agências</h2>
          <p className="text-muted-foreground text-sm">Selecione uma agência para gerenciar seus clientes e campanhas.</p>
        </div>

        <div className="flex justify-center mb-8">
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary shadow-glow-primary text-white border-0 gap-1">
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
                  <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={addAgency.isPending || uploading}>
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
                <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={uploading}>
                  {uploading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {agencies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow-primary">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma agência cadastrada</h3>
            <p className="text-muted-foreground text-sm">Crie sua primeira agência para começar.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.map((agency) => {
              const agencyColor = agency.color || PRESET_COLORS[0];
              return (
                <div
                  key={agency.id}
                  className="group border rounded-xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${agencyColor}15, ${agencyColor}08)`,
                    borderColor: `${agencyColor}30`,
                  }}
                  onClick={() => navigate(`/agency/${agency.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden"
                        style={{ backgroundColor: agencyColor }}
                      >
                        {agency.logo_url ? (
                          <img src={agency.logo_url} alt={agency.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base group-hover:transition-colors" style={{ color: undefined }}>
                          {agency.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Criado em {new Date(agency.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); openEdit(agency); }}
                        >
                          <Palette className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="w-4 h-4 text-destructive" />
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
                  </div>
                  <div className="flex items-center justify-end mt-4">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground transition-colors" style={{ color: undefined }}>
                      <span>Acessar</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AgencySelect;
