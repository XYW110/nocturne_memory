import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { getEmotion } from '../../lib/api';

const DIMENSIONS = ['trust', 'closeness', 'respect', 'dependency', 'security', 'resonance'];

// Bar color shifts from cool (low) to warm (high).
function barColor(value) {
  if (value >= 75) return 'bg-rose-500';
  if (value >= 55) return 'bg-indigo-500';
  if (value >= 35) return 'bg-slate-500';
  return 'bg-nocturne-bg-hover';
}

function DimensionBar({ value, label }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-nocturne-text-primary">{label}</span>
        <span className="text-nocturne-text-secondary font-mono">{value}</span>
      </div>
      <div className="h-2 bg-nocturne-bg-tertiary rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function EmotionPanel({ refreshTrigger = 0 }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const emo = await getEmotion();
      setValues(emo.values);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  if (loading) {
    return <div className="pt-4 text-sm text-nocturne-text-muted flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> {t('settings.emotion.loading')}</div>;
  }

  if (error || !values) {
    return (
      <div className="pt-4 space-y-2">
        <p className="text-xs text-nocturne-text-muted">{t('settings.emotion.no_target')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-nocturne-text-muted">{t('settings.emotion.description')}</p>
        <button onClick={load} className="text-nocturne-text-muted hover:text-nocturne-text-primary" title={t('settings.emotion.refresh')}>
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="space-y-2.5 bg-nocturne-bg-tertiary/40 border border-[var(--color-border)] rounded-lg p-3 max-h-[360px] overflow-y-auto">
        {DIMENSIONS.map(dim => (
          <DimensionBar key={dim} value={values[dim]} label={t(`settings.emotion.dim.${dim}`)} />
        ))}
      </div>
    </div>
  );
}
