import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] overflow-hidden mb-4 shadow-[var(--island-shadow-soft)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors duration-150"
      >
        <div className="text-[var(--text-muted)] flex items-center justify-center">
          <Icon size={18} />
        </div>
        <span className="font-semibold text-[var(--text-primary)]">{title}</span>
        <div className="ml-auto">
          {open ? <ChevronUp size={16} className="text-[var(--text-faint)]" /> : <ChevronDown size={16} className="text-[var(--text-faint)]" />}
        </div>
      </button>
      {open && <div className="px-5 pb-5 pt-2 border-t border-[var(--border)]">{children}</div>}
    </div>
  );
}
