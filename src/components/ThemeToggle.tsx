import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      size="icon"
      variant="outline"
      className={className ?? "h-8 w-8 sm:h-9 sm:w-9 bg-white text-[#1e3a5f] border-white/80 shadow-lg shadow-black/20 hover:bg-white/90 hover:text-[#1e3a5f]"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="w-3.5 h-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute w-3.5 h-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
