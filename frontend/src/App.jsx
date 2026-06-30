import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  ShieldCheck,
  Database,
  LayoutGrid,
  Sparkles,
  AlertCircle,
  Settings,
  Heart,
} from "lucide-react";
import clsx from "clsx";

import ReviewPage from "./features/review/ReviewPage";
import MemoryBrowser from "./features/memory/MemoryBrowser";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import SoulPage from "./features/soul/SoulPage";
import SettingsDrawer from "./features/settings/SettingsDrawer";
import TokenAuth from "./components/TokenAuth";
import NamespaceSelector from "./components/NamespaceSelector";
import MobileLayout from "./features/mobile/MobileLayout";
import { ToastContainer } from "./components/Toast";
import { AUTH_ERROR_EVENT } from "./lib/api";
import { detectLocale } from "./i18n/index";

const consumeTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (!token) return false;

  localStorage.setItem("api_token", token);
  params.delete("token");
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${
    window.location.hash
  }`;
  window.history.replaceState({}, "", nextUrl);
  return true;
};

// ===== Device detection =====

const isMobileDevice = () => {
  const ua = navigator.userAgent;
  return /Mobile|Android|iPhone|iPad|WebOS/i.test(ua);
};

const getMobilePreference = () =>
  localStorage.getItem("mobile_preference") || "auto";

/**
 * Redirects between / and /m/ routes based on device type and user preference.
 * Must be called inside BrowserRouter (uses useLocation).
 */
function useDeviceRedirect() {
  const location = useLocation();

  useEffect(() => {
    const pref = getMobilePreference();
    const isMobile = isMobileDevice();
    const isMobilePath = location.pathname.startsWith("/m/");

    let shouldRedirect = false;
    let targetPath = "";

    if (pref === "mobile") {
      if (!isMobilePath) {
        shouldRedirect = true;
        const mapping = {
          "/review": "/m/review",
          "/memory": "/m/memory",
          "/soul": "/m/soul",
          "/maintenance": "/m/maintenance",
        };
        const match = Object.entries(mapping).find(([k]) =>
          location.pathname.startsWith(k)
        );
        targetPath = match ? match[1] : "/m/review";
      }
    } else if (pref === "desktop") {
      if (isMobilePath) {
        shouldRedirect = true;
        targetPath = "/review";
      }
    } else {
      // auto mode
      if (isMobile && !isMobilePath) {
        shouldRedirect = true;
        targetPath = "/m/review";
      } else if (!isMobile && isMobilePath) {
        shouldRedirect = true;
        targetPath = "/review";
      }
    }

    if (shouldRedirect) {
      window.location.replace(targetPath);
    }
  }, [location.pathname]);
}

// ===== Layout =====

function Layout() {
  const { t } = useTranslation();
  const location = useLocation();

  // Redirect between desktop and mobile based on device + preference
  useDeviceRedirect();

  // Mobile route? Delegate to MobileLayout
  const isMobileRoute = location.pathname.startsWith("/m/");
  if (isMobileRoute) {
    return <MobileLayout />;
  }

  // === Desktop layout ===
  const isReviewPage = location.pathname.startsWith("/review");
  const isMaintenancePage = location.pathname.startsWith("/maintenance");

  return (
    <div className="flex flex-col h-screen bg-nocturne-bg-primary text-nocturne-text-primary">
      {/* Top Navigation Bar */}
      <div className="h-12 border-b border-[var(--color-border)] bg-nocturne-bg-secondary flex items-center px-4 gap-6 flex-shrink-0 z-10">
        <div className="font-bold text-nocturne-text-primary flex items-center gap-2 mr-4">
          <LayoutGrid className="w-5 h-5 text-indigo-500" />
          <span data-testid="app-brand">{t("app.nav.brand")}</span>
        </div>

        <nav className="flex items-center gap-1 h-full">
          <NavLink
            to="/review"
            className={({ isActive }) =>
              clsx(
                "h-full flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-indigo-500 text-indigo-400 bg-nocturne-bg-tertiary/50"
                  : "border-transparent text-nocturne-text-secondary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary/30"
              )
            }
          >
            <ShieldCheck size={16} />
            {t("app.nav.review")}
          </NavLink>

          <NavLink
            to="/memory"
            className={({ isActive }) =>
              clsx(
                "h-full flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-emerald-500 text-emerald-400 bg-nocturne-bg-tertiary/50"
                  : "border-transparent text-nocturne-text-secondary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary/30"
              )
            }
          >
            <Database size={16} />
            {t("app.nav.memory")}
          </NavLink>

          <NavLink
            to="/soul"
            className={({ isActive }) =>
              clsx(
                "h-full flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-rose-500 text-rose-400 bg-nocturne-bg-tertiary/50"
                  : "border-transparent text-nocturne-text-secondary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary/30"
              )
            }
          >
            <Heart size={16} />
            {t("app.nav.soul")}
          </NavLink>

          <NavLink
            to="/maintenance"
            className={({ isActive }) =>
              clsx(
                "h-full flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-amber-500 text-amber-400 bg-nocturne-bg-tertiary/50"
                  : "border-transparent text-nocturne-text-secondary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary/30"
              )
            }
          >
            <Sparkles size={16} />
            {t("app.nav.maintenance")}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {!isReviewPage && !isMaintenancePage && <NamespaceSelector />}
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-settings"))
            }
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-nocturne-text-secondary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary/50"
          >
            <Settings size={16} />
            {t("app.nav.settings")}
          </button>
          {/* Desktop → Mobile switch */}
          <button
            onClick={() => {
              localStorage.setItem("mobile_preference", "mobile");
              window.location.replace("/m/review");
            }}
            className="text-[10px] text-nocturne-text-muted hover:text-nocturne-text-secondary px-2"
          >
            📱
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/review" replace />} />

          <Route path="/review" element={<ReviewPage />} />

          <Route path="/memory" element={<MemoryBrowser />} />

          <Route path="/soul" element={<SoulPage />} />

          <Route path="/maintenance" element={<MaintenancePage />} />
        </Routes>
      </div>

      <SettingsDrawer />
      <ToastContainer />
    </div>
  );
}

// ===== App =====

function App() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return consumeTokenFromUrl() || !!localStorage.getItem("api_token");
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [backendError, setBackendError] = useState(false);

  const handleAuthError = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
    setBackendError(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkAuthStatus = async () => {
      try {
        const { getDomains } = await import("./lib/api");
        await getDomains();
        if (mounted) {
          setIsAuthenticated(true);
          setBackendError(false);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        if (mounted) {
          if (!error.response) {
            setBackendError(true);
          } else if (error.response.status === 401) {
            setIsAuthenticated(false);
            setBackendError(false);
          } else {
            setBackendError(false);
          }
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuthStatus();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError);
    return () => {
      window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
    };
  }, [handleAuthError]);

  useEffect(() => {
    if (!isCheckingAuth && isAuthenticated) {
      detectLocale();
    }
  }, [isCheckingAuth, isAuthenticated]);

  if (isCheckingAuth) {
    return (
      <div
        data-testid="app-loading"
        className="flex flex-col items-center justify-center h-screen bg-nocturne-bg-primary text-nocturne-text-secondary"
      >
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin mb-4"></div>
        <div className="text-sm">{t("app.loading.connecting")}</div>
      </div>
    );
  }

  if (backendError) {
    return (
      <div
        data-testid="error-connection-refused"
        className="flex flex-col items-center justify-center h-screen bg-nocturne-bg-primary text-nocturne-text-secondary"
      >
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div className="text-lg font-bold text-nocturne-text-primary mb-1">
          {t("app.error.connection_refused")}
        </div>
        <div className="text-sm text-nocturne-text-muted max-w-md text-center mt-2 space-y-2">
          <p>{t("app.error.troubleshooting")}</p>
          <ul className="list-disc text-left pl-6 space-y-1">
            <li>{t("app.error.check_backend")}</li>
            <li>
              <strong>{t("app.error.check_port_title")}</strong>
              {t("app.error.check_port_detail")}
            </li>
            <li>{t("app.error.check_docker")}</li>
          </ul>
        </div>
        <button
          data-testid="retry-btn"
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors"
        >
          {t("app.error.retry")}
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <TokenAuth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
