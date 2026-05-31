import { useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let _addToast: ((msg: string, type?: ToastType) => void) | null = null;

/** Call this from anywhere (action results, etc.) to show a toast. */
export function showToast(message: string, type: ToastType = "success") {
  _addToast?.(message, type);
}

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✗",
  info: "ℹ",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    _addToast = (message, type = "success") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    };
    return () => { _addToast = null; };
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

/**
 * Drop this hook in any route that has actionData with {status, message}.
 * It fires a toast whenever a new action result arrives.
 */
export function useActionToast(
  actionData: { status: "success" | "error"; message: string } | null | undefined,
) {
  const prev = useRef<typeof actionData>(null);
  useEffect(() => {
    if (actionData && actionData !== prev.current) {
      showToast(actionData.message, actionData.status === "success" ? "success" : "error");
      prev.current = actionData;
    }
  }, [actionData]);
}
