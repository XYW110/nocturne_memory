import React from 'react';
import { ChevronRight, Folder, FileText, AlertTriangle, Link2, Zap, Lock } from 'lucide-react';
import clsx from 'clsx';
import PriorityBadge from './PriorityBadge';
import { useLocale } from '../../../i18n/useLocale';

const NodeGridCard = ({ node, currentDomain, isInBoot, onBootToggle, onClick }) => {
  const { t } = useLocale();
  const isCrossDomain = node.domain && node.domain !== currentDomain;

  const handleBootClick = (e) => {
    e.stopPropagation();
    onBootToggle?.();
  };

  return (
  <button
    onClick={onClick}
    className={clsx(
      "group relative flex flex-col items-start p-5 bg-[var(--surface)] border rounded-[var(--radius-xl)] shadow-[var(--island-shadow-soft)] transition-all duration-200 hover:shadow-[var(--island-shadow)] hover:-translate-y-0.5 text-left w-full h-full overflow-hidden",
      isInBoot
        ? "border-[var(--semantic-warning-fg)]"
        : "border-[var(--border)] hover:border-[var(--text-faint)]"
    )}
  >
    <div className="flex items-center gap-3 mb-3 w-full">
      <div className="p-2 rounded-[var(--radius-lg)] bg-[var(--surface-hover)] group-hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors duration-150 flex-shrink-0">
         {node.approx_children_count > 0 ? <Folder size={18} /> : <FileText size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] transition-colors duration-150 break-words line-clamp-2">
          {node.name || node.path.split('/').pop()}
        </h3>
        {isCrossDomain && (
          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[10px] font-mono text-[var(--semantic-info-fg)] bg-[var(--semantic-info-bg)] rounded-[var(--radius-sm)]">
            <Link2 size={9} />
            {node.domain}://
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {node.locked && (
          <span title={t('memory.locked.badge')} className="p-1 rounded-[var(--radius-md)] text-[var(--semantic-warning-fg)] bg-[var(--semantic-warning-bg)]">
            <Lock size={12} />
          </span>
        )}
        <PriorityBadge priority={node.priority} />
        {/* Boot toggle inline */}
        <div
          onClick={handleBootClick}
          title={isInBoot ? t('memory.boot.remove') : t('memory.boot.add')}
          className={clsx(
            "p-1 rounded-[var(--radius-md)] transition-colors duration-150 z-10",
            isInBoot
              ? "text-[var(--semantic-warning-fg)] bg-[var(--semantic-warning-bg)]"
              : "text-[var(--text-faint)] hover:text-[var(--semantic-warning-fg)] hover:bg-[var(--surface-hover)] opacity-0 group-hover:opacity-100 border border-transparent"
          )}
        >
          <Zap size={13} className={isInBoot ? "fill-[var(--semantic-warning-fg)]" : ""} />
        </div>
      </div>
    </div>

    {node.disclosure && (
      <div className="w-full mb-2">
        <p className="text-[11px] text-[var(--semantic-warning-fg)] leading-snug line-clamp-2 flex items-start gap-1">
          <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
          <span className="italic">{node.disclosure}</span>
        </p>
      </div>
    )}

    <div className="w-full flex-1">
        {node.content_snippet ? (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                {node.content_snippet}
            </p>
        ) : (
            <p className="text-xs text-[var(--text-faint)] italic">{t('memory.card.no_preview')}</p>
        )}
    </div>

    <ChevronRight size={14} className="absolute bottom-4 right-4 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
  </button>
  );
};

export default NodeGridCard;
