import { useEffect, useState } from 'react';

/**
 * Returns a timestamp that updates on an interval. Used to drive live
 * readouts (the header clock, elapsed-time counters) without each consumer
 * owning its own timer.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
