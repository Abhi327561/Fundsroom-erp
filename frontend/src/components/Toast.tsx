import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error';
}

const ToastContext = createContext<{ toast: (text: string, kind?: ToastMsg['kind']) => void }>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

let nextId = 1;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const toast = useCallback((text: string, kind: ToastMsg['kind'] = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
