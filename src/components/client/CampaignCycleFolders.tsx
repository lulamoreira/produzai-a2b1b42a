import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { groupCycleFamilies, type CycleAssignment, type CycleFamily } from '@/lib/campaignCycles';

export interface CampaignCycleFoldersProps<T extends CycleFamily> {
  families: T[];
  assignments: CycleAssignment[];
  children: (family: T) => ReactNode;
}

export function CampaignCycleFolders<T extends CycleFamily>({ families, assignments, children }: CampaignCycleFoldersProps<T>) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groups = groupCycleFamilies(families, assignments);
  const latest = groups.find(([year]) => year !== null)?.[0];
  return <div className="space-y-5">
    {groups.map(([year, items]) => {
      const key = String(year ?? 'unassigned');
      const open = expanded[key] ?? (year === null || year === latest);
      const title = year === null ? t('campaignCycles.unassigned', { defaultValue: 'Sem ciclo definido' }) : String(year);
      return <section key={key} className="space-y-3">
        <Button variant="ghost" className="w-full justify-start gap-2 border-b border-border rounded-none h-11 px-1"
          aria-expanded={open} aria-controls={`cycle-folder-${key}`} onClick={() => setExpanded(old => ({ ...old, [key]: !open }))}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {open ? <FolderOpen className="h-5 w-5 text-primary" /> : <Folder className="h-5 w-5 text-primary" />}
          <span className="font-semibold">{title}</span><span className="text-muted-foreground text-xs">({items.length})</span>
        </Button>
        {open && <div id={`cycle-folder-${key}`} className="grid gap-3">{items.map(children)}</div>}
      </section>;
    })}
  </div>;
}