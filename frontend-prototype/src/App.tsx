import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useAppStore } from "./stores/appStore";
import { useTheme } from "./hooks";
import Sidebar from "./components/Sidebar";
import SearchTab from "./components/tabs/SearchTab";
import FavoritesTab from "./components/tabs/FavoritesTab";
import LibraryTab from "./components/tabs/LibraryTab";
import StatsTab from "./components/tabs/StatsTab";
import SettingsTab from "./components/tabs/SettingsTab";
import ToastContainer from "./components/ui/ToastContainer";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { currentTab, setCurrentTab } = useAppStore();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize theme and handle URL hash
  useEffect(() => {
    // Set initial tab from URL hash
    const hash = window.location.hash.slice(1);
    if (
      hash &&
      ["search", "favorites", "library", "stats", "settings"].includes(hash)
    ) {
      setCurrentTab(hash as any);
    }
  }, [setCurrentTab]);

  // Update URL hash when tab changes
  useEffect(() => {
    window.location.hash = currentTab;
  }, [currentTab]);

  const renderCurrentTab = () => {
    switch (currentTab) {
      case "search":
        return <SearchTab />;
      case "favorites":
        return <FavoritesTab />;
      case "library":
        return <LibraryTab />;
      case "stats":
        return <StatsTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return <SearchTab />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          {/* Sidebar */}
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />

          {/* Main Content Area */}
          <main
            className={`
              min-h-screen transition-all duration-300 ease-in-out
              ${sidebarCollapsed ? "ml-16" : "ml-64"}
            `}
          >
            <div className="h-full">
              <div className="animate-fade-in h-full">{renderCurrentTab()}</div>
            </div>
          </main>

          {/* Toast Notifications */}
          <ToastContainer />

          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
        </div>

        {/* React Query DevTools - only in development */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
