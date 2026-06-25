export default function Toast({ toast, onAction, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span className="toast-msg">{toast.message}</span>
      {toast.actionLabel && (
        <button className="toast-action" onClick={onAction}>{toast.actionLabel}</button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </div>
  );
}
