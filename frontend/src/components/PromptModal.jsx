import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function PromptModal({
  title = 'Input Required',
  message = '',
  defaultValue = '',
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  placeholder = '',
  onSubmit,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;  // prevent empty submission
    onSubmit?.(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      {/* Card */}
      <div className="relative bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--island-shadow)] w-full max-w-md mx-4 p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            {message && <p className="text-sm text-[var(--text-secondary)] mt-1">{message}</p>}
          </div>
          <button onClick={onCancel} className="text-[var(--text-faint)] hover:text-[var(--text-secondary)] flex-shrink-0 transition-colors duration-150">
            <X size={18} />
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-[var(--surface-solid)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-[var(--radius-md)] px-3 py-2 text-sm focus:outline-none focus:shadow-[var(--focus-ring)] mb-4 transition-shadow duration-150"
        />
        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors duration-150"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[var(--radius-md)] transition-opacity duration-150"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
