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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      {/* Card */}
      <div className="relative bg-nocturne-bg-tertiary border border-[var(--color-border-light)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-nocturne-text-primary">{title}</h3>
            {message && <p className="text-sm text-nocturne-text-secondary mt-1">{message}</p>}
          </div>
          <button onClick={onCancel} className="text-nocturne-text-muted hover:text-nocturne-text-primary flex-shrink-0">
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
          className="w-full bg-nocturne-bg-tertiary border border-[var(--color-border-light)] text-nocturne-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-4"
        />
        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-nocturne-text-primary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
