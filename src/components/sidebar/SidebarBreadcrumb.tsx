interface Props {
  collapsed: boolean;
  agencyName?: string | null;
  clientName?: string | null;
  campaignName?: string | null;
}

export function SidebarBreadcrumb({ collapsed, agencyName, clientName, campaignName }: Props) {
  if (collapsed) return null;
  const parts = [agencyName, clientName, campaignName].filter(Boolean) as string[];
  if (parts.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-border/30 mb-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-1">
        Contexto
      </div>
      <div
        className="text-[11px] leading-snug flex flex-wrap items-start gap-x-1 gap-y-0.5"
        style={{
          color: "var(--sidebar-text-active, #F5EFE6)",
          wordBreak: "normal",
          overflowWrap: "normal",
          hyphens: "none",
        }}
        title={parts.join(" › ")}
      >
        {parts.map((p, i) => (
          <span key={i} className="inline-flex min-w-0 max-w-full items-baseline gap-1">
            {i > 0 && <span className="opacity-40 flex-shrink-0">›</span>}
            <span className="font-medium whitespace-normal break-normal">{p}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
