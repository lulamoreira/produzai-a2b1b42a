import React from "react";

interface EmptyStateV2Props {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyStateV2({ icon: Icon, title, description, action }: EmptyStateV2Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-stone-400" />
      </div>
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-300">{title}</h3>
      {description && <p className="text-xs text-stone-400 mt-1 max-w-xs">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-4 text-xs font-medium text-brand-400 hover:text-brand-500 transition-colors">
          {action.label}
        </button>
      )}
    </div>
  );
}