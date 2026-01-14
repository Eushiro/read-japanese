import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  Link,
  useLocation,
} from "@tanstack/react-router";
import { LibraryPage } from "@/pages/LibraryPage";
import { ReaderPage } from "@/pages/ReaderPage";
import { VocabularyPage } from "@/pages/VocabularyPage";
import { GeneratePage } from "@/pages/GeneratePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { BookOpen, BookmarkCheck, Settings, Sparkles } from "lucide-react";

// Root layout
const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-background paper-texture">
      <Navigation />
      <main className="animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}

function Navigation() {
  const location = useLocation();

  const links = [
    { to: "/", label: "Library", icon: BookOpen },
    { to: "/vocabulary", label: "Vocabulary", icon: BookmarkCheck },
    { to: "/generate", label: "Generate", icon: Sparkles },
    { to: "/settings", label: "Settings", icon: Settings },
  ] as const;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <span className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-japanese)' }}>読</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-semibold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Read Japanese
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    active
                      ? "text-accent"
                      : "text-foreground-muted hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <link.icon className={`w-4 h-4 ${active ? "text-accent" : ""}`} />
                  <span className="hidden sm:inline">{link.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

// Routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LibraryPage,
});

const readerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/read/$storyId",
  component: ReaderPage,
});

const vocabularyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vocabulary",
  component: VocabularyPage,
});

const generateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/generate",
  component: GeneratePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  readerRoute,
  vocabularyRoute,
  generateRoute,
  settingsRoute,
]);

// Router
export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

// Type registration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
