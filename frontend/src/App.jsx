import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Database, LayoutGrid, Sparkles, AlertCircle, Layers, Settings } from 'lucide-react';
import clsx from 'clsx';

import ReviewPage from './features/review/ReviewPage';
import MemoryBrowser from './features/memory/MemoryBrowser';
import MaintenancePage from './features/maintenance/MaintenancePage';
import SettingsDrawer from './features/settings/SettingsDrawer';
import TokenAuth from './components/TokenAuth';
import { ToastContainer } from './components/Toast';
import { AUTH_ERROR_EVENT, getNamespaces } from './lib/api';
import { useTheme } from './lib/theme';
import { detectLocale } from './i18n/index';

const NAMESPACE_SWITCH_ROOT_REDIRECT_KEY = 'nocturne:namespace-switch-root-redirect';

const consumeTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return false;

  localStorage.setItem('api_token', token);
  params.delete('token');
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
  return true;
};

// ---------------------------------------------------------------------------
// NamespaceSelector — lets the user switch between agent namespaces.
//
// The selector is always visible so that users can manually enter a namespace
// even before any memories have been written (e.g. after a fresh deployment).
// Known namespaces fetched from the DB are offered as dropdown options, but
// the user can also type a custom value into the input box.
//
// Selected namespace is stored in localStorage; the axios interceptor in
// api.js attaches it as X-Namespace on every request.
// ---------------------------------------------------------------------------
function NamespaceSelector() {
  const [knownNamespaces, setKnownNamespaces] = useState([]);
  const [selected, setSelected] = useState(
    () => localStorage.getItem('selected_namespace') ?? ''
  );
  const [inputValue, setInputValue] = useState(
    () => localStorage.getItem('selected_namespace') ?? ''
  );
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    getNamespaces()
      .then(nsList => setKnownNamespaces(nsList.filter(ns => ns !== '')))
      .catch(() => setKnownNamespaces([]));
  }, []);

  const applyNamespace = (ns) => {
    const trimmed = ns.trim();
    const changed = trimmed !== selected;
    setSelected(trimmed);
    setInputValue(trimmed);
    if (trimmed) {
      localStorage.setItem('selected_namespace', trimmed);
    } else {
      localStorage.removeItem('selected_namespace');
    }
    if (changed) {
      sessionStorage.setItem(
        NAMESPACE_SWITCH_ROOT_REDIRECT_KEY,
        JSON.stringify({ from: selected, to: trimmed, at: Date.now() })
      );
    }
    window.location.reload();
  };

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setShowInput(true);
      return;
    }
    applyNamespace(val);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') applyNamespace(inputValue);
    if (e.key === 'Escape') setShowInput(false);
  };

  const activeLabel = selected || '(default)';

  return (
    <div className="flex items-center gap-2 text-sm max-[640px]:hidden">
      <Layers size={14} className="text-[var(--text-faint)] flex-shrink-0" />
      {showInput ? (
        <input
          autoFocus
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={() => setShowInput(false)}
          placeholder="namespace (Enter to apply)"
          className="bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] rounded-[var(--radius-sm)] px-2 py-1 text-xs w-40 focus:outline-none focus:shadow-[var(--focus-ring)]"
        />
      ) : (
        <select
          value={selected}
          onChange={handleSelectChange}
          className="bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] rounded-[var(--radius-sm)] px-2 py-1 text-xs focus:outline-none focus:shadow-[var(--focus-ring)]"
          title={`Current namespace: ${activeLabel}`}
        >
          <option value="">(default)</option>
          {knownNamespaces.map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
          {selected && !knownNamespaces.includes(selected) && (
            <option key={selected} value={selected}>{selected}</option>
          )}
          <option value="__custom__">+ enter custom…</option>
        </select>
      )}
    </div>
  );
}

