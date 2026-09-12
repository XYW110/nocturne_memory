import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

const getActionColor = (action) => {
  if (action === 'created') return 'success';
  if (action === 'deleted') return 'danger';
  return 'warning'; // modified
};

const getActionLabel = (table, action, t) => {
  let entityName = table;
  if (table === 'memories') entityName = 'Memory';
  else if (table.endsWith('s')) entityName = table.slice(0, -1);
  const capitalizedEntity = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  const actionKey = action || 'modified';
  return `${capitalizedEntity} ${t(`snapshot.action_${actionKey}`)}`;
};

const COLOR_CLASSES = {
  success: {
    active: "bg-[var(--semantic-success-fg)]",
    idle:   "bg-[var(--semantic-success-fg)] opacity-30",
    label:  "text-[var(--semantic-success-fg)]",
  },
  danger: {
    active: "bg-[var(--semantic-danger-fg)]",
    idle:   "bg-[var(--semantic-danger-fg)] opacity-30",
    label:  "text-[var(--semantic-danger-fg)]",
  },
  warning: {
    active: "bg-[var(--semantic-warning-fg)]",
    idle:   "bg-[var(--semantic-warning-fg)] opacity-30",
    label:  "text-[var(--semantic-warning-fg)]",
  },
};

const SnapshotList = ({ snapshots, selectedId, onSelect }) => {
  const { t } = useTranslation();
  const snaps = Array.isArray(snapshots) ? snapshots : [];
  const getNamespacesLabel = (namespaces) => {
    if (!namespaces || namespaces.length === 0) return null;
    if (namespaces.length === 1 && namespaces[0] === "") return null;
    return namespaces.map(ns => ns === "" ? "default" : ns).join(", ");
  };

  if (snaps.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--text-faint)] text-xs tracking-wide uppercase">
        {t('snapshot.empty_sequence')}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {snaps.map((item) => {
        const isSelected = item.node_uuid === selectedId;
        const colorName = getActionColor(item.action);
        const colors = COLOR_CLASSES[colorName];
        const labelText = getActionLabel(item.top_level_table, item.action, t);

        return (
          <button
            key={item.node_uuid}
            onClick={() => onSelect(item)}
            className={clsx(
              "group relative text-left py-3 px-5 border-l-2 transition-colors duration-150 outline-none w-full hover:bg-[var(--surface-hover)]",
              isSelected
                ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            {isSelected && (
              <div className="absolute inset-0 pointer-events-none" />
            )}

            <div className="flex items-center gap-3 relative z-10">
              <div className={clsx(
                "flex-shrink-0 w-1.5 h-1.5 rounded-full transition-colors duration-150",
                isSelected ? colors.active : colors.idle
              )} />

              <div className="min-w-0 flex-1">
                <div className={clsx(
                  "font-medium text-xs truncate transition-colors duration-150 flex items-center gap-2",
                  isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                )}>
                  <span className="truncate">{item.display_uri}</span>
                  {getNamespacesLabel(item.namespaces) && (
                    <span className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded-[var(--radius-sm)] bg-[var(--semantic-info-bg)] text-[var(--semantic-info-fg)] border border-[var(--border)] tracking-wider font-mono">
                      {getNamespacesLabel(item.namespaces)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex justify-between items-center pr-2">
                  <span className={clsx(
                    "text-[10px] uppercase tracking-wider font-bold",
                    colors.label
                  )}>
                    {labelText}
                  </span>
                  {item.row_count > 1 && (
                    <span className="text-[9px] text-[var(--text-faint)] tabular-nums">
                      {t('snapshot.rows', { count: item.row_count })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SnapshotList;
