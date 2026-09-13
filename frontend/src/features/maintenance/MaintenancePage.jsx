import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Trash2, Sparkles, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, ArrowRight, Unlink, Archive, CheckSquare, Square, Minus,
  Layers, Undo2, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import DiffViewer from '../../components/DiffViewer';
import { toast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import PromptModal from '../../components/PromptModal';
import { api, getNamespaces } from '../../lib/api';
import { useLocale } from '../../i18n/useLocale';

export default function MaintenancePage() {
  const { t } = useLocale();
  const [orphans, setOrphans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [detailData, setDetailData] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [logStats, setLogStats] = useState({ count: 0, oldest: null });
  const [clearingLogs, setClearingLogs] = useState(false);

  const [activeGroupKeys, setActiveGroupKeys] = useState([]);

  useEffect(() => {
    loadOrphans();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/maintenance/access-logs/stats');
      setLogStats(res.data);
    } catch (err) {
      console.error("Failed to load log stats:", err);
    }
  };

  const handleClearLogs = () => {
    setPromptState({
      title: t('maintenance.prompt.clear_logs_title'),
      message: t('maintenance.prompt.clear_logs_message'),
      defaultValue: "30",
      placeholder: "30",
      submitLabel: t('maintenance.prompt.clear_logs_label'),
      onSubmit: async (daysStr) => {
        setPromptState(null);
        const days = parseInt(daysStr, 10);
        if (isNaN(days) || days < 0) return;

        setClearingLogs(true);
        try {
          const res = await api.delete('/maintenance/access-logs', { data: { keep_days: days } });
          toast(t('maintenance.toast.logs_cleared', { count: res.data.deleted }), "success");
          loadStats();
        } catch (err) {
          toast(t('maintenance.toast.clear_logs_failed', { error: (err.response?.data?.detail || err.message) }), "error");
        } finally {
          setClearingLogs(false);
        }
      },
      onCancel: () => setPromptState(null),
    });
  };

  const loadOrphans = async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    setActiveGroupKeys([]);
    try {
      const res = await api.get('/maintenance/orphans');
      const rawData = Array.isArray(res.data) ? res.data : [];

      const sorted = [...rawData].sort((a, b) => {
        const uuidA = a.node_uuid || '';
        const uuidB = b.node_uuid || '';
        if (uuidA !== uuidB) {
          return uuidA.localeCompare(uuidB);
        }
        return a.id - b.id;
      });

      setOrphans(sorted);
    } catch (err) {
      setError(t('maintenance.error.load_orphans_failed', { error: (err.response?.data?.detail || err.message) }));
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = useCallback((id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((items) => {
    const ids = items.map(i => i.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  const handleBatchDelete = () => {
    const count = visibleSelectedIds.length;
    if (count === 0) return;
    setConfirmState({
      title: t('maintenance.confirm.delete_title'),
      message: t('maintenance.confirm.delete_message', { count }),
      variant: "danger",
      confirmLabel: t('maintenance.confirm.delete_label'),
      onConfirm: async () => {
        setConfirmState(null);
        setBatchDeleting(true);
        const toDelete = visibleSelectedIds;
        let failed = [];

        for (const id of toDelete) {
          try {
            await api.delete(`/maintenance/orphans/${id}`);
          } catch {
            failed.push(id);
          }
        }

        const failedSet = new Set(failed);
        setOrphans(prev => prev.filter(item => !toDelete.includes(item.id) || failedSet.has(item.id)));
        // Drop only the successfully deleted items; keep any selections that
        // weren't part of this (visible) batch.
        setSelectedIds(prev => {
          const next = new Set(prev);
          toDelete.forEach(id => {
            if (!failedSet.has(id)) next.delete(id);
          });
          return next;
        });

        if (expandedId && toDelete.includes(expandedId) && !failedSet.has(expandedId)) {
          setExpandedId(null);
        }

        if (failed.length > 0) {
          toast(t('maintenance.toast.partial_delete_failed', { failed: failed.length, total: count, ids: failed.join(', ') }), "error");
        }

        setBatchDeleting(false);
      },
      onCancel: () => setConfirmState(null),
    });
  };

  const handleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (!detailData[id]) {
      setDetailLoading(id);
      try {
        const res = await api.get(`/maintenance/orphans/${id}`);
        setDetailData(prev => ({ ...prev, [id]: res.data }));
      } catch (err) {
        setDetailData(prev => ({ ...prev, [id]: { error: err.response?.data?.detail || err.message } }));
      } finally {
        setDetailLoading(null);
      }
    }
  };

  // ── Derived data ──

  const deprecated = useMemo(() => orphans.filter(o => o.category === 'deprecated'), [orphans]);
  const orphaned = useMemo(() => orphans.filter(o => o.category === 'orphaned'), [orphans]);

  const groups = useMemo(() => {
    const targetGroups = new Map();
    const orphanedItems = [];
    const nodeToTargetKey = new Map();

    for (const item of orphans) {
      if (item.category === 'deprecated') {
        const targetId = item.migration_target?.id ?? item.migrated_to;
        if (!targetGroups.has(targetId)) {
          const name = item.migration_target?.paths?.[0]
            || (item.migration_target
              ? t('maintenance.group.no_path', { id: targetId })
              : `→ #${targetId}`);
          targetGroups.set(targetId, {
            key: `target:${targetId}`,
            type: 'deprecated',
            targetId,
            name,
            items: [],
          });
        }
        targetGroups.get(targetId).items.push(item);
        if (item.node_uuid) {
          nodeToTargetKey.set(item.node_uuid, targetId);
        }
      } else {
        orphanedItems.push(item);
      }
    }

    const remainingOrphans = [];
    for (const item of orphanedItems) {
      if (item.node_uuid && nodeToTargetKey.has(item.node_uuid)) {
        const targetId = nodeToTargetKey.get(item.node_uuid);
        targetGroups.get(targetId).items.push(item);
      } else {
        remainingOrphans.push(item);
      }
    }

    const result = [...targetGroups.values()]
      .sort((a, b) => b.items.length - a.items.length);

    if (remainingOrphans.length > 0) {
      result.push({
        key: 'orphaned',
        type: 'orphaned',
        targetId: null,
        name: t('maintenance.group.orphaned_group'),
        items: remainingOrphans,
      });
    }

    return result;
  }, [orphans, t]);

  useEffect(() => {
    if (activeGroupKeys.length > 0) {
      const validKeys = activeGroupKeys.filter(key => groups.some(g => g.key === key));
      if (validKeys.length !== activeGroupKeys.length) {
        setActiveGroupKeys(validKeys);
      }
    }
  }, [groups, activeGroupKeys]);

  const displayedItems = useMemo(() => {
    if (activeGroupKeys.length === 0) return orphans;
    const items = [];
    for (const key of activeGroupKeys) {
      const group = groups.find(g => g.key === key);
      if (group) {
        items.push(...group.items);
      }
    }
    return items;
  }, [activeGroupKeys, groups, orphans]);

  const activeGroups = useMemo(() => {
    return groups.filter(g => activeGroupKeys.includes(g.key));
  }, [groups, activeGroupKeys]);

  // Only items currently on screen count toward batch delete, so the user can
  // never delete a selection that's hidden by the active group filter.
  const visibleSelectedIds = useMemo(
    () => displayedItems.filter(item => selectedIds.has(item.id)).map(item => item.id),
    [displayedItems, selectedIds]
  );

  const handleGroupClick = useCallback((groupKey) => {
    setExpandedId(null);

    const group = groups.find(g => g.key === groupKey);
    let removing = false;

    setActiveGroupKeys(prev => {
      removing = prev.includes(groupKey);
      return removing ? prev.filter(k => k !== groupKey) : [...prev, groupKey];
    });

    if (group) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        group.items.forEach(item => {
          if (removing) {
            next.delete(item.id);
          } else {
            next.add(item.id);
          }
        });
        return next;
      });
    }
  }, [groups]);

  const handleShowAll = useCallback(() => {
    setActiveGroupKeys([]);
    setSelectedIds(new Set());
    setExpandedId(null);
  }, []);

  // ── Render helpers ──

  const renderCard = (item) => {
    const isExpanded = expandedId === item.id;
    const detail = detailData[item.id];
    const isLoadingDetail = detailLoading === item.id;
    const isChecked = selectedIds.has(item.id);

    return (
      <div key={item.id} className="group relative bg-[var(--surface-solid)] border border-[var(--border)] hover:border-[var(--text-faint)] rounded-[var(--radius-lg)] transition-colors duration-150">
        <div
          className="flex items-start gap-3 p-4 cursor-pointer select-none"
          onClick={() => handleExpand(item.id)}
        >
          <button
            onClick={(e) => toggleSelect(item.id, e)}
            className="mt-0.5 flex-shrink-0 p-0.5 rounded-[var(--radius-sm)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
          >
            {isChecked ? (
              <CheckSquare size={18} className="text-[var(--text-primary)]" />
            ) : (
              <Square size={18} className="text-[var(--text-faint)] group-hover:text-[var(--text-muted)]" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {item.node_uuid && (
                <span className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded-[var(--radius-sm)]" title={`Node UUID: ${item.node_uuid}`}>
                  <span className="text-[var(--text-faint)] mr-1">{t('maintenance.badge.node_prefix')}</span>
                  {(item.node_uuid.split('-')[0] || '').substring(0, 8)}
                </span>
              )}
              <span className="text-[11px] font-mono text-[var(--semantic-info-fg)] bg-[var(--semantic-info-bg)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)]">
                {t('maintenance.badge.mem_prefix', { id: item.id })}
              </span>
              {item.category === 'deprecated' ? (
                <span className="text-[10px] font-mono text-[var(--semantic-warning-fg)] bg-[var(--semantic-warning-bg)] px-1.5 py-0.5 rounded-[var(--radius-sm)] flex items-center gap-1">
                  <Archive size={9} /> {t('maintenance.badge.deprecated')}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[var(--semantic-danger-fg)] bg-[var(--semantic-danger-bg)] px-1.5 py-0.5 rounded-[var(--radius-sm)] flex items-center gap-1">
                  <Unlink size={9} /> {t('maintenance.badge.orphaned')}
                </span>
              )}
              {item.migrated_to && (
                <span className="text-[10px] font-mono text-[var(--semantic-info-fg)] bg-[var(--semantic-info-bg)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                  → #{item.migrated_to}
                </span>
              )}
              <span className="text-[11px] text-[var(--text-faint)] tabular-nums">
                {item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm') : t('maintenance.badge.unknown_date')}
              </span>
            </div>

            {item.migration_target && item.migration_target.paths.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <ArrowRight size={12} className="text-[var(--text-faint)] flex-shrink-0" />
                {item.migration_target.paths.map((p, i) => (
                  <span key={i} className="text-[11px] font-mono text-[var(--semantic-info-fg)] bg-[var(--semantic-info-bg)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)]">
                    {p}
                  </span>
                ))}
              </div>
            )}
            {item.migration_target && item.migration_target.paths.length === 0 && (
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowRight size={12} className="text-[var(--text-faint)] flex-shrink-0" />
                <span className="text-[11px] text-[var(--text-faint)] italic">
                  {t('maintenance.detail.target_no_paths', { id: item.migration_target.id })}
                </span>
              </div>
            )}

            <div className="bg-[var(--surface-hover)] rounded-[var(--radius-md)] p-2.5 text-[12px] text-[var(--text-muted)] font-mono leading-relaxed line-clamp-3">
              {item.content_snippet}
            </div>
          </div>

          <div className="mt-1 flex-shrink-0 text-[var(--text-faint)]">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-[var(--border)] p-5 bg-[var(--surface-hover)]">
            {isLoadingDetail ? (
              <div className="flex items-center gap-3 text-[var(--text-muted)] py-4">
                <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--text-muted)] rounded-full animate-spin"></div>
                <span className="text-xs">{t('maintenance.detail.loading')}</span>
              </div>
            ) : detail?.error ? (
              <div className="text-[var(--semantic-danger-fg)] text-xs py-2">{t('maintenance.detail.error_prefix', { error: detail.error })}</div>
            ) : detail ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                      {detail.migration_target ? t('maintenance.detail.old_version') : t('maintenance.detail.full_content')}
                    </h4>
                    {restoringId !== item.id && item.category === 'orphaned' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRestoringId(item.id);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-md)] bg-[var(--surface-solid)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors duration-150"
                      >
                        <Undo2 size={11} />
                        {t('maintenance.detail.restore_btn')}
                      </button>
                    )}
                  </div>
                  <div className="bg-[var(--surface-solid)] rounded-[var(--radius-md)] p-4 border border-[var(--border)] text-[12px] text-[var(--text-secondary)] font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                    {detail.content}
                  </div>
                </div>

                {detail.migration_target && (
                  <div>
                    <h4 className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mb-2 font-semibold flex items-center gap-2">
                      <span>{t('maintenance.detail.diff_header', { fromId: item.id, toId: detail.migration_target.id })}</span>
                      {detail.migration_target.paths.length > 0 && (
                        <span className="text-[var(--text-faint)] normal-case tracking-normal font-normal">
                          ({detail.migration_target.paths[0]})
                        </span>
                      )}
                    </h4>
                    <div className="bg-[var(--surface-solid)] rounded-[var(--radius-md)] border border-[var(--border)] p-4 max-h-96 overflow-y-auto custom-scrollbar">
                      <DiffViewer
                        oldText={detail.content}
                        newText={detail.migration_target.content}
                      />
                    </div>
                  </div>
                )}

                {restoringId === item.id && (
                  <RestoreForm
                    memoryId={item.id}
                    onCancel={() => setRestoringId(null)}
                    onSuccess={() => {
                      setOrphans(prev => prev.filter(o => o.id !== item.id));
                      if (expandedId === item.id) {
                        setExpandedId(null);
                      }
                      setRestoringId(null);
                    }}
                  />
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const renderSectionHeader = (icon, label, color, items) => {
    const allSelected = items.length > 0 && items.every(i => selectedIds.has(i.id));
    const someSelected = items.some(i => selectedIds.has(i.id));

    return (
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => toggleSelectAll(items)}
          className="p-0.5 rounded-[var(--radius-sm)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
          title={allSelected ? t('maintenance.select.deselect_all') : t('maintenance.select.select_all')}
        >
          {allSelected ? (
            <CheckSquare size={16} className={color} />
          ) : someSelected ? (
            <Minus size={16} className={color} />
          ) : (
            <Square size={16} className="text-[var(--text-faint)]" />
          )}
        </button>
        {icon}
        <h3 className={`text-xs font-bold uppercase tracking-widest ${color}`}>
          {label}
        </h3>
        <span className="text-[11px] text-[var(--text-muted)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-full tabular-nums">
          {items.length}
        </span>
      </div>
    );
  };

  // ── Layout ──

  const deprecatedGroups = useMemo(() => groups.filter(g => g.type === 'deprecated'), [groups]);
  const orphanedGroups = useMemo(() => groups.filter(g => g.type === 'orphaned'), [groups]);

  return (
    <div className="flex h-full bg-[var(--bg-base)] text-[var(--text-primary)] font-sans overflow-hidden max-[640px]:flex-col">
      {/* ── Sidebar ── */}
      <div className="w-72 flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col max-[640px]:w-full max-[640px]:flex-shrink max-[640px]:max-h-[46%] max-[640px]:border-r-0 max-[640px]:border-b">
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="w-10 h-10 bg-[var(--surface-solid)] rounded-[var(--radius-lg)] flex items-center justify-center border border-[var(--border)] mb-3">
            <Sparkles className="text-[var(--text-secondary)]" size={20} />
          </div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">{t('maintenance.header.title')}</h1>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            {t('maintenance.header.subtitle')}
          </p>
        </div>

        {/* Compact stats */}
        <div className="flex gap-2 px-5 pb-3">
          <div className="flex-1 bg-[var(--surface-solid)] rounded-[var(--radius-lg)] px-3 py-2 border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{t('maintenance.stats.deprecated_label')}</div>
            <div className="text-xl font-mono text-[var(--semantic-warning-fg)] tabular-nums">{deprecated.length}</div>
          </div>
          <div className="flex-1 bg-[var(--surface-solid)] rounded-[var(--radius-lg)] px-3 py-2 border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{t('maintenance.stats.orphaned_label')}</div>
            <div className="text-xl font-mono text-[var(--semantic-danger-fg)] tabular-nums">{orphaned.length}</div>
          </div>
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto px-3 pb-2 custom-scrollbar">
          {/* All */}
          <button
            onClick={handleShowAll}
            className={`w-full text-left px-3 py-2.5 rounded-[var(--radius-lg)] transition-colors duration-150 text-xs mb-1 ${
              activeGroupKeys.length === 0
                ? 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)]'
                : 'hover:bg-[var(--surface-hover)] border border-transparent text-[var(--text-secondary)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={13} className={activeGroupKeys.length === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} />
                <span className="font-medium">{t('maintenance.group.all')}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded-full tabular-nums">
                {orphans.length}
              </span>
            </div>
          </button>

          {/* Deprecated groups */}
          {deprecatedGroups.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase text-[var(--semantic-warning-fg)] font-bold tracking-widest px-3 mb-1.5 flex items-center gap-1.5">
                <Archive size={10} />
                {t('maintenance.group.deprecated_groups')}
                <span className="text-[var(--text-faint)] tabular-nums">({deprecatedGroups.length})</span>
              </div>
              <div className="space-y-0.5">
                {deprecatedGroups.map(group => (
                  <button
                    key={group.key}
                    onClick={() => handleGroupClick(group.key)}
                    className={`w-full text-left px-3 py-2 rounded-[var(--radius-lg)] transition-colors duration-150 text-[11px] flex items-center justify-between gap-2 ${
                      activeGroupKeys.includes(group.key)
                        ? 'bg-[var(--semantic-warning-bg)] border border-[var(--border)] text-[var(--semantic-warning-fg)]'
                        : 'hover:bg-[var(--surface-hover)] border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title={group.name}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="flex-shrink-0">
                        {activeGroupKeys.includes(group.key) ? (
                          <CheckSquare size={14} className="text-[var(--semantic-warning-fg)]" />
                        ) : (
                          <Square size={14} className="text-[var(--text-faint)]" />
                        )}
                      </span>
                      <span className="truncate font-mono text-[11px] flex-1">{group.name}</span>
                    </div>
                    <span className="flex-shrink-0 text-[10px] bg-[var(--surface-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums">
                      {group.items.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orphaned group */}
          {orphanedGroups.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase text-[var(--semantic-danger-fg)] font-bold tracking-widest px-3 mb-1.5 flex items-center gap-1.5">
                <Unlink size={10} />
                {t('maintenance.group.orphaned_section')}
              </div>
              {orphanedGroups.map(group => (
                <button
                  key={group.key}
                  onClick={() => handleGroupClick(group.key)}
                  className={`w-full text-left px-3 py-2 rounded-[var(--radius-lg)] transition-colors duration-150 text-[11px] flex items-center justify-between gap-2 ${
                    activeGroupKeys.includes(group.key)
                      ? 'bg-[var(--semantic-danger-bg)] border border-[var(--border)] text-[var(--semantic-danger-fg)]'
                      : 'hover:bg-[var(--surface-hover)] border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="flex-shrink-0">
                      {activeGroupKeys.includes(group.key) ? (
                        <CheckSquare size={14} className="text-[var(--semantic-danger-fg)]" />
                      ) : (
                        <Square size={14} className="text-[var(--text-faint)]" />
                      )}
                    </span>
                    <span className="truncate flex-1">{group.name}</span>
                  </div>
                  <span className="flex-shrink-0 text-[10px] bg-[var(--surface-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums">
                    {group.items.length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Access log panel (pinned bottom) */}
        <div className="p-3 border-t border-[var(--border)] flex-shrink-0">
          <div className="bg-[var(--surface-solid)] rounded-[var(--radius-lg)] px-3 py-2.5 border border-[var(--border)]">
            <div className="flex justify-between items-center mb-0.5">
              <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">{t('maintenance.stats.access_logs_label')}</div>
              <button
                onClick={handleClearLogs}
                disabled={clearingLogs}
                className="text-[10px] text-[var(--semantic-danger-fg)] hover:opacity-75 disabled:opacity-50 transition-opacity duration-150"
              >
                {clearingLogs ? t('maintenance.stats.clearing') : t('maintenance.stats.clear_button')}
              </button>
            </div>
            <div className="text-xl font-mono text-[var(--text-primary)] tabular-nums">{logStats.count}</div>
            <div className="text-[var(--text-muted)] text-[10px] mt-0.5 tabular-nums">
              {logStats.oldest ? t('maintenance.stats.oldest', { date: format(new Date(logStats.oldest), 'MM-dd HH:mm') }) : t('maintenance.stats.no_records')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface)] relative overflow-hidden">
        {/* Header with batch actions */}
        <div className="h-14 flex items-center justify-between px-8 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10 max-[640px]:px-4 max-[640px]:gap-3">
          <h2 className="min-w-0 text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
            <Trash2 size={14} />
            {activeGroupKeys.length > 0 ? (
              <span className="flex items-center gap-2">
                <span className="text-[var(--text-muted)]">{t('maintenance.list.header')}</span>
                <span className="text-[var(--text-faint)]">/</span>
                <span className="font-mono text-xs normal-case tracking-normal text-[var(--text-secondary)] max-w-[400px] truncate" title={activeGroups.map(g => g.name).join(', ')}>
                  {activeGroups.map(g => g.name).join(', ')}
                </span>
              </span>
            ) : (
              t('maintenance.list.header')
            )}
          </h2>
          <div className="flex items-center gap-2">
            {visibleSelectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                disabled={batchDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger-fg)] hover:opacity-90 border border-[var(--border)] transition-opacity duration-150 disabled:opacity-50"
              >
                {batchDeleting ? (
                  <div className="w-3 h-3 border-2 border-[var(--semantic-danger-fg)] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Trash2 size={13} />
                )}
                {t('maintenance.list.delete_selected', { count: visibleSelectedIds.length })}
              </button>
            )}
            <button
              onClick={loadOrphans}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-full transition-colors duration-150"
              title={t('maintenance.list.refresh')}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar max-[640px]:p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] gap-4">
              <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--text-muted)] rounded-full animate-spin"></div>
              <span className="text-xs tracking-widest uppercase">{t('maintenance.list.scanning')}</span>
            </div>
          ) : error ? (
            <div className="text-[var(--semantic-danger-fg)] bg-[var(--semantic-danger-bg)] border border-[var(--border)] p-6 rounded-[var(--radius-lg)] flex items-center gap-4">
              <AlertTriangle size={24} />
              <div>
                <h3 className="font-bold text-[var(--semantic-danger-fg)]">{t('maintenance.list.error_title')}</h3>
                <p className="text-sm text-[var(--semantic-danger-fg)]">{error}</p>
              </div>
            </div>
          ) : orphans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-faint)] gap-6 select-none">
              <Sparkles size={64} className="opacity-30" />
              <p className="text-lg font-light text-[var(--text-muted)]">{t('maintenance.list.empty_title')}</p>
              <p className="text-xs uppercase tracking-widest text-[var(--text-faint)]">{t('maintenance.list.empty_desc')}</p>
            </div>
          ) : activeGroupKeys.length > 0 ? (
            /* ── Group view: flat list of active groups ── */
            <div className="max-w-5xl mx-auto">
              {activeGroups.length > 0 && (
                <div className="space-y-3 mb-6 p-4 bg-[var(--surface-solid)] rounded-[var(--radius-xl)] border border-[var(--border)] shadow-[var(--island-shadow-soft)]">
                  {activeGroups.map(group => {
                    return (
                      <div key={group.key} className="flex items-center gap-3">
                        {group.type === 'deprecated' ? (
                          <Archive size={16} className="text-[var(--semantic-warning-fg)] flex-shrink-0" />
                        ) : (
                          <Unlink size={16} className="text-[var(--semantic-danger-fg)] flex-shrink-0" />
                        )}
                        <h3 className={`text-xs font-bold font-mono normal-case tracking-normal flex-1 truncate ${
                          group.type === 'deprecated' ? 'text-[var(--semantic-warning-fg)]' : 'text-[var(--semantic-danger-fg)]'
                        }`} title={group.name}>
                          {group.name}
                        </h3>
                        <span className="text-[11px] text-[var(--text-muted)] bg-[var(--surface-hover)] px-2 py-0.5 rounded-full flex-shrink-0 font-mono tabular-nums">
                          {group.items.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="space-y-2">
                {displayedItems.map(renderCard)}
              </div>
            </div>
          ) : (
            /* ── All view: split by deprecated / orphaned ── */
            <div className="max-w-5xl mx-auto space-y-8">
              {deprecated.length > 0 && (
                <section>
                  {renderSectionHeader(
                    <Archive size={16} className="text-[var(--semantic-warning-fg)]" />,
                    t('maintenance.section.deprecated_versions'),
                    "text-[var(--semantic-warning-fg)]",
                    deprecated
                  )}
                  <div className="space-y-2">
                    {deprecated.map(renderCard)}
                  </div>
                </section>
              )}
              {orphaned.length > 0 && (
                <section>
                  {renderSectionHeader(
                    <Unlink size={16} className="text-[var(--semantic-danger-fg)]" />,
                    t('maintenance.section.orphaned_memories'),
                    "text-[var(--semantic-danger-fg)]",
                    orphaned
                  )}
                  <div className="space-y-2">
                    {orphaned.map(renderCard)}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
      {confirmState && <ConfirmModal {...confirmState} />}
      {promptState && <PromptModal {...promptState} />}
    </div>
  );
}

const RestoreForm = ({ memoryId, onCancel, onSuccess }) => {
  const { t } = useLocale();
  const [domain, setDomain] = useState('core');
  const [pathSegments, setPathSegments] = useState([]);
  const [childrenByLevel, setChildrenByLevel] = useState([[]]);
  const [leafName, setLeafName] = useState('');
  const [disclosure, setDisclosure] = useState('');
  const [priority, setPriority] = useState(0);
  const [namespace, setNamespace] = useState(
    () => localStorage.getItem('selected_namespace') ?? ''
  );
  const [knownNamespaces, setKnownNamespaces] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingLevel, setLoadingLevel] = useState(-1);

  useEffect(() => {
    getNamespaces()
      .then(nsList => setKnownNamespaces(nsList.filter(ns => ns !== '')))
      .catch(() => setKnownNamespaces([]));
  }, []);

  const fetchChildren = async (parentPath, currentDomain) => {
    try {
      const res = await api.get('/browse/node', {
        params: { domain: currentDomain, path: parentPath, nav_only: true },
        headers: { 'X-Namespace': namespace.trim() },
      });
      return (res.data.children || []).map(c => c.path.split('/').pop());
    } catch {
      return [];
    }
  };

  // When domain changes, reset path selection and load level 0 children for new domain
  useEffect(() => {
    setPathSegments([]);
    setChildrenByLevel([[]]);
    setLoadingLevel(0);
    fetchChildren('', domain).then(names => {
      setChildrenByLevel([names]);
      setLoadingLevel(-1);
    });
  }, [domain, namespace]);

  const handleSegmentChange = async (level, value) => {
    if (value === '') {
      setPathSegments(prev => prev.slice(0, level));
      setChildrenByLevel(prev => prev.slice(0, level + 1));
    } else {
      const newSegments = [...pathSegments.slice(0, level), value];
      setPathSegments(newSegments);
      setChildrenByLevel(prev => prev.slice(0, level + 1));

      const fullPath = newSegments.join('/');
      setLoadingLevel(level + 1);
      const children = await fetchChildren(fullPath, domain);
      if (children.length > 0) {
        setChildrenByLevel(prev => [...prev, children]);
      }
      setLoadingLevel(-1);
    }
  };

  const buildFullPath = () => {
    const leaf = leafName.trim();
    if (!leaf) return '';
    const parent = pathSegments.join('/');
    return parent ? `${parent}/${leaf}` : leaf;
  };

  const handleRestore = async () => {
    const fullPath = buildFullPath();
    if (!fullPath) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/maintenance/orphans/${memoryId}/restore`, {
        new_domain: domain,
        new_path: fullPath,
        priority: priority,
        disclosure: disclosure.trim() || undefined,
        namespace: namespace.trim() || '',
      });
      toast(t('maintenance.detail.restore_success_toast', { uri: `${domain}://${fullPath}` }), 'success');
      onSuccess();
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message;
      setError(t('maintenance.detail.restore_failed_toast', { error: errMsg }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 space-y-3.5 mt-4 shadow-[var(--island-shadow-soft)]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        <Undo2 size={14} />
        <span>{t('maintenance.detail.restore_title')}</span>
      </div>

      <div className="space-y-3">
        {/* Domain & Cascading Path Selectors */}
        <div className="space-y-1.5">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
            {t('maintenance.detail.restore_path_label')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={domain}
              onChange={e => setDomain(e.target.value)}
              className="px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
            >
              <option value="core">core</option>
              <option value="writer">writer</option>
              <option value="project">project</option>
            </select>
            <span className="text-[var(--text-faint)] font-mono text-xs">://</span>

            {childrenByLevel.map((options, level) => (
              options.length > 0 && (
                <React.Fragment key={level}>
                  {level > 0 && <span className="text-[var(--text-faint)] text-xs font-mono">/</span>}
                  <select
                    value={pathSegments[level] || ''}
                    onChange={e => handleSegmentChange(level, e.target.value)}
                    className="px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
                  >
                    <option value="">{level === 0 ? t('maintenance.detail.restore_parent_placeholder') : '—'}</option>
                    {options.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </React.Fragment>
              )
            ))}

            {loadingLevel >= 0 && <Loader2 size={12} className="animate-spin text-[var(--text-muted)]" />}
            <span className="text-[var(--text-faint)] text-xs font-mono">/</span>
            <input
              type="text"
              value={leafName}
              onChange={e => setLeafName(e.target.value)}
              placeholder={t('maintenance.detail.restore_leaf_placeholder')}
              className="px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-xs font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150 w-36"
            />
          </div>
        </div>

        {/* Namespace Selector */}
        <div className="space-y-1.5">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
            {t('maintenance.detail.restore_namespace_label')}
          </label>
          <select
            value={namespace}
            onChange={e => setNamespace(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
          >
            <option value="">{t('maintenance.detail.restore_namespace_default')}</option>
            {knownNamespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
            {namespace && !knownNamespaces.includes(namespace) && (
              <option key={namespace} value={namespace}>{namespace}</option>
            )}
          </select>
        </div>

        {/* Priority & Disclosure in parallel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1.5 md:col-span-3">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
              {t('memory.alias.disclosure_placeholder')}
            </label>
            <input
              type="text"
              value={disclosure}
              onChange={e => setDisclosure(e.target.value)}
              placeholder={t('maintenance.detail.restore_disclosure_placeholder')}
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-xs focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
              {t('maintenance.detail.restore_priority_label')}
            </label>
            <input
              type="number"
              min="0"
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-primary)] text-xs font-mono tabular-nums focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-[var(--semantic-danger-fg)] font-medium">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-1 border-t border-[var(--border)]">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium bg-[var(--surface-hover)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 disabled:opacity-50"
        >
          {t('maintenance.detail.restore_cancel_btn')}
        </button>
        <button
          onClick={handleRestore}
          disabled={saving || !leafName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium bg-[var(--accent)] hover:opacity-90 text-white disabled:opacity-50 transition-opacity duration-150"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Undo2 size={12} />
          )}
          {t('maintenance.detail.restore_confirm_btn')}
        </button>
      </div>
    </div>
  );
};
