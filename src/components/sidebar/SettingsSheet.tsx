import { Sun, Moon, Monitor, Check, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useLanguage } from "@/hooks/useLanguage";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: Props) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { currentLanguage, changeLanguage } = useLanguage();

  const themeOptions = [
    { value: "light",  label: t("settings.theme_light",  "Claro"),   icon: Sun,      special: false },
    { value: "dark",   label: t("settings.theme_dark",   "Escuro"),  icon: Moon,     special: false },
    { value: "system", label: t("settings.theme_system", "Sistema"), icon: Monitor,  special: false },
    { value: "aqua",   label: t("settings.theme_aqua",   "Aqua"),    icon: Sparkles, special: true  },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "h-auto max-h-[85vh] rounded-t-2xl" : "w-[380px] sm:max-w-[380px]"}
      >
        <SheetHeader>
          <SheetTitle>{t("settings.title", "Configurações")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("settings.description", "Tema e idioma")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* Theme */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("settings.theme", "Tema")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`relative min-h-[72px] rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition-all overflow-hidden ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground/40"
                    } ${
                      opt.special && !active
                        ? "bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 dark:from-sky-950/40 dark:via-background dark:to-fuchsia-950/40"
                        : ""
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${opt.special ? "text-sky-500" : ""}`} />
                    <span className="text-xs font-medium">{opt.label}</span>
                    {active && (
                      <Check className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Language */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("settings.language", "Idioma")}
            </h3>
            <div className="space-y-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code as SupportedLanguage)}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3 rounded-lg transition-colors text-sm ${
                      active ? "bg-primary/10 text-foreground font-medium" : "hover:bg-muted"
                    }`}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="flex-1 text-left">{lang.label}</span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
