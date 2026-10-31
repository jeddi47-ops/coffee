import { useEffect, useState } from "react";

/** Décompte en secondes (pour les 429 : action désactivée pendant retry_after_seconds). */
export function useCountdown(): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return [left, (s: number) => setLeft(Math.max(0, Math.ceil(s)))];
}
