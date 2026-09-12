import React from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';

const PriorityBadge = ({ priority, size = 'sm' }) => {
  if (priority === null || priority === undefined) return null;
  
  const colors = priority === 0
    ? 'bg-[var(--semantic-danger-bg)] text-[var(--semantic-danger-fg)]'
    : priority <= 2
    ? 'bg-[var(--semantic-warning-bg)] text-[var(--semantic-warning-fg)]'
    : priority <= 5
    ? 'bg-[var(--semantic-info-bg)] text-[var(--semantic-info-fg)]'
    : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--border)]';

  const sizeClass = size === 'lg'
    ? 'px-2.5 py-1 text-xs gap-1.5'
    : 'px-1.5 py-0.5 text-[10px] gap-1';

  return (
    <span className={clsx("inline-flex items-center rounded-[var(--radius-sm)] font-mono font-semibold tabular-nums", colors, sizeClass)}>
      <Star size={size === 'lg' ? 12 : 9} />
      {priority}
    </span>
  );
};

export default PriorityBadge;
