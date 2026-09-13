import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Server, Layers, Settings, X, RefreshCw, Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n, { detectLocale } from '../../i18n';
import { getSettings, updateSettings, getDatabaseStatus } from '../../lib/api';
import { useTheme } from '../../lib/theme';

import Section from './Section';
import DatabaseSection from './DatabaseSection';
import PresetsSection from './PresetsSection';
import BootUrisSection from './BootUrisSection';
import ServerSection from './ServerSection';
import AdvancedSection from './AdvancedSection';
import LocaleSection from './LocaleSection';

export default function SettingsDrawer() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configPath, setConfigPath] = useState('');
  const [lockedFields, setLockedFields] = useState([]);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-settings', handleOpen);
    return () => window.removeEventListener('open-settings', handleOpen);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, statusData] = await Promise.all([
        getSettings(),
        getDatabaseStatus(),
      ]);
      setSettings(settingsData.settings);
      setConfigPath(settingsData.config_path);
      setLockedFields(settingsData.locked_fields || []);
      setDbStatus(statusData);
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAll();
    }
  }, [loadAll, isOpen]);

  const handleSave = async (updates) => {
    const result = await updateSettings(updates);
    if (Object.prototype.hasOwnProperty.call(updates, 'locale')) {
      // Locale change: no DB/server settings to refresh; skip loadAll()
      // to avoid destroying LocaleSection's local dropdown state.
      // Manually update the locale in settings so other tabs stay in sync.
      if (updates.locale === null) {
        await detectLocale();
      } else {
        await i18n.changeLanguage(updates.locale);
      }
      setSettings(prev => prev ? { ...prev, locale: updates.locale } : prev);
    } else {
      await loadAll();
    }
    return result;
  };

  const refreshDbStatus = async () => {
    try {
      setDbStatus(await getDatabaseStatus());
    } catch (e) {
      console.error('Failed to refresh DB status:', e);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: t('app.settings.tab_general'), icon: Settings },
    { id: 'database', label: t('app.settings.tab_database'), icon: Database },
    { id: 'memory', label: t('app.settings.tab_memory'), icon: Layers },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed inset-y-0 right-0 w-[600px] bg-[var(--surface-solid)] border-l border-[var(--border)] shadow-[var(--island-shadow)] z-50 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="border-b border-[var(--border)] bg-[var(--surface-solid)] px-6 pt-6 flex-shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('app.settings.title')}</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {t('app.settings.subtitle')}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors duration-150"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                    isActive
                      ? "border-[var(--accent)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border)]"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          {/* Appearance: light/dark theme toggle (persisted via lib/theme) */}
          <div className="mb-8 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t('app.settings.appearance')}
            </span>
            <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-hover)] p-0.5">
              {[
                { value: 'light', label: t('app.settings.themeLight') },
                { value: 'dark', label: t('app.settings.themeDark') },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`px-3 py-1 min-h-[var(--tap-target)] rounded-[var(--radius-sm)] text-xs font-medium transition-colors duration-150 ${
                    theme === option.value
                      ? "bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-[var(--island-shadow-soft)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              <RefreshCw size={20} className="animate-spin mr-2" /> {t('app.settings.loading')}
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <Section icon={Server} title={t('app.settings.section_server')}>
                    <ServerSection
                      settings={settings}
                      configPath={configPath}
                      lockedFields={lockedFields}
                      onSave={handleSave}
                    />
                  </Section>

                  <Section icon={Globe} title={t('app.settings.section_locale')}>
                    <LocaleSection settings={settings} onSave={handleSave} />
                  </Section>

                  <Section icon={Settings} title={t('app.settings.section_advanced')} defaultOpen={false}>
                    <AdvancedSection settings={settings} lockedFields={lockedFields} onSave={handleSave} />
                  </Section>
                </div>
              )}

              {activeTab === 'database' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <Section icon={Database} title={t('app.settings.section_database')}>
                    <DatabaseSection
                      settings={settings}
                      dbStatus={dbStatus}
                      onRefreshStatus={refreshDbStatus}
                      onSave={handleSave}
                    />
                  </Section>
                </div>
              )}

              {activeTab === 'memory' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <Section icon={Layers} title={t('app.settings.section_presets')}>
                    <PresetsSection />
                  </Section>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
