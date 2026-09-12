import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../components/Toast';

export default function LocaleSection({ settings, onSave }) {
  const { t } = useTranslation();
  const [locale, setLocale] = useState('auto');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.locale !== undefined) {
      setLocale(settings.locale === null ? 'auto' : settings.locale);
    }
  }, [settings?.locale]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ locale: locale === 'auto' ? null : locale });
      setDirty(false);
    } catch (e) {
      toast(t('settings.locale.save_failed') + ': ' + (e.response?.data?.detail || e.message), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{t('settings.locale.label')}</label>
        <select
          value={locale}
          onChange={e => { setLocale(e.target.value); setDirty(true); }}
          className="bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] rounded-[var(--radius-md)] px-3 py-2 text-sm focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
        >
          <option value="auto">{t('settings.locale.auto_option')}</option>
          <option value="en">{t('settings.locale.en_option')}</option>
          <option value="zh">{t('settings.locale.zh_option')}</option>
        </select>
      </div>

      {dirty && (
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-[var(--radius-md)] text-sm font-medium flex items-center gap-2 transition-opacity duration-150"
          >
            <Save size={14} />
            {saving ? t('settings.locale.saving') : t('settings.locale.save')}
          </button>
        </div>
      )}
    </div>
  );
}
