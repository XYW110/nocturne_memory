import React, { useState, useEffect } from 'react';
import {
  Plus, CheckCircle, XCircle, RefreshCw, TestTube, FolderOpen
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { testDatabase, createDatabase, openDbFolder } from '../../lib/api';
import { toast } from '../../components/Toast';

function parseSqlitePathFromUrl(url) {
  if (!url || !url.includes('sqlite')) return '';
  const m = url.match(/\/\/\/(.+)$/);
  return m ? m[1] : '';
}

export default function DatabaseSection({ settings, dbStatus, onRefreshStatus, onSave }) {
  const { t } = useTranslation();
  const currentUrl = settings?.database_url || '';
  const isSqliteCurrent = currentUrl.includes('sqlite');

  const [mode, setMode] = useState(isSqliteCurrent ? 'sqlite' : 'postgresql');
  const [sqlitePath, setSqlitePath] = useState('');
  const [pgUrl, setPgUrl] = useState('');
  const [newDbPath, setNewDbPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!currentUrl) return;
    if (currentUrl.includes('sqlite')) {
      setMode('sqlite');
      setSqlitePath(parseSqlitePathFromUrl(currentUrl));
    } else {
      setMode('postgresql');
      setPgUrl(currentUrl);
    }
  }, [currentUrl]);

  const buildUrl = () => {
    if (mode === 'sqlite') {
      const p = sqlitePath.trim().replace(/\\/g, '/');
      return p ? `sqlite+aiosqlite:///${p}` : '';
    }
    return pgUrl.trim();
  };

  const inputValue = mode === 'sqlite' ? sqlitePath : pgUrl;
  const hasInput = inputValue.trim().length > 0;

  const handleTestOnly = async () => {
    const url = buildUrl();
    if (!url) return;
    setBusy(true);
    setTestResult(null);
    try {
      const result = await testDatabase(url);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleTestAndSave = async () => {
    const url = buildUrl();
    if (!url) return;
    setBusy(true);
    setTestResult(null);
    try {
      const result = await testDatabase(url);
      if (result.success) {
        await onSave({ database_url: url });
        setDirty(false);
        setTestResult({ success: true, message: t('settings.database.connected_saved') });
        onRefreshStatus();
      } else {
        setTestResult(result);
      }
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.detail || e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const path = newDbPath.trim();
    if (!path) return;
    setCreating(true);
    setTestResult(null);
    try {
      const result = await createDatabase(path);
      setMode('sqlite');
      setSqlitePath(parseSqlitePathFromUrl(result.database_url));
      setDirty(true);
      setNewDbPath('');
      setTestResult({ success: true, message: t('settings.database.created_switch') });
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.detail || e.message });
    } finally {
      setCreating(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await openDbFolder();
    } catch (e) {
      toast(e.response?.data?.detail || e.message, "error");
    }
  };

  return (
    <div className="space-y-5 pt-4">
      {/* Status card */}
      {dbStatus && (
        <div className="bg-[var(--surface-solid)] border border-[var(--border)] shadow-[var(--island-shadow-soft)] rounded-[var(--radius-lg)] p-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">{t('settings.database.type_label')}</span>
            <span className="text-[var(--text-primary)] font-medium">{dbStatus.type === 'sqlite' ? t('settings.database.sqlite') : t('settings.database.postgresql')}</span>
          </div>
          {dbStatus.type === 'sqlite' && dbStatus.path && (
            <>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)] flex-shrink-0">{t('settings.database.path_label')}</span>
                <span className="text-[var(--text-secondary)] font-mono text-xs truncate max-w-[380px]" title={dbStatus.path}>{dbStatus.path}</span>
              </div>
              {dbStatus.size_display && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">{t('settings.database.size_label')}</span>
                  <span className="text-[var(--text-primary)] tabular-nums">{dbStatus.size_display}</span>
                </div>
              )}
            </>
          )}
          {dbStatus.type === 'postgresql' && dbStatus.url_masked && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">{t('settings.database.url_label')}</span>
              <span className="text-[var(--text-secondary)] font-mono text-xs">{dbStatus.url_masked}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-1">
            {dbStatus.type === 'sqlite' && dbStatus.path && (
              <button onClick={handleOpenFolder} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors duration-150">
                <FolderOpen size={11} /> {t('settings.database.open_folder')}
              </button>
            )}
            <button onClick={onRefreshStatus} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors duration-150">
              <RefreshCw size={11} /> {t('settings.database.refresh')}
            </button>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{t('settings.database.type_selector_label')}</label>
        <div className="flex rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] w-fit">
          {[
            { id: 'sqlite', label: t('settings.database.sqlite') },
            { id: 'postgresql', label: t('settings.database.postgresql') },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setMode(opt.id); setDirty(true); setTestResult(null); }}
              className={clsx(
                "px-4 py-1.5 text-sm font-medium transition-colors duration-150",
                mode === opt.id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-solid)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connection input */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {mode === 'sqlite' ? t('settings.database.file_path_label') : t('settings.database.connection_url_label')}
        </label>
        {mode === 'sqlite' ? (
          <input
            type="text"
            value={sqlitePath}
            onChange={e => { setSqlitePath(e.target.value); setDirty(true); setTestResult(null); }}
            placeholder={t('settings.database.sqlite_placeholder')}
            className="w-full bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-[var(--radius-md)] px-3 py-2 text-sm font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
          />
        ) : (
          <input
            type="text"
            value={pgUrl}
            onChange={e => { setPgUrl(e.target.value); setDirty(true); setTestResult(null); }}
            placeholder={t('settings.database.pg_placeholder')}
            className="w-full bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-[var(--radius-md)] px-3 py-2 text-sm font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
          />
        )}

        {hasInput && (
          <button
            onClick={dirty ? handleTestAndSave : handleTestOnly}
            disabled={busy}
            className="mt-1 px-4 py-2 bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-white rounded-[var(--radius-md)] text-sm flex items-center gap-1.5 transition-opacity duration-150"
          >
            <TestTube size={14} />
            {busy ? t('settings.database.testing') : (dirty ? t('settings.database.test_save') : t('settings.database.test_connection'))}
          </button>
        )}

        {testResult && (
          <div className={`flex items-center gap-2 text-sm rounded-[var(--radius-sm)] px-2 py-1 w-fit ${testResult.success ? 'text-[var(--semantic-success-fg)] bg-[var(--semantic-success-bg)]' : 'text-[var(--semantic-danger-fg)] bg-[var(--semantic-danger-bg)]'}`}>
            {testResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Create new SQLite DB */}
      {mode === 'sqlite' && (
        <div className="space-y-2 pt-2 border-t border-[var(--border)]">
          <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{t('settings.database.create_new_label')}</label>
          <p className="text-xs text-[var(--text-muted)]">{t('settings.database.create_new_desc')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDbPath}
              onChange={e => setNewDbPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={t('settings.database.new_db_placeholder')}
              className="flex-1 bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-[var(--radius-md)] px-3 py-2 text-sm font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newDbPath.trim()}
              className="px-3 py-2 bg-[var(--surface-hover)] hover:bg-[var(--border)] disabled:opacity-40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] text-sm flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap"
            >
              <Plus size={14} />
              {creating ? t('settings.database.creating') : t('settings.database.create')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
