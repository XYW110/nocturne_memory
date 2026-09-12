import React, { useState, useRef, useEffect } from 'react';
import { Link2, X, Save, Plus, Loader2 } from 'lucide-react';
import { api, deleteNode, addAlias } from '../../../lib/api';
import { useLocale } from '../../../i18n/useLocale';

const AliasManager = ({ aliases, currentDomain, currentPath, onUpdate }) => {
  const { t } = useLocale();
  const [adding, setAdding] = useState(false);
  const [pathSegments, setPathSegments] = useState([]);   // selected segments: ['nocturne', 'salem']
  const [childrenByLevel, setChildrenByLevel] = useState([[]]); // options at each level
  const [leafName, setLeafName] = useState('');
  const [newDisclosure, setNewDisclosure] = useState('');
  const [newPriority, setNewPriority] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [loadingLevel, setLoadingLevel] = useState(-1);
  const leafInputRef = useRef(null);

  const fetchChildren = async (parentPath) => {
    try {
      const res = await api.get('/browse/node', { params: { domain: currentDomain, path: parentPath, nav_only: true } });
      return (res.data.children || []).map(c => c.path.split('/').pop());
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (adding) {
      setLoadingLevel(0);
      fetchChildren('').then(names => {
        setChildrenByLevel([names]);
        setLoadingLevel(-1);
      });
    }
  }, [adding]);

  const handleSegmentChange = async (level, value) => {
    if (value === '') {
      // selected "(stop here)" — truncate to this level
      setPathSegments(prev => prev.slice(0, level));
      setChildrenByLevel(prev => prev.slice(0, level + 1));
    } else {
      const newSegments = [...pathSegments.slice(0, level), value];
      setPathSegments(newSegments);
      setChildrenByLevel(prev => prev.slice(0, level + 1));

      // fetch children of the newly selected path
      const fullPath = newSegments.join('/');
      setLoadingLevel(level + 1);
      const children = await fetchChildren(fullPath);
      if (children.length > 0) {
        setChildrenByLevel(prev => [...prev, children]);
      }
      setLoadingLevel(-1);
    }
  };

  useEffect(() => {
    if (adding && loadingLevel === -1 && leafInputRef.current) leafInputRef.current.focus();
  }, [adding, loadingLevel]);

  const parseAlias = (aliasUri) => {
    const idx = aliasUri.indexOf('://');
    if (idx === -1) return { domain: currentDomain, path: aliasUri };
    return { domain: aliasUri.substring(0, idx), path: aliasUri.substring(idx + 3) };
  };

  const handleRemove = async (aliasUri) => {
    setRemoving(aliasUri);
    setError('');
    try {
      const { domain, path } = parseAlias(aliasUri);
      await deleteNode(domain, path);
      onUpdate();
    } catch (err) {
      setError(t('memory.alias.remove_error', { error: err.response?.data?.detail || err.message }));
    } finally {
      setRemoving(null);
    }
  };

  const buildFullPath = () => {
    const leaf = leafName.trim();
    if (!leaf) return '';
    const parent = pathSegments.join('/');
    return parent ? `${parent}/${leaf}` : leaf;
  };

  const handleAdd = async () => {
    const fullPath = buildFullPath();
    if (!fullPath || !newDisclosure.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addAlias({
        new_path: fullPath,
        target_path: currentPath,
        disclosure: newDisclosure.trim(),
        new_domain: currentDomain,
        target_domain: currentDomain,
        priority: newPriority,
      });
      setPathSegments([]);
      setChildrenByLevel([[]]);
      setLeafName('');
      setNewDisclosure('');
      setNewPriority(0);
      setAdding(false);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') cancelAdd();
  };

  const cancelAdd = () => {
    setAdding(false);
    setPathSegments([]);
    setChildrenByLevel([[]]);
    setLeafName('');
    setNewDisclosure('');
    setNewPriority(0);
    setError('');
  };

  return (
    <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
      <Link2 size={13} className="flex-shrink-0 mt-0.5 text-[var(--text-faint)]" />
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[var(--text-faint)] font-medium">{t('memory.alias.label')}</span>
        {aliases.map(alias => (
          <span
            key={alias}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] font-mono text-[11px]"
          >
            {alias}
            {confirmRemove === alias ? (
              <span className="inline-flex items-center gap-1 ml-1">
                <button
                  onClick={() => { setConfirmRemove(null); handleRemove(alias); }}
                  disabled={removing === alias}
                  className="text-[var(--semantic-danger-fg)] hover:opacity-80 text-[10px] font-medium transition-opacity duration-150 disabled:opacity-50"
                >
                  {removing === alias ? <Loader2 size={9} className="animate-spin" /> : t('memory.alias.confirm_yes')}
                </button>
                <button
                  onClick={() => setConfirmRemove(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[10px] transition-colors duration-150"
                >
                  {t('memory.alias.confirm_no')}
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmRemove(alias)}
                className="text-[var(--text-faint)] hover:text-[var(--semantic-danger-fg)] transition-colors duration-150"
                title={t('memory.alias.remove_tooltip')}
              >
                <X size={9} />
              </button>
            )}
          </span>
        ))}
        {adding ? (
          <div className="w-full space-y-1.5 mt-1">
            {/* Row 1: cascading path selectors */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">{currentDomain}://</span>
              {childrenByLevel.map((options, level) => (
                options.length > 0 && (
                  <React.Fragment key={level}>
                    {level > 0 && <span className="text-[var(--text-faint)] text-[11px]">/</span>}
                    <select
                      value={pathSegments[level] || ''}
                      onChange={e => handleSegmentChange(level, e.target.value)}
                      className="px-1.5 py-0.5 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-[11px] font-mono focus:outline-none focus:shadow-[var(--focus-ring)]"
                    >
                      <option value="">{level === 0 ? t('memory.alias.root_option') : '—'}</option>
                      {options.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </React.Fragment>
                )
              ))}
              {loadingLevel >= 0 && <Loader2 size={9} className="animate-spin text-[var(--text-muted)]" />}
              <span className="text-[var(--text-faint)] text-[11px]">/</span>
              <input
                ref={leafInputRef}
                type="text"
                value={leafName}
                onChange={e => setLeafName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('memory.alias.name_placeholder')}
                className="w-24 px-1.5 py-0.5 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-[11px] font-mono focus:outline-none focus:shadow-[var(--focus-ring)]"
              />
            </div>
            {/* Row 2: disclosure, priority, actions (fixed position) */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newDisclosure}
                onChange={e => setNewDisclosure(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('memory.alias.disclosure_placeholder')}
                className="w-48 px-1.5 py-0.5 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-[11px] focus:outline-none focus:shadow-[var(--focus-ring)]"
              />
              <input
                type="number" min="0"
                value={newPriority}
                onChange={e => setNewPriority(parseInt(e.target.value) || 0)}
                onKeyDown={handleKeyDown}
                className="w-14 px-1.5 py-0.5 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)] text-[11px] font-mono tabular-nums focus:outline-none focus:shadow-[var(--focus-ring)]"
                title={t('memory.alias.priority')}
              />
              <button
                onClick={handleAdd}
                disabled={saving || !leafName.trim() || !newDisclosure.trim()}
                className="text-[var(--accent)] hover:opacity-80 transition-opacity duration-150 disabled:opacity-50"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              </button>
              <button onClick={cancelAdd} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors duration-150">
                <X size={11} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border border-dashed border-[var(--text-faint)] rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors duration-150 text-[11px]"
          >
            <Plus size={9} /> {t('memory.alias.add')}
          </button>
        )}
      </div>
      {error && <span className="text-[var(--semantic-danger-fg)] w-full text-[11px]">{error}</span>}
    </div>
  );
};

export default AliasManager;
