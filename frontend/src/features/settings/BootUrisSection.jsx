import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, Save, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  getAllBootUris, setBootUrisForNs, deleteBootUrisForNs, getNamespaces
} from '../../lib/api';
import { toast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

function NamespaceBootPanel({ namespace, uris: initialUris, isDefault, onDelete, onSaved }) {
  const { t } = useTranslation();
  const [uris, setUris] = useState(initialUris);
  const [newUri, setNewUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(isDefault);
  const [deleting, setDeleting] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  useEffect(() => { setUris(initialUris); setDirty(false); }, [initialUris]);

  const handleDragStart = (idx) => { dragItem.current = idx; };
  const handleDragEnter = (idx) => { dragOver.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    if (dragItem.current === dragOver.current) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    const items = [...uris];
    const [removed] = items.splice(dragItem.current, 1);
    items.splice(dragOver.current, 0, removed);
    setUris(items);
    setDirty(true);
    dragItem.current = null;
    dragOver.current = null;
  };

  const handleAdd = () => {
    const trimmed = newUri.trim();
    if (!trimmed || uris.includes(trimmed)) return;
    setUris([...uris, trimmed]);
    setNewUri('');
    setDirty(true);
  };

  const handleRemove = (idx) => {
    setUris(uris.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setBootUrisForNs(namespace, uris);
      setDirty(false);
      onSaved?.();
    } catch (e) {
      toast(t('settings.boot_uris.save_failed') + ': ' + (e.response?.data?.detail || e.message), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setConfirmState({
      title: t('settings.boot_uris.remove_override_title'),
      message: t('settings.boot_uris.remove_override_message', { namespace }),
      variant: "danger",
      confirmLabel: t('settings.boot_uris.remove'),
      onConfirm: async () => {
        setConfirmState(null);
        setDeleting(true);
        try {
          await deleteBootUrisForNs(namespace);
          onDelete?.(namespace);
        } catch (e) {
          toast(t('settings.boot_uris.delete_failed') + ': ' + (e.response?.data?.detail || e.message), "error");
        } finally {
          setDeleting(false);
        }
      },
      onCancel: () => setConfirmState(null),
    });
  };

  const label = isDefault ? t('settings.boot_uris.default_label') : namespace;

  return (
    <div className="bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--surface-hover)] transition-colors duration-150"
      >
        <Layers size={14} className={clsx(isDefault ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")} />
        <span className={clsx("text-sm font-medium", isDefault ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]")}>{label}</span>
        {isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--semantic-info-bg)] text-[var(--semantic-info-fg)] border border-[var(--border)]">{t('settings.boot_uris.fallback_badge')}</span>}
        <span className="text-xs text-[var(--text-faint)] ml-auto mr-2 tabular-nums">{t('settings.boot_uris.uri_count', { count: uris.length })}</span>
        {open ? <ChevronUp size={14} className="text-[var(--text-faint)]" /> : <ChevronDown size={14} className="text-[var(--text-faint)]" />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)] space-y-2">
          <div className="space-y-1">
            {uris.map((uri, idx) => (
              <div
                key={uri}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--border)] rounded-[var(--radius-md)] px-2.5 py-1.5 group cursor-grab active:cursor-grabbing transition-colors duration-150"
              >
                <GripVertical size={12} className="text-[var(--text-faint)] group-hover:text-[var(--text-muted)] flex-shrink-0" />
                <span className="text-xs font-mono text-[var(--text-secondary)] flex-1 truncate">{uri}</span>
                <button
                  onClick={() => handleRemove(idx)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--semantic-danger-fg)] hover:opacity-80 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {uris.length === 0 && (
              <p className="text-xs text-[var(--text-faint)] italic py-1.5">{t('settings.boot_uris.empty')}</p>
            )}
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={newUri}
              onChange={e => setNewUri(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={t('settings.boot_uris.placeholder')}
              className="flex-1 bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
            />
            <button
              onClick={handleAdd}
              disabled={!newUri.trim()}
              className="px-2.5 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--border)] disabled:opacity-40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[var(--radius-md)] text-xs flex items-center gap-1 transition-colors duration-150"
            >
              <Plus size={12} /> {t('settings.boot_uris.add')}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            {!isDefault && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-[var(--semantic-danger-fg)] opacity-70 hover:opacity-100 flex items-center gap-1 transition-opacity duration-150"
              >
                <Trash2 size={11} />
                {deleting ? t('settings.boot_uris.removing') : t('settings.boot_uris.remove_override_button')}
              </button>
            )}
            {isDefault && <div />}
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-[var(--radius-md)] text-xs font-medium flex items-center gap-1.5 transition-opacity duration-150"
              >
                <Save size={12} />
                {saving ? t('settings.boot_uris.saving') : t('settings.boot_uris.save')}
              </button>
            )}
          </div>
        </div>
      )}
      {confirmState && <ConfirmModal {...confirmState} />}
    </div>
  );
}

export default function BootUrisSection() {
  const { t } = useTranslation();
  const [allBootUris, setAllBootUris] = useState({});
  const [knownNamespaces, setKnownNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingNs, setAddingNs] = useState(false);
  const [newNs, setNewNs] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bootData, nsList] = await Promise.all([
        getAllBootUris(),
        getNamespaces().catch(() => []),
      ]);
      setAllBootUris(bootData || {});
      setKnownNamespaces(nsList.filter(ns => ns !== ''));
    } catch (e) {
      console.error('Failed to load boot URIs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddNamespace = () => {
    const trimmed = newNs.trim();
    if (!trimmed || trimmed in allBootUris) return;
    setAllBootUris(prev => ({ ...prev, [trimmed]: [] }));
    setNewNs('');
    setAddingNs(false);
  };

  const handleDeleteNs = (ns) => {
    setAllBootUris(prev => {
      const next = { ...prev };
      delete next[ns];
      return next;
    });
  };

  if (loading) return <div className="pt-4 text-sm text-[var(--text-muted)]">{t('settings.boot_uris.loading')}</div>;

  const defaultUris = allBootUris[''] || [];
  const otherNamespaces = Object.keys(allBootUris).filter(ns => ns !== '').sort();
  const availableToAdd = knownNamespaces.filter(ns => !(ns in allBootUris));

  return (
    <div className="space-y-3 pt-4">
      <p className="text-xs text-[var(--text-muted)]">{t('settings.boot_uris.description')}</p>

      <div className="space-y-2">
        <NamespaceBootPanel
          key="__default__"
          namespace=""
          uris={defaultUris}
          isDefault
          onSaved={load}
        />
        {otherNamespaces.map(ns => (
          <NamespaceBootPanel
            key={ns}
            namespace={ns}
            uris={allBootUris[ns] || []}
            isDefault={false}
            onDelete={handleDeleteNs}
            onSaved={load}
          />
        ))}
      </div>

      {addingNs ? (
        <div className="flex gap-1.5 items-center">
          {availableToAdd.length > 0 ? (
            <select
              value={newNs}
              onChange={e => setNewNs(e.target.value === '__custom__' ? '' : e.target.value)}
              className="bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs focus:outline-none focus:shadow-[var(--focus-ring)]"
            >
              <option value="">{t('settings.boot_uris.select_or_type')}</option>
              {availableToAdd.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
              <option value="__custom__">{t('settings.boot_uris.custom_name')}</option>
            </select>
          ) : null}
          <input
            autoFocus={availableToAdd.length === 0}
            type="text"
            value={newNs}
            onChange={e => setNewNs(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddNamespace();
              if (e.key === 'Escape') { setAddingNs(false); setNewNs(''); }
            }}
            placeholder={t('settings.boot_uris.namespace_placeholder')}
            className="flex-1 bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
          />
          <button
            onClick={handleAddNamespace}
            disabled={!newNs.trim() || newNs.trim() in allBootUris}
            className="px-2.5 py-1.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-white rounded-[var(--radius-md)] text-xs flex items-center gap-1 transition-opacity duration-150"
          >
            <Plus size={12} /> {t('settings.boot_uris.add')}
          </button>
          <button
            onClick={() => { setAddingNs(false); setNewNs(''); }}
            className="px-2 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors duration-150"
          >
            {t('settings.boot_uris.cancel')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingNs(true)}
          className="w-full py-2 border border-dashed border-[var(--border)] hover:border-[var(--text-faint)] rounded-[var(--radius-lg)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors duration-150"
        >
          <Plus size={12} /> {t('settings.boot_uris.add_namespace')}
        </button>
      )}
    </div>
  );
}
