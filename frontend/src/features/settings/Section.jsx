import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-nocturne-bg-tertiary/80 border border-[var(--color-border-light)] rounded-xl overflow-hidden mb-4 shadow-sm backdrop-blur-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-nocturne-bg-hover/50 transition-colors"
      >
        <div className="text-nocturne-text-secondary flex items-center justify-center">
          <Icon size={18} />
        </div>
        <span className="font-semibold text-nocturne-text-primary">
          {title}
        </span>
        <div className="ml-auto">
          {open ? (
            <ChevronUp size={16} className="text-nocturne-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-nocturne-text-muted" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-[var(--color-border-light)]">
          {children}
        </div>
      )}
    </div>
  );
}
