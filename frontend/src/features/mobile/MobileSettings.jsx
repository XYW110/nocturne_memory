import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Settings, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { getSettings, updateSettings, getDatabaseStatus } from "../../lib/api";
import i18n, { detectLocale } from "../../i18n";
import Section from "../settings/Section";
import DatabaseSection from "../settings/DatabaseSection";
import PresetsSection from "../settings/PresetsSection";
import BootUrisSection from "../settings/BootUrisSection";
import ServerSection from "../settings/ServerSection";
import AdvancedSection from "../settings/AdvancedSection";
import LocaleSection from "../settings/LocaleSection";

const TABS = [
  { id: "general", labelKey: "settings.tab.general" },
  { id: "database", labelKey: "settings.tab.database" },
  { id: "memory", labelKey: "settings.tab.memory" },
  { id: "soul", labelKey: "settings.tab.soul" },
];

/**
 * MobileSettings — full-screen settings page.
 *
 * Reuses Section, DatabaseSection, PresetsSection, BootUrisSection,
 * ServerSection, AdvancedSection, LocaleSection from the desktop
 * SettingsDrawer. Same data loading pattern (loadAll via getSettings +
 * getDatabaseStatus).
 */
export default function MobileSettings() {
  const { t } = useTranslation("mobile");
  const [settings, setSettings] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configPath, setConfigPath] = useState("");
  const [lockedFields, setLockedFields] = useState([]);
  const [activeTab, setActiveTab] = useState("general");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, statusData] = await Promise.all([
        getSettings(),
        getDatabaseStatus(),
      ]);
      setSettings(settingsData?.settings || {});
      setConfigPath(settingsData?.config_path || "");
      setLockedFields(settingsData?.locked_fields || []);
      setDbStatus(statusData || null);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSave = async (updates, opts) => {
    try {
      await updateSettings(updates);
      await loadAll();
      if (updates.locale !== undefined) {
        const newLocale = updates.locale;
        if (newLocale) {
          await i18n.changeLanguage(newLocale);
        } else {
          await detectLocale();
        }
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
      throw err;
    }
  };

  const handleRefreshDbStatus = async () => {
    try {
      const statusData = await getDatabaseStatus();
      setDbStatus(statusData || null);
    } catch (err) {
      console.error("Failed to refresh DB status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw
          size={20}
          className="animate-spin text-nocturne-text-muted"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-nocturne-bg-secondary flex overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-nocturne-text-secondary"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {activeTab === "general" && settings && (
          <>
            <ServerSection
              settings={settings}
              configPath={configPath}
              lockedFields={lockedFields}
              onSave={handleSave}
            />
            <LocaleSection settings={settings} onSave={handleSave} />
            <AdvancedSection
              settings={settings}
              lockedFields={lockedFields}
              onSave={handleSave}
            />
          </>
        )}

        {activeTab === "database" && settings && (
          <DatabaseSection
            settings={settings}
            dbStatus={dbStatus}
            onRefreshStatus={handleRefreshDbStatus}
            onSave={handleSave}
          />
        )}

        {activeTab === "memory" && (
          <div className="space-y-4">
            <BootUrisSection settings={settings} onSave={handleSave} />
            <PresetsSection />
          </div>
        )}

        {activeTab === "soul" && settings && (
          <div>
            {/* Soul settings are managed through the Soul page */}
            <p className="text-sm text-nocturne-text-muted text-center py-8">
              Soul settings are managed on the Soul page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
