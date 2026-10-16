import { useEffect, useState } from 'react';

// Delays updating `value` until `delay` ms have passed without a change.
// Use for search inputs so we don't fire an API request on every keystroke.
export const useDebounce = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};
