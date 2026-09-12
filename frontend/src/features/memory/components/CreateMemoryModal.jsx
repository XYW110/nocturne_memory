import React, { useState, useRef, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { createMemory } from '../../../lib/api';
import { useLocale } from '../../../i18n/useLocale';

export default function CreateMemoryModal({ onClose, onCreated, parentPath, currentDomain }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState(0);
  const [disclosure, setDisclosure] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLocale();
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleCreate = async () => {
    if (!content.trim() || !disclosure.trim()) return;
    setSaving(true);
    setError('');
    try {
      const result = await createMemory({
        parent_path: parentPath,
        content: content.trim(),
        priority,
        disclosure: disclosure.trim(),
        title: title.trim() || undefined,
        domain: currentDomain,
      });
      onCreated(result.uri);
      // Reset form
      setTitle('');
      setContent('');
      setPriority(0);
      setDisclosure('');
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setTitle('');
    setContent('');
    setPriority(0);
    setDisclosure('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={handleClose}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-xl)] p-6 max-w-4xl w-[calc(100%-2rem)] shadow-[var(--island-shadow)] max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-[var(--radius-lg)] bg-[var(--surface-hover)] text-[var(--text-primary)]">
            <Plus size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{t('memory.create.title')}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('memory.create.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[var(--semantic-danger-bg)] rounded-[var(--radius-md)] text-[var(--semantic-danger-fg)] text-sm">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Parent path (readonly) */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">{t('memory.create.parent_path')}</label>
              <div className="w-full bg-[var(--surface-hover)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] font-mono select-all">
                {currentDomain}://{parentPath || 'root'}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">
                  {t('memory.create.title_label')} <span className="text-[var(--text-faint)] font-normal">{t('memory.create.optional')}</span>
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">{t('memory.create.title_hint')}</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('memory.create.title_placeholder')}
                className="w-full bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-[var(--text-muted)]">{t('memory.create.priority_label')}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{t('memory.create.priority_hint')}</span>
              </label>
              <input
                type="number"
                min="0"
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono tabular-nums focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
              />
            </div>
          </div>

          {/* Disclosure */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              {t('memory.create.disclosure_label')} <span className="text-[var(--semantic-danger-fg)]">*</span>
            </label>
            <input
              type="text"
              value={disclosure}
              onChange={e => setDisclosure(e.target.value)}
              placeholder={t('memory.create.disclosure_placeholder')}
              className="w-full bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              {t('memory.create.content_label')} <span className="text-[var(--semantic-danger-fg)]">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('memory.create.content_placeholder')}
              className="w-full min-h-[120px] bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150 resize-none overflow-hidden"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-[var(--border)]">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] border border-[var(--border)] transition-colors duration-150 disabled:opacity-50"
          >
            {t('memory.create.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !content.trim() || !disclosure.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 rounded-[var(--radius-md)] transition-opacity duration-150 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('memory.create.creating')}
              </>
            ) : (
              <>
                <Plus size={16} />
                {t('memory.create.button')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
