import { useState, type ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/NotificationBell";
import CampaignChatPanel from "@/components/CampaignChatPanel";
import { ChevronLeft, ChevronRight, MessageSquare, History } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useCampaignUnreadCount } from "@/hooks/useCampaignChat";
import { Button } from "@/components/ui/button";

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
  const { collapsed } = useSidebarState();
  const params = useParams<{ campaignId?: string }>();
  const campaignId = params.campaignId;

  const [chatOpen, setChatOpen] = useState(false);
  const { data: unreadCount = 0 } = useCampaignUnreadCount(campaignId);

  // Derive campaign name from last breadcrumb if available
  const campaignName = breadcrumbs && breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1]?.label
    : undefined;

  const isRootPage = location.pathname === "/" || location.pathname === "/admin" || location.pathname === "/my-campaigns" || location.pathname === "/approvals";

  const searchParams = new URLSearchParams(location.search);
  const backHref = breadcrumbs
    ?.slice(0, -1)
    .reverse()
    .find((c) => c.href)?.href;

  const sectionBaseHref = (searchParams.has("section") || searchParams.has("tab")) ? location.pathname : null;
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

      {/* Fixed notification bell + chat + history for mobile */}
      <div className="lg:hidden fixed top-3 right-3 z-40 flex items-center gap-1.5">
        {campaignId && (
          <Button
            size="icon"
            variant="outline"
            className="relative h-8 w-8 bg-card text-foreground border-border shadow-lg hover:bg-accent"
            onClick={() => navigate(`${location.pathname.split("?")[0]}?section=history`)}
          >
            <History className="w-3.5 h-3.5" />
          </Button>
        )}
        {campaignId && (
          <Button
            size="icon"
            variant="outline"
            className="relative h-8 w-8 bg-card text-foreground border-border shadow-lg hover:bg-accent"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-destructive rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}
        <NotificationBell />
      </div>

      <div className={`min-h-dvh transition-all duration-300 ${collapsed ? "lg:pl-[60px]" : "lg:pl-[220px]"}`}>
        {/* Always-visible desktop header bar */}
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {campaignId && (
                <div className="hidden lg:block">
                  <Button
                    size="icon"
                    variant="outline"
                    className="relative h-8 w-8 bg-card text-foreground border-border shadow-lg hover:bg-accent"
                    onClick={() => navigate(`${location.pathname.split("?")[0]}?section=history`)}
                  >
                    <History className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
              {campaignId && (
                <div className="hidden lg:block">
                  <Button
                    size="icon"
                    variant="outline"
                    className="relative h-8 w-8 bg-card text-foreground border-border shadow-lg hover:bg-accent"
                    onClick={() => setChatOpen(true)}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-destructive rounded-full">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </div>
              )}
              <div className="hidden lg:block">
                <NotificationBell />
              </div>
              {headerRight}
            </div>
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

        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Campaign Chat Panel */}
      {campaignId && (
        <CampaignChatPanel
          open={chatOpen}
          onOpenChange={setChatOpen}
          campaignId={campaignId}
          campaignName={campaignName}
        />
      )}
    </div>
  );
}
