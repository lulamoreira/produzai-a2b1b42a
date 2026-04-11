import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { THEME_PRESETS, applyUserTheme } from "@/lib/applyUserTheme";
import { cn } from "@/lib/utils";

export default function AppearanceTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [hoveredHue, setHoveredHue] = useState<number | null>(null);

  const { data: currentHue = 231 } = useQuery({
    queryKey: ["profile_theme_hue", user?.id],
    queryFn: async () => {
      if (!user) return 231;
      const { data } = await supabase
        .from("profiles")
        .select("theme_hue")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any)?.theme_hue ?? 231;
    },
    enabled: !!user,
  });

  const [selectedHue, setSelectedHue] = useState<number | null>(null);
  const activeHue = selectedHue ?? currentHue;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ theme_hue: activeHue } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar aparência.");
      return;
    }
    applyUserTheme(activeHue);
    queryClient.invalidateQueries({ queryKey: ["profile_theme_hue"] });
    toast.success("Aparência atualizada!");
  };

  const previewHue = hoveredHue ?? activeHue;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Cor do seu aplicativo</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escolha uma cor. Tudo se adapta automaticamente.
        </p>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mb-6">
          {THEME_PRESETS.map((preset) => {
            const isActive = activeHue === preset.hue;
            return (
              <button
                key={preset.hue}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all",
                  isActive && "bg-muted ring-2 ring-offset-2 ring-offset-background",
                )}
                style={isActive ? { ringColor: `hsl(${preset.hue}, 72%, 52%)` } : undefined}
                onClick={() => setSelectedHue(preset.hue)}
                onMouseEnter={() => setHoveredHue(preset.hue)}
                onMouseLeave={() => setHoveredHue(null)}
                type="button"
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all",
                    isActive ? "border-white shadow-lg scale-110" : "border-transparent"
                  )}
                  style={{
                    backgroundColor: `hsl(${preset.hue}, 72%, 52%)`,
                    boxShadow: isActive ? `0 0 0 3px hsl(${preset.hue}, 72%, 52%, 0.3)` : undefined,
                  }}
                >
                  {isActive && <Check className="w-5 h-5 text-white" />}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground mb-3">Preview ao vivo</p>
        <div className="flex gap-3 items-stretch h-28">
          {/* Mini sidebar */}
          <div
            className="w-32 rounded-lg p-2 flex flex-col gap-1"
            style={{ backgroundColor: `hsl(${previewHue}, 25%, 11%)` }}
          >
            {["Dashboard", "Clientes", "Chat"].map((item, i) => (
              <div
                key={item}
                className="px-2 py-1.5 rounded text-[10px] font-medium truncate"
                style={{
                  backgroundColor: i === 0 ? `hsl(${previewHue}, 30%, 18%)` : "transparent",
                  color: i === 0 ? `hsl(${previewHue}, 10%, 94%)` : `hsl(${previewHue}, 15%, 68%)`,
                }}
              >
                {item}
              </div>
            ))}
          </div>

          {/* Content preview */}
          <div className="flex-1 flex flex-col justify-center gap-2">
            <button
              className="self-start px-4 py-2 rounded-md text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: `hsl(${previewHue}, 72%, 52%)` }}
              type="button"
            >
              Botão Primário
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `hsl(${previewHue}, 72%, 52%)` }}
              />
              <span className="text-xs text-muted-foreground">Link ativo</span>
            </div>
            <div
              className="h-1 w-24 rounded-full"
              style={{ backgroundColor: `hsl(${previewHue}, 72%, 52%)` }}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving || activeHue === currentHue}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Salvar aparência
        </Button>
      </div>
    </div>
  );
}
