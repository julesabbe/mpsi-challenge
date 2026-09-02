"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="card animate-pop w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-extrabold text-white">{title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "flex-1 rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500"
                : "flex-1 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
            }
          >
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost flex-1 text-sm">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
