import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Database, Trash2, Check, BookOpen } from "lucide-react";
import {
  getGroups,
  getGroupDiff,
  rollbackGroup,
  approveGroup,
  clearAll,
} from "../../lib/api";
import DiffViewer from "../../components/DiffViewer";
import { toast } from "../../components/Toast";
import ConfirmModal from "../../components/ConfirmModal";
import SnapshotList from "../../components/SnapshotList";

/**
 * MobileReview — full-screen review with no sidebar.
 *
 * Design:
 *   - Top: "全部集成" button when there are changes
 *   - Middle: scrollable list of change groups (from SnapshotList)
 *   - Detail: full-screen overlay when a group is tapped, with bottom-fixed
 *     [驳回][集成] buttons and a ← Back header.
 */
export default function MobileReview() {
  const { t } = useTranslation("mobile");
  const [changes, setChanges] = useState([]);
  const [selectedChange, setSelectedChange] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [diffError, setDiffError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const diffRequestRef = useRef(0);

  // Load change groups
  const loadChanges = async () => {
    setLoading(true);
    try {
      const groups = await getGroups();
      const list = Array.isArray(groups) ? groups : [];
      setChanges(list);
      // Auto-select first item, or clear selection if list is empty
      if (
        selectedChange &&
        !list.find((c) => c.node_uuid === selectedChange.node_uuid)
      ) {
        setSelectedChange(list.length > 0 ? list[0] : null);
      } else if (list.length > 0 && !selectedChange) {
        setSelectedChange(list[0]);
      }
      if (list.length === 0) {
        setSelectedChange(null);
        setDiffData(null);
      }
      return list;
    } catch (err) {
      console.error("Failed to load review changes:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChanges();
  }, []);

  // Handle selecting a change group — only set state, diff loaded via useEffect
  const handleSelectChange = (change) => {
    setSelectedChange(change);
  };

  const handleBackToList = () => {
    setSelectedChange(null);
    setDiffData(null);
    setDiffError(null);
  };

  // Load diff when selectedChange changes (matches desktop ReviewPage pattern)
  const loadDiff = async (nodeUuid) => {
    const requestId = ++diffRequestRef.current;
    setDiffError(null);
    setDiffData(null);
    try {
      const data = await getGroupDiff(nodeUuid);
      if (requestId === diffRequestRef.current) setDiffData(data);
    } catch (err) {
      if (requestId === diffRequestRef.current) {
        setDiffError(err?.message || "Failed to load diff");
        setDiffData(null);
      }
    }
  };

  useEffect(() => {
    if (selectedChange) {
      loadDiff(selectedChange.node_uuid);
    }
  }, [selectedChange]);

  // Actions
  const handleReject = () => {
    if (!selectedChange) return;
    setConfirmState({
      title: t("review.confirm.rejectTitle"),
      message: t("review.confirm.rejectMessage"),
      onConfirm: async () => {
        try {
          await rollbackGroup(selectedChange.node_uuid);
          toast(t("review.action.reject") + " ✓");
          setConfirmState(null);
          handleBackToList();
          loadChanges();
        } catch (err) {
          toast(t("review.action.reject") + " ❌");
        }
      },
      onCancel: () => setConfirmState(null),
    });
  };

  const handleApprove = async () => {
    if (!selectedChange) return;
    try {
      await approveGroup(selectedChange.node_uuid);
      toast(t("review.action.approve") + " ✓");
      handleBackToList();
      loadChanges();
    } catch (err) {
      toast(t("review.action.approve") + " ❌");
    }
  };

  const handleIntegrateAll = () => {
    setConfirmState({
      title: t("review.confirm.integrateAllTitle"),
      message: t("review.confirm.integrateAllMessage"),
      onConfirm: async () => {
        try {
          await clearAll();
          toast(t("review.action.integrateAll") + " ✓");
          setConfirmState(null);
          loadChanges();
        } catch (err) {
          toast(t("review.action.integrateAll") + " ❌");
        }
      },
      onCancel: () => setConfirmState(null),
    });
  };

  // --- Detail View ---
  if (selectedChange) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with back button */}
        <div className="h-12 flex-shrink-0 border-b border-[var(--color-border)] bg-nocturne-bg-secondary flex items-center px-4 gap-3">
          <button
            onClick={handleBackToList}
            className="text-nocturne-text-secondary hover:text-nocturne-text-primary text-sm"
          >
            ← {t("review.detail.back")}
          </button>
          <span className="text-sm font-semibold truncate text-indigo-400">
            {selectedChange.display_uri}
          </span>
        </div>

        {/* Diff content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {diffError ? (
            <div className="text-red-400 text-sm">{diffError}</div>
          ) : diffData ? (
            <div className="space-y-4">
              {/* Action badge */}
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-400">
                  {diffData.action === "created"
                    ? t("review.detail.created")
                    : diffData.action === "deleted"
                    ? t("review.detail.deleted")
                    : t("review.detail.modified")}
                </span>
                {diffData.row_count != null && (
                  <span className="text-xs text-nocturne-text-muted">
                    {t("review.detail.rowsAffected", {
                      count: diffData.row_count,
                    })}
                  </span>
                )}
              </div>
              <DiffViewer
                beforeContent={diffData.before_content}
                currentContent={diffData.current_content}
              />
            </div>
          ) : (
            <div className="text-center text-nocturne-text-muted text-sm mt-8">
              Loading…
            </div>
          )}
        </div>

        {/* Bottom fixed action bar */}
        <div className="h-14 flex-shrink-0 border-t border-[var(--color-border)] bg-nocturne-bg-secondary flex gap-3 px-4 items-center">
          <button
            onClick={handleReject}
            className="flex-1 h-10 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10"
          >
            {t("review.action.reject")}
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
          >
            {t("review.action.approve")}
          </button>
        </div>

        {confirmState && <ConfirmModal {...confirmState} />}
      </div>
    );
  }

  // --- List View ---
  return (
    <div className="flex flex-col h-full">
      {/* Integrate All button */}
      {changes.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)]">
          <button
            onClick={handleIntegrateAll}
            className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 flex items-center justify-center gap-2"
          >
            <Check size={16} />
            {t("review.action.integrateAll")}
          </button>
        </div>
      )}

      {/* Change list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="text-center text-nocturne-text-muted text-sm mt-8">
            Loading…
          </div>
        ) : changes.length === 0 ? (
          <div className="text-center text-nocturne-text-muted text-sm mt-8">
            {t("review.empty")}
          </div>
        ) : (
          <SnapshotList
            snapshots={changes}
            selectedId={selectedChange?.node_uuid}
            onSelect={handleSelectChange}
          />
        )}
      </div>

      {confirmState && <ConfirmModal {...confirmState} />}
    </div>
  );
}
