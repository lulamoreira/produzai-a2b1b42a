import { type ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

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
  const location = useLocation();

  const isRootPage = location.pathname === "/" || location.pathname === "/admin" || location.pathname === "/chat" || location.pathname === "/my-campaigns" || location.pathname === "/approvals";

  const backHref = breadcrumbs
    ?.slice(0, -1)
    .reverse()
    .find((c) => c.href)?.href;

  const params = new URLSearchParams(location.search);
  const sectionBaseHref = (params.has("section") || params.has("tab")) ? location.pathname : null;
  const currentUrl = `${location.pathname}${location.search}`;
  const from = (location.state as { from?: string } | null)?.from;

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (location.key !== "default") {
      navigate(-1);
      return;
    }

    if (from && from !== currentUrl) {
      navigate(from, { replace: true });
      return;
    }

    if (sectionBaseHref && sectionBaseHref !== currentUrl) {
      navigate(sectionBaseHref, { replace: true });
      return;
    }

    if (backHref && backHref !== currentUrl) {
      navigate(backHref);
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar />

      {/* Fixed floating back button for mobile */}
      {!isRootPage && (
        <button
          type="button"
          onClick={handleBack}
          className="lg:hidden fixed bottom-6 left-4 z-[100] pointer-events-auto w-12 h-12 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl active:scale-95 transition-transform mobile-back-btn"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      <div className="min-h-dvh lg:pl-[220px] transition-all duration-300">
        {(breadcrumbs || title || headerRight) && (
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 py-2">
            <div className="flex items-center justify-between gap-3">
              {!isRootPage && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors flex-shrink-0"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
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

        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
