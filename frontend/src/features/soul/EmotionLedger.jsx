import React, { useState, useEffect, useCallback } from 'react';
import { Heart, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { getEmotionLedger } from '../../lib/api';

function LedgerEntry({ entry, t }) {
  const [open, setOpen] = useState(false);
  const changed = Object.entries(entry.deltas).filter(([, d]) => d !== 0);
  const when = entry.created_at ? entry.created_at.slice(0, 16).replace('T', ' ') : '';

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-nocturne-bg-primary/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-nocturne-bg-tertiary/40"
      >
        {open ? <ChevronDown size={12} className="text-nocturne-text-muted" /> : <ChevronRight size={12} className="text-nocturne-text-muted" />}
        <span className="text-[11px] text-nocturne-text-muted font-mono">{when}</span>
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
        <div className="px-3 pb-2 pt-1 text-xs text-nocturne-text-secondary border-t border-[var(--color-border-strong)] space-y-1">
          <p className="whitespace-pre-wrap leading-relaxed">{entry.reason}</p>
          {entry.context && <p className="text-nocturne-text-muted italic">{entry.context}</p>}
        </div>
      )}
    </div>
  );
}

export default function EmotionLedger({ refreshTrigger = 0 }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const led = await getEmotionLedger();
      setEntries(led.entries || []);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  if (loading) {
    return <div className="pt-2 text-sm text-nocturne-text-muted flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /></div>;
  }

  if (error) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-1.5 text-xs text-nocturne-text-secondary">
        <Heart size={12} className="text-rose-400" />
        {t('settings.emotion.ledger_title')}
      </div>
      <div className="space-y-1.5">
        {entries.length === 0 ? (
          <p className="text-[11px] text-nocturne-text-muted italic">{t('settings.emotion.ledger_empty')}</p>
        ) : (
          entries.map(entry => <LedgerEntry key={entry.id} entry={entry} t={t} />)
        )}
      </div>
    </div>
  );
}
