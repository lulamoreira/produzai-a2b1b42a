import { Link } from "react-router-dom";

interface Props {
  collapsed: boolean;
  agencyName?: string | null;
  clientName?: string | null;
  campaignName?: string | null;
  agencyId?: string;
  clientId?: string;
  campaignId?: string;
}

export function SidebarBreadcrumb({ 
  collapsed, 
  agencyName, 
  clientName, 
  campaignName,
  agencyId,
  clientId,
  campaignId
}: Props) {
  if (collapsed) return null;
  
  const parts = [
    { name: agencyName, path: agencyId ? `/agency/${agencyId}` : null },
    { name: clientName, path: (agencyId && clientId) ? `/agency/${agencyId}/clients/${clientId}` : null },
    { name: campaignName, path: (agencyId && clientId && campaignId) ? `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}` : null }
  ].filter(p => !!p.name);

  if (parts.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-border/30 mb-1">
      <div
        className="text-[11px] leading-snug flex flex-wrap items-start gap-x-1 gap-y-0.5"
        style={{
          color: "var(--sidebar-text-active, #F5EFE6)",
          wordBreak: "normal",
          overflowWrap: "normal",
          hyphens: "none",
        }}
        title={parts.map(p => p.name).join(" › ")}
      >
        {parts.map((p, i) => (
          <span key={i} className="inline-flex min-w-0 max-w-full items-baseline gap-1">
            {i > 0 && <span className="opacity-40 flex-shrink-0">›</span>}
            {p.path ? (
              <Link 
                to={p.path} 
                className="font-medium whitespace-normal break-normal hover:text-brand-400 transition-colors"
              >
                {p.name}
              </Link>
            ) : (
              <span className="font-medium whitespace-normal break-normal">{p.name}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
