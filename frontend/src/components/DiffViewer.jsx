import React from 'react';
import { diffLines } from 'diff';
import { useTranslation } from 'react-i18next';

const DiffViewer = ({ oldText, newText }) => {
  const { t } = useTranslation();
  const safeOld = oldText || '';
  const safeNew = newText || '';
  const diff = diffLines(safeOld, safeNew);
  const hasChanges = safeOld !== safeNew;

  return (
    <div className="w-full font-sans text-sm leading-7">
      {!hasChanges && (
        <div data-testid="diff-no-changes" className="text-[var(--text-muted)] italic p-4 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-lg)]">
          {t('diff.no_changes')}
        </div>
      )}

      <div className="space-y-1">
        {diff.map((part, index) => {
          if (part.removed) {
            return (
              <div key={index} className="group relative bg-[var(--semantic-danger-bg)] hover:opacity-90 transition-opacity border-l-2 border-[var(--semantic-danger-fg)] pl-4 pr-2 py-1 select-text">
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--semantic-danger-fg)] opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <span data-testid="diff-removed" className="text-[var(--semantic-danger-fg)] line-through font-mono text-xs block mb-1 opacity-60 select-none">{t('diff.removed')}</span>
                <span className="text-[var(--semantic-danger-fg)] font-serif whitespace-pre-wrap">{part.value}</span>
              </div>
            );
          }

          if (part.added) {
            return (
               <div key={index} className="group relative bg-[var(--semantic-success-bg)] hover:opacity-90 transition-opacity border-l-2 border-[var(--semantic-success-fg)] pl-4 pr-2 py-2 my-1 rounded-r select-text">
                 <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--semantic-success-fg)]"></div>
                 <span data-testid="diff-added" className="text-[var(--semantic-success-fg)] font-mono text-xs block mb-1 opacity-70 select-none">{t('diff.added')}</span>
                 <span className="text-[var(--semantic-success-fg)] font-medium font-serif whitespace-pre-wrap">{part.value}</span>
               </div>
            );
          }

          return (
            <div key={index} className="pl-4 pr-2 py-1 text-[var(--text-muted)] whitespace-pre-wrap hover:text-[var(--text-secondary)] transition-colors duration-150 border-l-2 border-transparent">
              {part.value}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiffViewer;
