import { create } from 'zustand';
import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

type Toast = { id: number; message: string; type: 'success' | 'error' };

interface ToastState {
  toasts: Toast[];
  push: (message: string, type?: 'success' | 'error') => void;
  remove: (id: number) => void;
}

let counter = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, type = 'success') => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helper usable outside React components. */
export const toast = {
  success: (m: string) => useToast.getState().push(m, 'success'),
  error: (m: string) => useToast.getState().push(m, 'error'),
};

export function ToastViewport() {
  const { toasts, remove } = useToast();
  useEffect(() => {}, []);
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-2 rounded-lg border bg-white p-3 shadow-card animate-in"
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}
          <p className="flex-1 text-sm text-ink-900">{t.message}</p>
          <button onClick={() => remove(t.id)} className="text-ink-500 hover:text-ink-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
