import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />
      {/* Card */}
      <div className="relative bg-[var(--surface-solid)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--island-shadow)] w-full max-w-md mx-4 p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start gap-4 mb-4">
          {isDanger && (
            <div className="w-10 h-10 rounded-full bg-[var(--semantic-danger-bg)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-[var(--semantic-danger-fg)]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--text-faint)] hover:text-[var(--text-secondary)] flex-shrink-0 transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors duration-150"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-opacity duration-150 hover:opacity-90 text-white ${
              isDanger
                ? 'bg-[var(--semantic-danger-fg)]'
                : 'bg-[var(--accent)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
