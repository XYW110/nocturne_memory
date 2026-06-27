import React, { useState, useEffect, useCallback } from 'react';
import { Heart, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { getEmotion, getEmotionLedger } from '../../lib/api';

const DIMENSIONS = ['trust', 'closeness', 'respect', 'dependency', 'security', 'resonance'];

// Bar color shifts from cool (low) to warm (high).
function barColor(value) {
  if (value >= 75) return 'bg-rose-500';
  if (value >= 55) return 'bg-indigo-500';
  if (value >= 35) return 'bg-slate-500';
  return 'bg-slate-600';
}

function DimensionBar({ dim, value, label }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 font-mono">{value}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function LedgerEntry({ entry, t }) {
  const [open, setOpen] = useState(false);
  const changed = Object.entries(entry.deltas).filter(([, d]) => d !== 0);
  const when = entry.created_at ? entry.created_at.slice(0, 16).replace('T', ' ') : '';

  return (
    <div className="border border-slate-800 rounded-md bg-slate-950/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-slate-900/40"
      >
        {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        <span className="text-[11px] text-slate-500 font-mono">{when}</span>
        <span className="flex-1 flex flex-wrap gap-1 justify-end">
          {changed.map(([d, delta]) => (
            <span
              key={d}
              className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded font-mono',
                delta > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              )}
            >
              {t(`settings.emotion.dim.${d}`)}{delta > 0 ? '+' : ''}{delta}
            </span>
          ))}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-xs text-slate-400 border-t border-slate-800/60 space-y-1">
          <p className="whitespace-pre-wrap leading-relaxed">{entry.reason}</p>
          {entry.context && <p className="text-slate-600 italic">{entry.context}</p>}
        </div>
      )}
    </div>
  );
}

export default function EmotionDashboard({ refreshTrigger = 0 }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [emo, led] = await Promise.all([
        getEmotion(),
        getEmotionLedger(),
      ]);
      setValues(emo.values);
      setLedger(led.entries || []);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  if (loading) {
    return <div className="pt-4 text-sm text-slate-500 flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> {t('settings.emotion.loading')}</div>;
  }

  if (error || !values) {
    return (
      <div className="pt-4 space-y-2">
        <p className="text-xs text-slate-500">{t('settings.emotion.no_target')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{t('settings.emotion.description')}</p>
        <button onClick={load} className="text-slate-500 hover:text-slate-300" title={t('settings.emotion.refresh')}>
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="space-y-2.5 bg-slate-900/40 border border-slate-800 rounded-lg p-3 max-h-[360px] overflow-y-auto">
        {DIMENSIONS.map(dim => (
          <DimensionBar key={dim} dim={dim} value={values[dim]} label={t(`settings.emotion.dim.${dim}`)} />
        ))}
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <Heart size={12} className="text-rose-400" />
          {t('settings.emotion.ledger_title')}
        </div>
        <div className="space-y-1.5">
          {ledger.length === 0 ? (
            <p className="text-[11px] text-slate-600 italic">{t('settings.emotion.ledger_empty')}</p>
          ) : (
            ledger.map(entry => <LedgerEntry key={entry.id} entry={entry} t={t} />)
          )}
        </div>
      </div>
    </div>
  );
}
