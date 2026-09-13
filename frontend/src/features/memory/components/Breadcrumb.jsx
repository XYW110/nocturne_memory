import React, { useEffect, useRef } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import clsx from 'clsx';

const Breadcrumb = ({ items = [], onNavigate }) => {
  // Keep the current (rightmost) crumb visible: when the strip overflows,
  // auto-scroll to the end whenever the breadcrumb trail changes.
  // (Only relevant on desktop; at <=640px the strip is hidden and the
  // select-based picker below takes over.)
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [items]);

  // The backend always sends a "root" crumb (path "") as the first item;
  // fall back to an explicit root option if it is ever missing.
  const hasRootItem = items.length > 0 && items[0].path === '';
  const currentPath = items.length ? items[items.length - 1].path : '';

  return (
    <>
      <div ref={ref} className="max-[640px]:hidden flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
        <button
          onClick={() => onNavigate('')}
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150 max-[640px]:min-h-[var(--tap-target)] flex-shrink-0"
        >
          <Home size={14} />
        </button>

        {items.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            <ChevronRight size={12} className="text-[var(--text-faint)] flex-shrink-0" />
            <button
              onClick={() => onNavigate(crumb.path)}
              className={clsx(
                "inline-flex items-center px-2 py-1 rounded-[var(--radius-md)] text-xs font-medium transition-colors duration-150 whitespace-nowrap flex-shrink-0 max-[640px]:min-h-[var(--tap-target)]",
                i === items.length - 1
                  ? "bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              )}
            >
              <span className="max-[640px]:max-w-[160px] max-[640px]:truncate">{crumb.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* <=640px: horizontal strip replaced by a native select path picker */}
      <div className="hidden max-[640px]:flex items-center gap-2 min-w-0">
        <button
          onClick={() => onNavigate('')}
          className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150 min-h-[var(--tap-target)] flex-shrink-0"
        >
          <Home size={14} />
        </button>
        <select
          value={currentPath}
          onChange={e => onNavigate(e.target.value)}
          className="flex-1 min-w-0 bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] py-1.5 px-3 min-h-[var(--tap-target)] focus:outline-none focus:shadow-[var(--focus-ring)] transition-shadow duration-150"
        >
          {!hasRootItem && <option value="">root</option>}
          {items.map((crumb, i) => (
            <option key={crumb.path === '' ? `__root__${i}` : crumb.path} value={crumb.path}>
              {crumb.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};

export default Breadcrumb;
