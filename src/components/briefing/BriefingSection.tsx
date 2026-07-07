import { ReactNode } from "react";
import DebouncedTextarea from "@/components/DebouncedTextarea";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  body: string;
  placeholder?: string;
  onBodyChange: (v: string) => void;
  children?: ReactNode;
  color?: string;
}

const BriefingSection = ({ icon: Icon, title, description, body, placeholder, onBodyChange, children, color = "#8C6F4E" }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <header className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </header>

      <DebouncedTextarea
        value={body ?? ""}
        onValueCommit={onBodyChange}
        placeholder={placeholder ?? "Escreva aqui..."}
        className="min-h-[120px] resize-y"
      />

      {children}
    </section>
  );
};

export default BriefingSection;
