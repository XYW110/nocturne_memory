import React, { useState, useEffect, useRef } from 'react';
import { Tag, X, Save, Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { toast } from '../../../components/Toast';
import { useLocale } from '../../../i18n/useLocale';

const KeywordManager = ({ keywords, nodeUuid, onUpdate }) => {
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const handleAdd = async () => {
    const kw = newKeyword.trim();
    if (!kw || !nodeUuid) return;
    try {
      await api.post('/browse/glossary', { keyword: kw, node_uuid: nodeUuid });
      setNewKeyword('');
      setAdding(false);
      onUpdate();
    } catch (err) {
      toast(t('memory.keywords.add_error', { error: err.response?.data?.detail || err.message }), "error");
    }
  };

  const handleRemove = async (kw) => {
    if (!nodeUuid) return;
    try {
      await api.delete('/browse/glossary', { data: { keyword: kw, node_uuid: nodeUuid } });
      onUpdate();
    } catch (err) {
      toast(t('memory.keywords.remove_error', { error: err.response?.data?.detail || err.message }), "error");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setAdding(false); setNewKeyword(''); }
  };

  return (
    <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
      <Tag size={13} className="flex-shrink-0 mt-0.5 text-[var(--semantic-warning-fg)]" />
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[var(--semantic-warning-fg)] font-medium">{t('memory.keywords.label')}</span>
        {keywords.map(kw => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--semantic-warning-bg)] rounded-[var(--radius-sm)] text-[var(--semantic-warning-fg)] font-mono text-[11px]"
          >
            {kw}
            <button
              onClick={() => handleRemove(kw)}
              className="text-[var(--semantic-warning-fg)] opacity-70 hover:opacity-100 transition-opacity duration-150"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        {adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!newKeyword.trim()) setAdding(false); }}
              placeholder={t('memory.keywords.placeholder')}
              className="w-28 px-1.5 py-0.5 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-[11px] font-mono focus:outline-none focus:shadow-[var(--focus-ring)]"
            />
            <button onClick={handleAdd} className="text-[var(--accent)] hover:opacity-80 transition-opacity duration-150">
              <Save size={11} />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border border-dashed border-[var(--text-faint)] rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors duration-150 text-[11px]"
          >
            <Plus size={9} /> {t('memory.keywords.add')}
          </button>
        )}
      </div>
    </div>
  );
};

export default KeywordManager;
