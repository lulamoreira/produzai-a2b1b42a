import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { duplicateInstallationTeam } from "@/lib/duplicateInstallationTeam";

export interface DuplicateTeamDialogProps {
  team: { id: string; name: string };
  campaignId: string;
  onClose: () => void;
}

export default function DuplicateTeamDialog({ team, campaignId, onClose }: DuplicateTeamDialogProps) {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const duplicate = useMutation({
    mutationFn: () => duplicateInstallationTeam(team.id, campaignId, name),
    onSuccess: async () => {
      await Promise.all(["installation_teams", "all_team_members", "all_team_vehicles"].map((key) => queryClient.invalidateQueries({ queryKey: [key, campaignId] })));
      toast.success("Equipe duplicada com sucesso!");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível duplicar a equipe."),
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !duplicate.isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md" onKeyDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Duplicar equipe</DialogTitle>
          <DialogDescription>Copiar {team.name}, com todos os instaladores, documentos, veículos e configuração de apoio. A original permanece intacta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); if (name.trim() && !duplicate.isPending) duplicate.mutate(); }}>
          <Label htmlFor="duplicate-team-name">Novo nome da equipe</Label>
          <Input id="duplicate-team-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} disabled={duplicate.isPending} className="mt-2" />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={duplicate.isPending}>Cancelar</Button>
            <Button type="submit" disabled={!name.trim() || duplicate.isPending}>{duplicate.isPending ? "Duplicando..." : "Duplicar equipe"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}