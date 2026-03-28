import { type ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppLayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
  headerRight?: ReactNode;
}

export default function AppLayout({ children, breadcrumbs, title, headerRight }: AppLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Main content */}
      <div className="lg:pl-[220px] transition-all duration-300">
        {/* Top bar */}
        {(breadcrumbs || title || headerRight) && (
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 py-2">
            <div className="flex items-center justify-between gap-3">
              {/* Spacer for mobile hamburger */}
              <div className="w-9 lg:hidden flex-shrink-0" />
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {breadcrumbs.slice(0, -1).map((crumb, i) => (
                      <span key={i} className="flex items-center gap-1 min-w-0">
                        {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
                        {crumb.href ? (
                          <button
                            onClick={() => navigate(crumb.href!)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[100px] sm:max-w-[160px]"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-[160px]">{crumb.label}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : !breadcrumbs && title ? (
                  <h1 className="text-sm font-bold text-foreground truncate">{title}</h1>
                ) : null}
              </div>
              {headerRight && <div className="flex items-center gap-2 flex-shrink-0">{headerRight}</div>}
            </div>
            {/* Current page title aligned exactly with breadcrumb text start */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="mt-0.5 flex items-start gap-3">
                <div className="w-9 lg:hidden flex-shrink-0" />
                <div className="min-w-0 flex-1 text-sm font-bold text-foreground leading-tight">
                  {breadcrumbs[breadcrumbs.length - 1]?.label}
                </div>
              </div>
            )}
          </header>
        )}

        {/* Page content */}
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