function Layout() {
  const { t } = useTranslation();
  useTheme(); // apply persisted light/dark theme on mount
  const location = useLocation();
  const isReviewPage = location.pathname.startsWith('/review');
  const isMaintenancePage = location.pathname.startsWith('/maintenance');

  const navLinkClass = ({ isActive }) => clsx(
    "flex items-center gap-2 px-3 py-1.5 min-h-[var(--tap-target)] rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap transition-colors max-[640px]:px-2.5 max-[640px]:text-xs",
    isActive ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
  );

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-base)] p-[var(--gap-island)] gap-[var(--gap-island)]">
      {/* Top Navigation Bar (island card) */}
      <div className="h-12 rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--island-shadow)] border border-[var(--border)] flex items-center px-4 gap-6 flex-shrink-0 z-10 max-[720px]:px-2.5 max-[720px]:gap-3 overflow-hidden">
        <div className="font-bold text-[var(--text-primary)] flex items-center gap-2 mr-4 whitespace-nowrap max-[640px]:mr-0 max-[640px]:hidden">
          <LayoutGrid className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0" />
          <span data-testid="app-brand">{t('app.nav.brand')}</span>
        </div>

        <nav className="flex items-center gap-1 h-full">
          <NavLink
            to="/review"
            className={navLinkClass}
          >
            <ShieldCheck size={16} className="max-[640px]:hidden" />
            {t('app.nav.review')}
          </NavLink>

          <NavLink
            to="/memory"
            className={navLinkClass}
          >
            <Database size={16} className="max-[640px]:hidden" />
            {t('app.nav.memory')}
          </NavLink>

          <NavLink
            to="/maintenance"
            className={navLinkClass}
          >
            <Sparkles size={16} className="max-[640px]:hidden" />
            {t('app.nav.maintenance')}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-4 max-[640px]:gap-2">
          {!isReviewPage && !isMaintenancePage && <NamespaceSelector />}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
            className="flex items-center gap-2 px-3 py-1.5 min-h-[var(--tap-target)] rounded-[var(--radius-md)] text-sm font-medium whitespace-nowrap transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] max-[640px]:px-2.5"
          >
            <Settings size={16} />
            <span className="max-[640px]:hidden">{t('app.nav.settings')}</span>
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/review" replace />} />

          <Route path="/review" element={<ReviewPage />} />

          <Route path="/memory" element={<MemoryBrowser />} />

          <Route path="/maintenance" element={<MaintenancePage />} />
        </Routes>
      </div>

      <SettingsDrawer />
      <ToastContainer />
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return consumeTokenFromUrl() || !!localStorage.getItem('api_token');
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

  // 组件挂载时，尝试发送一个无 token 的请求探测后端是否连通及鉴权状态
  useEffect(() => {
    let mounted = true;

    const checkAuthStatus = async () => {
      try {
        const { getDomains } = await import('./lib/api');
        await getDomains();
        if (mounted) {
          setIsAuthenticated(true);
          setBackendError(false);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        if (mounted) {
          if (!error.response) {
            // 没有响应，说明是网络错误（后端未启动）
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

  // 监听 401 事件，切换回认证界面
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
      <div data-testid="app-loading" className="flex flex-col items-center justify-center h-screen bg-[var(--bg-base)] text-[var(--text-muted)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--text-primary)] animate-spin mb-4"></div>
        <div className="text-sm">{t('app.loading.connecting')}</div>
      </div>
    );
  }

  if (backendError) {
    return (
      <div data-testid="error-connection-refused" className="flex flex-col items-center justify-center h-screen bg-[var(--bg-base)] text-[var(--text-muted)]">
        <div className="w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-[var(--island-shadow)] border border-[var(--border)] px-6 py-8 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--semantic-danger-bg)] flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-[var(--semantic-danger-fg)]" />
          </div>
          <div className="text-lg font-bold text-[var(--text-primary)] mb-1">{t('app.error.connection_refused')}</div>
          <div className="text-sm text-[var(--text-muted)] max-w-md text-center mt-2 space-y-2">
            <p>{t('app.error.troubleshooting')}</p>
            <ul className="list-disc text-left pl-6 space-y-1">
              <li>{t('app.error.check_backend')}</li>
              <li><strong>{t('app.error.check_port_title')}</strong>{t('app.error.check_port_detail')}</li>
              <li>{t('app.error.check_docker')}</li>
            </ul>
          </div>
          <button
            data-testid="retry-btn"
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-[var(--accent)] text-white rounded-[var(--radius-md)] text-sm transition-opacity hover:opacity-90"
          >
            {t('app.error.retry')}
          </button>
        </div>
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
