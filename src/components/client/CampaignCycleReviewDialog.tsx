import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { parseCycleYear, suggestCycleYear, type CycleAssignment, type CycleFamily } from '@/lib/campaignCycles';

export interface CampaignCycleReviewDialogProps {
  families: CycleFamily[];
  assignments: CycleAssignment[];
  onSave: (assignments: CycleAssignment[]) => Promise<unknown>;
  disabled?: boolean;
}

export function CampaignCycleReviewDialog({ families, assignments, onSave, disabled }: CampaignCycleReviewDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const openReview = () => {
    const saved = new Map(assignments.map(a => [a.campaign_id, a.cycle_year]));
    setDraft(Object.fromEntries(families.map(f => [f.parent.id,
      String((saved.has(f.parent.id) ? saved.get(f.parent.id) : suggestCycleYear(f)) ?? '')])));
    setOpen(true);
  };
  const save = async () => {
    try {
      const saved = new Map(assignments.map(a => [a.campaign_id, a.cycle_year]));
      const values = families.map(f => ({ campaign_id: f.parent.id, cycle_year: parseCycleYear(draft[f.parent.id] ?? '') }))
        .filter(a => a.cycle_year !== (saved.get(a.campaign_id) ?? null));
      setSaving(true);
      await onSave(values);
      toast.success(t('campaignCycles.saved', { defaultValue: 'Pastas atualizadas.' }));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('campaignCycles.error', { defaultValue: 'Não foi possível salvar as pastas.' }));
    } finally { setSaving(false); }
  };
  return <>
    <Button variant="outline" size="sm" onClick={openReview} disabled={disabled}>
      <Folder className="h-4 w-4 mr-2" />{t('campaignCycles.organize', { defaultValue: 'Organizar por ciclo' })}
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t('campaignCycles.review', { defaultValue: 'Revisar ciclos das campanhas' })}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {families.map(f => <div key={f.parent.id} className="flex items-center gap-4 py-3">
            <div className="flex-1 min-w-0">
              <label htmlFor={`cycle-${f.parent.id}`} className="font-medium text-sm break-words">{f.parent.name}</label>
              {f.children.length > 0 && <p className="text-xs text-muted-foreground">{t('campaignCycles.renegotiations', { defaultValue: '{{count}} renegociações', count: f.children.length })}</p>}
            </div>
            <Input id={`cycle-${f.parent.id}`} aria-label={`${t('campaignCycles.cycle', { defaultValue: 'Ciclo' })}: ${f.parent.name}`}
              type="text" inputMode="numeric" maxLength={4} className="w-28 shrink-0 h-9"
              placeholder={t('campaignCycles.noCycle', { defaultValue: 'Sem ciclo' })} disabled={saving}
              value={draft[f.parent.id] ?? ''} onChange={e => setDraft(old => ({ ...old, [f.parent.id]: e.target.value }))} />
          </div>)}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button disabled={saving} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}