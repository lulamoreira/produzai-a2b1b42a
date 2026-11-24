import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { GroupDef } from "@/lib/storeClusterCost";

export interface PresetRow { id: string; name: string; field_key: string; groups: GroupDef[] }

export interface StoreClusterPresetBarProps {
  clientId: string;
  fieldKey: string;
  groups: GroupDef[];
  onLoad: (p: PresetRow) => void;
}

/** Modelos de grupos por cliente — única escrita da ferramenta. */
export function StoreClusterPresetBar({ clientId, fieldKey, groups, onLoad }: StoreClusterPresetBarProps) {
  const qc = useQueryClient();
  const key = ["store-cluster-presets", clientId];
  const [currentId, setCurrentId] = useState<string>("__none__");
  const [newName, setNewName] = useState("");
  const [askName, setAskName] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { data: presets = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("store_cluster_presets").select("id, name, field_key, groups").eq("client_id", clientId).order("name");
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, groups: (d.groups as unknown as GroupDef[]) ?? [] })) as PresetRow[];
    },
  });
  const clean = groups.map((g) => ({ name: g.name.trim() || "Grupo", values: g.values }));
  const save = async () => {
    if (currentId === "__none__") return setAskName(true);
    const { error } = await supabase.from("store_cluster_presets").update({ field_key: fieldKey, groups: clean as never, updated_at: new Date().toISOString() }).eq("id", currentId);
    if (error) return toast.error("Não foi possível salvar o modelo.");
    toast.success("Modelo salvo.");
    qc.invalidateQueries({ queryKey: key });
  };
  const saveAs = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Informe o nome do modelo.");
    const { data, error } = await supabase.from("store_cluster_presets").insert({ client_id: clientId, name, field_key: fieldKey, groups: clean as never }).select("id").single();
    if (error) return toast.error("Não foi possível salvar o modelo.");
    setCurrentId(data.id);
    setAskName(false);
    setNewName("");
    toast.success("Modelo salvo.");
    qc.invalidateQueries({ queryKey: key });
  };
  const remove = async () => {
    const { error } = await supabase.from("store_cluster_presets").delete().eq("id", currentId);
    setConfirmDel(false);
    if (error) return toast.error("Não foi possível excluir o modelo.");
    setCurrentId("__none__");
    toast.success("Modelo excluído.");
    qc.invalidateQueries({ queryKey: key });
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <Select
          value={currentId}
          onValueChange={(v) => {
            setCurrentId(v);
            const p = presets.find((x) => x.id === v);
            if (p) onLoad(p);
          }}
        >
          <SelectTrigger className="sm:w-60" aria-label="Modelo salvo"><SelectValue placeholder="Modelo salvo" /></SelectTrigger>
          <SelectContent onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
            <SelectItem value="__none__">Sem modelo</SelectItem>
            {presets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={save}>Salvar</Button>
          <Button size="sm" variant="outline" onClick={() => setAskName(true)}>Salvar como</Button>
          <Button size="sm" variant="outline" disabled={currentId === "__none__"} onClick={() => setConfirmDel(true)}>Excluir modelo</Button>
        </div>
      </div>
      {askName && (
        <div className="flex gap-2">
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do modelo" aria-label="Nome do modelo" />
          <Button size="sm" onClick={saveAs}>OK</Button>
          <Button size="sm" variant="ghost" onClick={() => setAskName(false)}>Cancelar</Button>
        </div>
      )}
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>O modelo "{presets.find((p) => p.id === currentId)?.name}" será excluído para todos deste cliente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
