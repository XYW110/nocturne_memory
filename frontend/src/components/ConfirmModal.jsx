import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Card */}
      <div className="relative bg-nocturne-bg-secondary border border-[var(--color-border-light)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start gap-4 mb-4">
          {isDanger && (
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-nocturne-text-primary">
              {title}
            </h3>
            <p className="text-sm text-nocturne-text-secondary mt-1">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-nocturne-text-muted hover:text-nocturne-text-primary flex-shrink-0 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-nocturne-text-primary hover:text-nocturne-text-primary hover:bg-nocturne-bg-tertiary rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDanger
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
