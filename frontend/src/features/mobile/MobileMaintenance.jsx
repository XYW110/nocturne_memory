import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Undo2,
  Loader2,
} from "lucide-react";
import { api, getNamespaces } from "../../lib/api";
import DiffViewer from "../../components/DiffViewer";
import { toast } from "../../components/Toast";
import ConfirmModal from "../../components/ConfirmModal";
import PromptModal from "../../components/PromptModal";

/**
 * MobileMaintenance — flat list with long-press multi-select.
 *
 * Sections:
 *   1. Deprecated versions (grouped by node)
 *   2. Orphaned memories
 *   3. Access log stats + clear button
 *
 * Long-press (500ms) on an item enters selection mode. In selection mode,
 * tap toggles selection. A floating "Delete (N)" button appears at the bottom.
 */
export default function MobileMaintenance() {
  const { t } = useTranslation("mobile");
  const [orphans, setOrphans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);

  // Detail expansion
  const [expandedId, setExpandedId] = useState(null);
  const [detailData, setDetailData] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);

  // Log stats
  const [logStats, setLogStats] = useState(null);

  // Load orphans
  const loadOrphans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/maintenance/orphans");
      setOrphans(res.data || []);
    } catch (err) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load log stats
  const loadLogStats = useCallback(async () => {
    try {
      const res = await api.get("/maintenance/access-logs/stats");
      setLogStats(res.data);
    } catch {
      // No-op
    }
  }, []);

  useEffect(() => {
    loadOrphans();
    loadLogStats();
  }, [loadOrphans, loadLogStats]);

  // Toggle detail
  const handleToggleDetail = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailData[id]) {
      setDetailLoading(id);
      try {
        const res = await api.get("/maintenance/orphans/" + id);
        setDetailData((prev) => ({ ...prev, [id]: res.data }));
      } catch {
        // No-op
      } finally {
        setDetailLoading(null);
      }
    }
  };

  // Long press → enter selection mode
  const handleTouchStart = (id) => {
    const timer = setTimeout(() => {
      // Enter selection mode
      setSelectedIds(new Set([id]));
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTap = (id) => {
    if (selectedIds.size > 0) {
      // Selection mode: toggle
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (next.size === 0) setLongPressTimer(null);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  };

  // Delete selected
  const handleBatchDelete = () => {
    setConfirmState({
      title: t("maintenance.action.deleteSelected", {
        count: selectedIds.size,
      }),
      message: `Permanently delete ${selectedIds.size} memories? This action is irreversible.`,
      onConfirm: async () => {
        setBatchDeleting(true);
        try {
          const ids = Array.from(selectedIds);
          let failed = 0;
          for (const id of ids) {
            try {
              await api.delete(`/maintenance/orphans/${id}`);
            } catch {
              failed++;
            }
          }
          if (failed > 0) {
            toast(`Partial failure: ${failed}/${ids.length} items failed`);
          }
          setSelectedIds(new Set());
          setConfirmState(null);
          loadOrphans();
        } catch (err) {
          toast("Batch delete failed");
        } finally {
          setBatchDeleting(false);
        }
      },
      onCancel: () => setConfirmState(null),
    });
  };

  // Clear logs
  const handleClearLogs = () => {
    setPromptState({
      title: "Clear Access Logs",
      message: "How many days of logs to keep? Older entries will be removed.",
      label: "Days",
      defaultValue: "30",
      onConfirm: async (days) => {
        try {
          const res = await api.delete("/maintenance/access-logs", {
            data: { keepDays: parseInt(days) || 30 },
          });
          toast(`Cleared ${res.data?.removed || "?"} log entries.`);
          setPromptState(null);
          loadLogStats();
        } catch (err) {
          toast("Failed to clear logs");
        }
      },
      onCancel: () => setPromptState(null),
    });
  };

  // Restore a memory
  const handleRestore = async (id) => {
    try {
      await api.post(`/maintenance/orphans/${id}/restore`);
      toast("Memory restored ✓");
      loadOrphans();
    } catch (err) {
      toast("Restore failed");
    }
  };

  // Group orphans by type
  const deprecated = orphans.filter((o) => o.is_deprecated);
  const orphaned = orphans.filter((o) => !o.is_deprecated);

  return (
    <div className="flex flex-col h-full">
      {/* Header: log stats + clear */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-nocturne-bg-secondary px-4 py-3 flex items-center justify-between">
        <div className="text-xs text-nocturne-text-muted">
          {logStats ? (
            <span>
              Logs: {logStats.count} entries
              {logStats.oldest && ` · oldest: ${logStats.oldest}`}
            </span>
          ) : (
            "Logs: —"
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearLogs}
            className="px-2 py-1 text-xs rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
          >
            {t("maintenance.action.clearLogs")}
          </button>
          <button
            onClick={() => {
              loadOrphans();
              loadLogStats();
            }}
            className="p-1 text-nocturne-text-muted hover:text-nocturne-text-secondary"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="text-center text-nocturne-text-muted text-sm mt-8">
            Scanning…
          </div>
        ) : error ? (
          <div className="text-center text-red-400 text-sm mt-8">{error}</div>
        ) : orphans.length === 0 ? (
          <div className="text-center mt-8">
            <div className="text-lg font-medium text-nocturne-text-primary">
              {t("maintenance.empty.title")}
            </div>
            <div className="text-sm text-nocturne-text-muted mt-1">
              {t("maintenance.empty.desc")}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {/* Deprecated section */}
            {deprecated.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-amber-400 bg-nocturne-bg-tertiary/50">
                  {t("maintenance.section.deprecated")} ({deprecated.length})
                </div>
                {deprecated.map((item) => (
                  <MemoryItem
                    key={item.id}
                    item={item}
                    t={t}
                    expanded={expandedId === item.id}
                    detail={detailData[item.id]}
                    detailLoading={detailLoading === item.id}
                    selected={selectedIds.has(item.id)}
                    selectMode={selectedIds.size > 0}
                    onToggleDetail={() => handleToggleDetail(item.id)}
                    onTouchStart={() => handleTouchStart(item.id)}
                    onTouchEnd={handleTouchEnd}
                    onTap={() => handleTap(item.id)}
                    onRestore={() => handleRestore(item.id)}
                  />
                ))}
              </div>
            )}

            {/* Orphaned section */}
            {orphaned.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-rose-400 bg-nocturne-bg-tertiary/50">
                  {t("maintenance.section.orphaned")} ({orphaned.length})
                </div>
                {orphaned.map((item) => (
                  <MemoryItem
                    key={item.id}
                    item={item}
                    t={t}
                    expanded={expandedId === item.id}
                    detail={detailData[item.id]}
                    detailLoading={detailLoading === item.id}
                    selected={selectedIds.has(item.id)}
                    selectMode={selectedIds.size > 0}
                    onToggleDetail={() => handleToggleDetail(item.id)}
                    onTouchStart={() => handleTouchStart(item.id)}
                    onTouchEnd={handleTouchEnd}
                    onTap={() => handleTap(item.id)}
                    onRestore={() => handleRestore(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating batch delete button */}
      {selectedIds.size > 0 && (
        <div className="flex-shrink-0 border-t border-[var(--color-border)] bg-nocturne-bg-secondary px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-nocturne-text-muted hover:text-nocturne-text-secondary"
          >
            {t("maintenance.select.none")}
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className="flex-1 h-10 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-600 flex items-center justify-center gap-2"
          >
            {batchDeleting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            {t("maintenance.action.deleteSelected", {
              count: selectedIds.size,
            })}
          </button>
        </div>
      )}

      {confirmState && <ConfirmModal {...confirmState} />}
      {promptState && <PromptModal {...promptState} />}
    </div>
  );
}

/** Single memory list item */
function MemoryItem({
  item,
  t,
  expanded,
  detail,
  detailLoading,
  selected,
  selectMode,
  onToggleDetail,
  onTouchStart,
  onTouchEnd,
  onTap,
  onRestore,
}) {
  return (
    <div
      className="px-4 py-3 hover:bg-nocturne-bg-tertiary/30 cursor-pointer"
      onTouchStart={selectMode ? undefined : onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={selectMode ? undefined : onTouchStart}
      onMouseUp={onTouchEnd}
      onClick={() => {
        if (selectMode) {
          onTap();
        } else {
          onToggleDetail();
        }
      }}
    >
      <div className="flex items-center gap-2">
        {selectMode && (
          <span className="flex-shrink-0">
            {selected ? (
              <CheckSquare size={16} className="text-indigo-400" />
            ) : (
              <Square size={16} className="text-nocturne-text-muted" />
            )}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-nocturne-text-primary truncate">
            {item.display_uri || item.uri || `Memory #${item.id}`}
          </div>
          <div className="text-xs text-nocturne-text-muted mt-0.5">
            {item.is_deprecated ? "Deprecated" : "Orphaned"}
            {item.timestamp && ` · ${item.timestamp}`}
          </div>
        </div>
        <span className="flex-shrink-0 text-nocturne-text-muted">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {detailLoading ? (
            <div className="text-center text-nocturne-text-muted text-xs">
              Loading…
            </div>
          ) : detail ? (
            <>
              <DiffViewer
                oldText={detail.old_content}
                newText={detail.current_content}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <Undo2 size={14} />
                {t("maintenance.detail.restore")}
              </button>
            </>
          ) : (
            <div className="text-xs text-nocturne-text-muted">
              Failed to load details
            </div>
          )}
        </div>
      )}
    </div>
  );
}
