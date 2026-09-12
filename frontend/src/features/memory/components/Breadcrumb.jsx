import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import clsx from 'clsx';

const Breadcrumb = ({ items = [], onNavigate }) => (
  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
    <button
      onClick={() => onNavigate('')}
      className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-150"
    >
      <Home size={14} />
    </button>

    {items.map((crumb, i) => (
      <React.Fragment key={crumb.path}>
        <ChevronRight size={12} className="text-[var(--text-faint)] flex-shrink-0" />
        <button
          onClick={() => onNavigate(crumb.path)}
          className={clsx(
            "px-2 py-1 rounded-[var(--radius-md)] text-xs font-medium transition-colors duration-150 whitespace-nowrap",
            i === items.length - 1
              ? "bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          )}
        >
          {crumb.label}
        </button>
      </React.Fragment>
    ))}
  </div>
);

export default Breadcrumb;
